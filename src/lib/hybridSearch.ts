/**
 * Hybrid search — combines semantic (embedding) and keyword (TF-IDF) search
 * with reciprocal rank fusion and optional LLM re-ranking.
 */
import { semanticSearch } from './embeddings'
import { searchChunks } from './sources'
import { callFastModel } from '../ai/fastClient'
import type { DocumentChunk } from '../db/schema'

export type HybridSearchResult = DocumentChunk & {
  score: number
  documentTitle?: string
  source: 'semantic' | 'keyword' | 'both'
}

interface HybridSearchOptions {
  topN?: number
  rerank?: boolean
  semanticWeight?: number
  keywordWeight?: number
}

type ChunkResult = DocumentChunk & { score: number; documentTitle?: string }

const RRF_K = 60

/**
 * Hybrid search: runs semantic + keyword in parallel, fuses with RRF,
 * optionally re-ranks top candidates with the fast model.
 */
export async function hybridSearch(
  examProfileId: string,
  query: string,
  authToken: string | undefined,
  options?: HybridSearchOptions,
): Promise<HybridSearchResult[]> {
  const topN = options?.topN ?? 5
  const rerank = options?.rerank ?? !!authToken
  const semanticWeight = options?.semanticWeight ?? 0.6
  const keywordWeight = options?.keywordWeight ?? 0.4

  const candidateCount = Math.max(topN * 3, 20)

  // Run both searches in parallel
  const [semanticResults, keywordResults] = await Promise.all([
    authToken
      ? semanticSearch(examProfileId, query, authToken, candidateCount).catch(() => [] as ChunkResult[])
      : Promise.resolve([] as ChunkResult[]),
    searchChunks(examProfileId, query, candidateCount).catch(() => [] as ChunkResult[]),
  ])

  if (semanticResults.length === 0 && keywordResults.length === 0) {
    return []
  }

  // Single-source fast path
  if (semanticResults.length === 0) {
    return keywordResults.slice(0, topN).map(r => ({ ...r, source: 'keyword' as const }))
  }
  if (keywordResults.length === 0) {
    return semanticResults.slice(0, topN).map(r => ({ ...r, source: 'semantic' as const }))
  }

  // Collect all unique chunks by ID, keeping the full ChunkResult
  const chunkMap = new Map<string, ChunkResult>()
  for (const r of semanticResults) chunkMap.set(r.id, r)
  for (const r of keywordResults) { if (!chunkMap.has(r.id)) chunkMap.set(r.id, r) }

  // Build rank maps (1-indexed)
  const semanticRanks = new Map<string, number>()
  semanticResults.forEach((r, i) => semanticRanks.set(r.id, i + 1))

  const keywordRanks = new Map<string, number>()
  keywordResults.forEach((r, i) => keywordRanks.set(r.id, i + 1))

  // Reciprocal Rank Fusion
  const missingPenalty = candidateCount * 2
  const fused: Array<{ id: string; score: number; source: 'semantic' | 'keyword' | 'both' }> = []

  for (const id of chunkMap.keys()) {
    const semRank = semanticRanks.get(id) ?? missingPenalty
    const kwRank = keywordRanks.get(id) ?? missingPenalty
    const score = semanticWeight / (RRF_K + semRank) + keywordWeight / (RRF_K + kwRank)
    const source = semanticRanks.has(id) && keywordRanks.has(id) ? 'both'
      : semanticRanks.has(id) ? 'semantic' : 'keyword'
    fused.push({ id, score, source })
  }

  fused.sort((a, b) => b.score - a.score)
  let candidates = fused.slice(0, Math.max(topN * 2, 20))

  // LLM re-ranking (optional)
  if (rerank && authToken && candidates.length > topN) {
    try {
      const passageList = candidates
        .slice(0, 15)
        .filter(c => chunkMap.has(c.id))
        .map((c, i) => `[${i}] ${chunkMap.get(c.id)!.content.slice(0, 200)}`)
        .join('\n\n')

      const raw = await callFastModel(
        `Given this question: "${query}"

Rank these passages by relevance. Return ONLY a JSON array of indices (0-based) from most to least relevant. Include only the top ${topN}.

${passageList}`,
        'You are a search relevance ranker. Return only a JSON array of numbers.',
        authToken,
        { maxTokens: 256 },
      )

      const jsonMatch = raw.match(/\[[\s\S]*?\]/)
      if (jsonMatch) {
        const indices = JSON.parse(jsonMatch[0]) as number[]
        const reranked = indices
          .filter(i => i >= 0 && i < candidates.length)
          .map(i => candidates[i])
        if (reranked.length > 0) candidates = reranked
      }
    } catch {
      // Re-ranking failed — use fused order
    }
  }

  // Build final results with full DocumentChunk data
  return candidates.slice(0, topN)
    .filter(c => chunkMap.has(c.id))
    .map(c => ({
      ...chunkMap.get(c.id)!,
      score: c.score,
      source: c.source,
    }))
}
