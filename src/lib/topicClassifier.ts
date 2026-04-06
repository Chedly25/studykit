/**
 * Embedding-based chunk → topic classification.
 * Uses cosine similarity against topic centroids instead of LLM calls.
 * Topic name embeddings are cached in DB to avoid re-embedding.
 * Falls back to fast LLM classification when embeddings are unavailable.
 */
import * as Sentry from '@sentry/react'
import { db } from '../db'
import { callFastModel } from '../ai/fastClient'
import { base64ToFloat32Array, cosineSimilarity, generateEmbeddings } from './embeddings'
import type { DocumentChunk, Topic } from '../db/schema'

const SIMILARITY_THRESHOLD = 0.3
const BATCH_SIZE = 10

/**
 * Classify unclassified chunks for a document using embedding cosine similarity.
 * Returns the number of chunks classified.
 */
export async function classifyChunksByEmbedding(
  documentId: string,
  examProfileId: string,
  authToken: string,
): Promise<number> {
  const chunkEmbeddings = await db.chunkEmbeddings
    .where('documentId')
    .equals(documentId)
    .toArray()

  if (chunkEmbeddings.length === 0) return 0

  const topics = await db.topics.where('examProfileId').equals(examProfileId).toArray()
  if (topics.length === 0) return 0

  const allChunks = await db.documentChunks
    .where('documentId')
    .equals(documentId)
    .toArray()

  const unclassifiedChunkIds = new Set(
    allChunks.filter(c => !c.topicId).map(c => c.id)
  )

  const unclassifiedEmbeddings = chunkEmbeddings.filter(e => unclassifiedChunkIds.has(e.chunkId))
  if (unclassifiedEmbeddings.length === 0) return 0

  const embeddingByChunkId = new Map<string, string>()
  for (const e of chunkEmbeddings) {
    embeddingByChunkId.set(e.chunkId, e.embedding)
  }

  const topicVectors = await buildTopicVectors(topics, allChunks, embeddingByChunkId, examProfileId, authToken)
  if (topicVectors.length === 0) return 0

  let classified = 0
  for (const emb of unclassifiedEmbeddings) {
    const chunkVec = base64ToFloat32Array(emb.embedding)

    let bestTopicId: string | null = null
    let bestScore = SIMILARITY_THRESHOLD

    for (const { topicId, vector } of topicVectors) {
      const score = cosineSimilarity(chunkVec, vector)
      if (score > bestScore) {
        bestScore = score
        bestTopicId = topicId
      }
    }

    if (bestTopicId) {
      await db.documentChunks.update(emb.chunkId, { topicId: bestTopicId })
      classified++
    }
  }

  return classified
}

async function buildTopicVectors(
  topics: Topic[],
  chunks: DocumentChunk[],
  embeddingByChunkId: Map<string, string>,
  examProfileId: string,
  authToken: string,
): Promise<Array<{ topicId: string; vector: Float32Array }>> {
  const result: Array<{ topicId: string; vector: Float32Array }> = []
  const topicsNeedingEmbedding: Topic[] = []

  for (const topic of topics) {
    const classifiedChunks = chunks.filter(c => c.topicId === topic.id)
    const vectors: Float32Array[] = []

    for (const chunk of classifiedChunks) {
      const embStr = embeddingByChunkId.get(chunk.id)
      if (embStr) {
        vectors.push(base64ToFloat32Array(embStr))
      }
    }

    if (vectors.length > 0) {
      const dim = vectors[0].length
      const centroid = new Float32Array(dim)
      for (const v of vectors) {
        for (let i = 0; i < dim; i++) {
          centroid[i] += v[i]
        }
      }
      for (let i = 0; i < dim; i++) {
        centroid[i] /= vectors.length
      }
      result.push({ topicId: topic.id, vector: centroid })
    } else {
      topicsNeedingEmbedding.push(topic)
    }
  }

  // Check cached topic embeddings first
  if (topicsNeedingEmbedding.length > 0) {
    const cached = await db.topicEmbeddings
      .where('examProfileId')
      .equals(examProfileId)
      .toArray()
    const cacheMap = new Map(cached.map(c => [c.topicId, c]))

    const uncached: Topic[] = []
    for (const topic of topicsNeedingEmbedding) {
      const hit = cacheMap.get(topic.id)
      // Valid cache: same topic name (detect renames)
      if (hit && hit.topicName === topic.name) {
        result.push({ topicId: topic.id, vector: base64ToFloat32Array(hit.embedding) })
      } else {
        uncached.push(topic)
      }
    }

    // Embed only truly uncached topics, then store in DB
    if (uncached.length > 0) {
      try {
        const names = uncached.map(t => t.name)
        const embeddings = await generateEmbeddings(names, authToken)
        const now = new Date().toISOString()

        for (let i = 0; i < uncached.length; i++) {
          result.push({
            topicId: uncached[i].id,
            vector: base64ToFloat32Array(embeddings[i]),
          })
          // Cache for future runs
          const existing = cacheMap.get(uncached[i].id)
          await db.topicEmbeddings.put({
            id: existing?.id ?? crypto.randomUUID(),
            topicId: uncached[i].id,
            examProfileId,
            topicName: uncached[i].name,
            embedding: embeddings[i],
            updatedAt: now,
          })
        }
      } catch {
        // Embedding failure is non-fatal
      }
    }
  }

  return result
}

/**
 * LLM-based chunk classification fallback (uses fast model).
 * Used when embeddings are not available for a document.
 */
export async function classifyChunks(
  examProfileId: string,
  chunks: DocumentChunk[],
  authToken: string,
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  const topics = await db.topics.where('examProfileId').equals(examProfileId).toArray()
  if (topics.length === 0) return

  const topicNames = topics.map(t => t.name)
  const topicByName = new Map<string, Topic>(topics.map(t => [t.name.toLowerCase(), t]))

  const batches: DocumentChunk[][] = []
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    batches.push(chunks.slice(i, i + BATCH_SIZE))
  }

  let completed = 0

  for (const batch of batches) {
    const chunkSummaries = batch.map((c, i) => `[${i}] ${c.content.slice(0, 200)}`).join('\n\n')

    const prompt = `Classify each chunk below into one of these topics: ${topicNames.join(', ')}.

If a chunk doesn't clearly match any topic, use "none".

Return ONLY a JSON array like: [{"chunkIndex": 0, "topicName": "Topic Name"}, ...]

Chunks:
${chunkSummaries}`

    try {
      const text = await callFastModel(
        prompt,
        'You are a document classifier. Return only valid JSON.',
        authToken,
        { maxTokens: 1024 },
      )

      const jsonMatch = text.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        const classifications = JSON.parse(jsonMatch[0]) as Array<{ chunkIndex: number; topicName: string }>
        for (const { chunkIndex, topicName } of classifications) {
          if (topicName.toLowerCase() === 'none') continue
          const topic = topicByName.get(topicName.toLowerCase())
          if (topic && batch[chunkIndex]) {
            await db.documentChunks.update(batch[chunkIndex].id, { topicId: topic.id })
          }
        }
      }
    } catch (err) {
      Sentry.captureException(err instanceof Error ? err : new Error('[topicClassifier] Batch classification failed: ' + String(err)))
    }

    completed += batch.length
    onProgress?.(completed, chunks.length)
  }
}
