/**
 * Contextual chunk enrichment — generates a 1-sentence context prefix per chunk
 * at upload time, improving retrieval accuracy by ~49% (Anthropic research).
 * Uses the fast model in batches of 10.
 */
import { db } from '../db'
import { callFastModel } from '../ai/fastClient'
import type { DocumentChunk } from '../db/schema'

const BATCH_SIZE = 10

/**
 * Enrich chunks with contextual prefixes for better retrieval.
 * Writes contextPrefix directly to each DocumentChunk in the DB.
 * Returns a map of chunkId → context sentence.
 */
export async function enrichChunksWithContext(
  chunks: DocumentChunk[],
  documentTitle: string,
  documentSummary: string,
  authToken: string,
): Promise<Map<string, string>> {
  const result = new Map<string, string>()

  // Batch chunks into groups
  const batches: DocumentChunk[][] = []
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    batches.push(chunks.slice(i, i + BATCH_SIZE))
  }

  for (const batch of batches) {
    try {
      const chunkList = batch
        .map((c, i) => `Chunk ${i}: ${c.content.slice(0, 300)}`)
        .join('\n\n')

      const raw = await callFastModel(
        `Document: "${documentTitle}"
Summary: ${documentSummary.slice(0, 500)}

For each chunk below, write ONE sentence that situates it within the document. Mention the document name and the specific topic/section covered.

${chunkList}

Return ONLY a JSON array: [{ "index": 0, "context": "This section of [document] covers..." }]`,
        'You are a document analyst. Return only valid JSON.',
        authToken,
        { maxTokens: 2048 },
      )

      const jsonMatch = raw.match(/\[[\s\S]*\]/)
      if (!jsonMatch) continue

      const parsed = JSON.parse(jsonMatch[0]) as Array<{ index: number; context: string }>

      for (const item of parsed) {
        const chunk = batch[item.index]
        if (chunk && item.context) {
          result.set(chunk.id, item.context)
          await db.documentChunks.update(chunk.id, {
            contextPrefix: item.context,
          })
        }
      }
    } catch {
      // Non-fatal — chunks without contextPrefix still work fine
      continue
    }
  }

  return result
}
