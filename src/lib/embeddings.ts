/**
 * Client-side embedding utilities — generate, store, search.
 * Falls back to TF-IDF if embeddings unavailable.
 */
import { db } from '../db'
import type { ChunkEmbedding, DocumentChunk } from '../db/schema'
import { searchChunks } from './sources'

const BATCH_SIZE = 50

// ─── Base64 ↔ Float32Array ──────────────────────────────────────

function base64ToFloat32Array(base64: string): Float32Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new Float32Array(bytes.buffer)
}

function float32ArrayToBase64(arr: Float32Array): string {
  const bytes = new Uint8Array(arr.buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

// ─── API calls ──────────────────────────────────────────────────

export async function generateEmbeddings(
  texts: string[],
  authToken: string,
): Promise<string[]> {
  const results: string[] = []

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE)
    const res = await fetch('/api/embed', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({ texts: batch }),
    })

    if (!res.ok) {
      throw new Error(`Embedding API error: ${res.status}`)
    }

    const data = (await res.json()) as { embeddings: string[] }
    results.push(...data.embeddings)
  }

  return results
}

export async function embedQuery(
  query: string,
  authToken: string,
): Promise<Float32Array> {
  const [embedding] = await generateEmbeddings([query], authToken)
  return base64ToFloat32Array(embedding)
}

// ─── Similarity ─────────────────────────────────────────────────

export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB)
  return denom === 0 ? 0 : dot / denom
}

// ─── Store embeddings ───────────────────────────────────────────

export async function embedAndStoreChunks(
  chunks: DocumentChunk[],
  authToken: string,
): Promise<void> {
  if (chunks.length === 0) return

  const texts = chunks.map(c => c.content)
  const embeddings = await generateEmbeddings(texts, authToken)

  const rows: ChunkEmbedding[] = chunks.map((chunk, i) => ({
    id: crypto.randomUUID(),
    chunkId: chunk.id,
    documentId: chunk.documentId,
    examProfileId: chunk.examProfileId,
    embedding: embeddings[i],
  }))

  await db.chunkEmbeddings.bulkPut(rows)
}

// ─── Semantic search with TF-IDF fallback ───────────────────────

export async function semanticSearch(
  examProfileId: string,
  query: string,
  authToken: string | undefined,
  topN = 5,
): Promise<(DocumentChunk & { score: number; documentTitle?: string })[]> {
  // Try semantic search if auth token available
  if (authToken) {
    try {
      const embeddings = await db.chunkEmbeddings
        .where('examProfileId')
        .equals(examProfileId)
        .toArray()

      if (embeddings.length > 0) {
        const queryVec = await embedQuery(query, authToken)

        const scored = embeddings.map(emb => ({
          ...emb,
          score: cosineSimilarity(queryVec, base64ToFloat32Array(emb.embedding)),
        }))

        scored.sort((a, b) => b.score - a.score)
        const topResults = scored.slice(0, topN).filter(r => r.score > 0.3)

        if (topResults.length > 0) {
          // Load chunks and document titles
          const chunkIds = topResults.map(r => r.chunkId)
          const chunks = await db.documentChunks.where('id').anyOf(chunkIds).toArray()
          const chunkMap = new Map(chunks.map(c => [c.id, c]))

          const docIds = [...new Set(chunks.map(c => c.documentId))]
          const docs = await db.documents.where('id').anyOf(docIds).toArray()
          const docMap = new Map(docs.map(d => [d.id, d.title]))

          return topResults
            .map(r => {
              const chunk = chunkMap.get(r.chunkId)
              if (!chunk) return null
              return {
                ...chunk,
                score: r.score,
                documentTitle: docMap.get(chunk.documentId),
              }
            })
            .filter((r): r is NonNullable<typeof r> => r !== null)
        }
      }
    } catch {
      // Fall through to TF-IDF
    }
  }

  // Fallback: TF-IDF search
  return searchChunks(examProfileId, query, topN)
}

// ─── Check if embeddings exist for a document ───────────────────

export async function hasEmbeddings(documentId: string): Promise<boolean> {
  const count = await db.chunkEmbeddings
    .where('documentId')
    .equals(documentId)
    .count()
  return count > 0
}

// ─── Delete embeddings for a document ───────────────────────────

export async function deleteEmbeddings(documentId: string): Promise<void> {
  await db.chunkEmbeddings
    .where('documentId')
    .equals(documentId)
    .delete()
}
