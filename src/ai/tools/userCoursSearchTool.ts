/**
 * Semantic search over the user's uploaded cours / documents.
 *
 * Two entry points:
 *   - `searchUserCours`: structured results for programmatic callers (fiches coach).
 *   - `searchUserCoursForLLM`: pre-formatted text wrapper for the agent loop, parallel
 *     to `legalSearchTool.searchLegalCodes`. The output uses a `[Cours: ...]` prefix
 *     so the chat hook's citation parser can distinguish cours from legal articles.
 */

import { semanticSearch } from '../../lib/embeddings'

export interface UserCoursResult {
  /** DocumentChunk.id — stable pointer back to the chunk */
  chunkId: string
  documentId: string
  documentTitle?: string
  chunkIndex: number
  content: string
  /** cosine similarity in [0, 1] */
  score: number
}

export interface SearchUserCoursOptions {
  /** Max results to return. Default 10. */
  topK?: number
  /** Drop results below this cosine similarity. Default 0 (keep all). */
  minScore?: number
}

/**
 * Search the user's uploaded cours chunks. Falls back to TF-IDF if
 * no embeddings or no auth token (handled inside semanticSearch).
 *
 * Returns [] if the user has no documents at all.
 */
export async function searchUserCours(
  query: string,
  examProfileId: string,
  authToken: string,
  options: SearchUserCoursOptions = {},
): Promise<UserCoursResult[]> {
  const topN = options.topK ?? 10
  const minScore = options.minScore ?? 0

  const results = await semanticSearch(examProfileId, query, authToken, topN)

  return results
    .filter(r => r.score >= minScore)
    .map(r => ({
      chunkId: r.id,
      documentId: r.documentId,
      documentTitle: r.documentTitle,
      chunkIndex: r.chunkIndex,
      content: r.content,
      score: r.score,
    }))
}

const LLM_DEFAULT_TOP_K = 8
const LLM_DEFAULT_MIN_SCORE = 0.35
const MAX_CHUNK_CHARS = 600

/**
 * LLM-facing wrapper. Mirrors `searchLegalCodes`' return shape:
 *   `{ resultCount, message, results }` JSON-stringified.
 *
 * `results` is a numbered text block with a `[Cours: …]` prefix per entry, which the
 * citation parser in `useLegalChat` uses to distinguish cours extracts from legal
 * articles. On no results, returns a sentinel that the system prompt knows to ignore
 * (no error path — the user might simply have no cours uploaded).
 */
export async function searchUserCoursForLLM(
  query: string,
  examProfileId: string,
  authToken: string,
  options: { topK?: number; minScore?: number } = {},
): Promise<string> {
  try {
    const results = await searchUserCours(query, examProfileId, authToken, {
      topK: options.topK ?? LLM_DEFAULT_TOP_K,
      minScore: options.minScore ?? LLM_DEFAULT_MIN_SCORE,
    })

    if (results.length === 0) {
      return JSON.stringify({
        resultCount: 0,
        message:
          'Aucun cours téléversé ou aucun extrait pertinent. Réponds en t\'appuyant uniquement sur les sources juridiques.',
        results: '',
      })
    }

    const formatted = results
      .map((r, i) => {
        const title = r.documentTitle || 'Cours'
        const trimmed =
          r.content.length > MAX_CHUNK_CHARS
            ? r.content.slice(0, MAX_CHUNK_CHARS) + '…'
            : r.content
        return `${i + 1}. [Cours: ${title}] (extrait ${r.chunkIndex + 1}, score ${r.score.toFixed(2)})\n   ${trimmed}`
      })
      .join('\n\n')

    return JSON.stringify({
      resultCount: results.length,
      message: `${results.length} extrait(s) pertinent(s) de tes cours :`,
      results: formatted,
    })
  } catch (err) {
    return JSON.stringify({
      error: `Recherche dans tes cours indisponible : ${(err as Error).message}`,
    })
  }
}
