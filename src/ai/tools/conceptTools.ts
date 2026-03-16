/**
 * Concept extraction tools — auto-map source content to topics.
 */
import { db } from '../../db'
import { streamChat } from '../client'

export async function autoMapSourceToTopics(
  examProfileId: string,
  input: { documentId: string },
  authToken: string,
): Promise<string> {
  const doc = await db.documents.get(input.documentId)
  if (!doc) return JSON.stringify({ error: 'Document not found' })

  const chunks = await db.documentChunks
    .where('documentId')
    .equals(input.documentId)
    .sortBy('chunkIndex')

  if (chunks.length === 0) return JSON.stringify({ error: 'No chunks found for document' })

  const topics = await db.topics.where('examProfileId').equals(examProfileId).toArray()
  if (topics.length === 0) return JSON.stringify({ error: 'No topics defined. Create topics first.' })

  // Send first chunks to AI for concept extraction
  const sampleContent = chunks.slice(0, 5).map(c => c.content).join('\n\n---\n\n')
  const topicNames = topics.map(t => t.name).join(', ')

  const prompt = `Analyze this document content and map it to the following topics.

Available topics: ${topicNames}

Document: "${doc.title}"
Content sample:
${sampleContent}

Return ONLY valid JSON:
{
  "mappings": [
    { "chunkIndices": [0, 1], "topicName": "topic name", "confidence": 0.85 }
  ],
  "conceptsFound": ["concept 1", "concept 2"],
  "unmappedConcepts": ["concept not matching any topic"]
}`

  try {
    const response = await streamChat({
      messages: [{ role: 'user', content: prompt }],
      system: 'You are a concept extraction expert. Analyze documents and map content to study topics. Return only valid JSON.',
      tools: [],
      authToken,
    })

    const text = response.content
      .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
      .map(c => c.text)
      .join('')

    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return JSON.stringify({ error: 'Failed to parse AI response' })

    const parsed = JSON.parse(jsonMatch[0]) as {
      mappings: Array<{ chunkIndices: number[]; topicName: string; confidence: number }>
      conceptsFound: string[]
      unmappedConcepts: string[]
    }

    // Apply mappings to chunks
    let mapped = 0
    for (const mapping of parsed.mappings) {
      const topic = topics.find(t => t.name.toLowerCase() === mapping.topicName.toLowerCase())
      if (!topic) continue

      for (const idx of mapping.chunkIndices) {
        const chunk = chunks.find(c => c.chunkIndex === idx)
        if (chunk) {
          await db.documentChunks.update(chunk.id, { topicId: topic.id })
          mapped++
        }
      }
    }

    return JSON.stringify({
      success: true,
      documentTitle: doc.title,
      conceptsFound: parsed.conceptsFound,
      mappingsApplied: mapped,
      unmappedConcepts: parsed.unmappedConcepts,
    }, null, 2)
  } catch {
    return JSON.stringify({ error: 'Failed to extract concepts' })
  }
}
