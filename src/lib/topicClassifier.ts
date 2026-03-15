/**
 * Async chunk → topic classification.
 * Sends batches of chunks to the AI to classify into existing topics.
 */
import { db } from '../db'
import { streamChat } from '../ai/client'
import type { DocumentChunk, Topic } from '../db/schema'

const BATCH_SIZE = 10

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
