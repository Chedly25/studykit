/**
 * Embedding-based chunk → topic classification.
 * Uses cosine similarity against topic centroids instead of LLM calls.
 * Falls back to LLM classification when embeddings are unavailable.
 */
import { db } from '../db'
import { streamChat } from '../ai/client'
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
  // Load chunk embeddings for this document
  const chunkEmbeddings = await db.chunkEmbeddings
    .where('documentId')
    .equals(documentId)
    .toArray()

  if (chunkEmbeddings.length === 0) return 0

  // Load all topics for the profile
  const topics = await db.topics.where('examProfileId').equals(examProfileId).toArray()
  if (topics.length === 0) return 0

  // Load all chunks for this document to find unclassified ones
  const allChunks = await db.documentChunks
    .where('documentId')
    .equals(documentId)
    .toArray()

  const unclassifiedChunkIds = new Set(
    allChunks.filter(c => !c.topicId).map(c => c.id)
  )

  // Filter to embeddings for unclassified chunks only
  const unclassifiedEmbeddings = chunkEmbeddings.filter(e => unclassifiedChunkIds.has(e.chunkId))
  if (unclassifiedEmbeddings.length === 0) return 0

  // Build a map of chunkId → embedding vector
  const embeddingByChunkId = new Map<string, string>()
  for (const e of chunkEmbeddings) {
    embeddingByChunkId.set(e.chunkId, e.embedding)
  }

  // Build topic vectors (centroids from already-classified chunks, or embed topic name)
  const topicVectors = await buildTopicVectors(topics, allChunks, embeddingByChunkId, authToken)
  if (topicVectors.length === 0) return 0

  // Classify each unclassified chunk
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
  authToken: string,
): Promise<Array<{ topicId: string; vector: Float32Array }>> {
  const result: Array<{ topicId: string; vector: Float32Array }> = []

  // Topics with existing classified chunks → centroid of their chunk embeddings
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
      // Compute centroid (average of all vectors)
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

  // Topics without classified chunks → embed the topic name
  if (topicsNeedingEmbedding.length > 0) {
    try {
      const names = topicsNeedingEmbedding.map(t => t.name)
      const embeddings = await generateEmbeddings(names, authToken)
      for (let i = 0; i < topicsNeedingEmbedding.length; i++) {
        result.push({
          topicId: topicsNeedingEmbedding[i].id,
          vector: base64ToFloat32Array(embeddings[i]),
        })
      }
    } catch {
      // If embedding fails, we just won't have vectors for these topics
    }
  }

  return result
}

/**
 * LLM-based chunk classification fallback.
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
      const response = await streamChat({
        messages: [{ role: 'user', content: prompt }],
        system: 'You are a document classifier. Return only valid JSON.',
        tools: [],
        maxTokens: 1024,
        authToken,
      })

      const text = response.content
        .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
        .map(b => b.text)
        .join('')

      // Extract JSON from response
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
      console.warn('[topicClassifier] Batch classification failed:', err)
    }

    completed += batch.length
    onProgress?.(completed, chunks.length)
  }
}
