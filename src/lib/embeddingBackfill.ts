/**
 * Backfill embeddings for existing documents that don't have them yet.
 */
import { db } from '../db'
import { embedAndStoreChunks } from './embeddings'

async function getEmbeddedDocIds(examProfileId: string): Promise<Set<string>> {
  const embeddings = await db.chunkEmbeddings
    .where('examProfileId')
    .equals(examProfileId)
    .toArray()
  return new Set(embeddings.map(e => e.documentId))
}

export async function backfillEmbeddings(
  examProfileId: string,
  authToken: string,
  onProgress?: (current: number, total: number) => void,
): Promise<{ processed: number; failed: number }> {
  const allDocs = await db.documents
    .where('examProfileId')
    .equals(examProfileId)
    .toArray()

  const embeddedDocIds = await getEmbeddedDocIds(examProfileId)
  const docsNeedingEmbeddings = allDocs.filter(d => !embeddedDocIds.has(d.id))

  if (docsNeedingEmbeddings.length === 0) {
    return { processed: 0, failed: 0 }
  }

  let processed = 0
  let failed = 0

  for (let i = 0; i < docsNeedingEmbeddings.length; i++) {
    const doc = docsNeedingEmbeddings[i]
    try {
      const chunks = await db.documentChunks
        .where('documentId')
        .equals(doc.id)
        .toArray()

      if (chunks.length > 0) {
        await embedAndStoreChunks(chunks, authToken)
        processed++
      }
      // Skip docs with no chunks — don't count as processed
    } catch {
      failed++
    }
    onProgress?.(i + 1, docsNeedingEmbeddings.length)
  }

  return { processed, failed }
}

export async function getDocumentsNeedingEmbeddings(
  examProfileId: string,
): Promise<number> {
  const allDocs = await db.documents
    .where('examProfileId')
    .equals(examProfileId)
    .toArray()

  const embeddedDocIds = await getEmbeddedDocIds(examProfileId)
  return allDocs.filter(d => !embeddedDocIds.has(d.id)).length
}
