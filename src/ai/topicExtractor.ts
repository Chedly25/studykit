/**
 * AI function: extracts subject/topic structure from uploaded document chunks.
 */
import { streamChat } from './client'
import { db } from '../db'

export interface ExtractedTopic {
  name: string
  subtopics?: string[]
}

export interface ExtractedSubject {
  name: string
  weight: number
  topics: ExtractedTopic[]
}

export interface ExtractionResult {
  subjects: ExtractedSubject[]
  examName: string
}

export async function extractTopicStructure(
  examProfileId: string,
  authToken: string,
): Promise<ExtractionResult> {
  const profile = await db.examProfiles.get(examProfileId)
  if (!profile) throw new Error('No exam profile found')

  const documents = await db.documents
    .where('examProfileId')
    .equals(examProfileId)
    .toArray()

  if (documents.length === 0) throw new Error('No documents found')

  // Gather first 5-8 chunks per document for content sampling
  const allSamples: string[] = []
  const titles: string[] = []

  for (const doc of documents) {
    titles.push(doc.title)
    const chunks = await db.documentChunks
      .where('documentId')
      .equals(doc.id)
      .sortBy('chunkIndex')
    const sample = chunks.slice(0, 8).map(c => c.content)
    allSamples.push(...sample)
  }

  // Limit total content to ~15k chars
  let sampleContent = ''
  for (const s of allSamples) {
    if (sampleContent.length + s.length > 15000) break
    sampleContent += s + '\n\n---\n\n'
  }

  const prompt = `Analyze these study materials and extract the subject and topic structure.

Study profile: "${profile.name}" (${profile.examType})
Document titles: ${titles.join(', ')}

Content samples:
${sampleContent}

Return ONLY valid JSON matching this exact schema:
{
  "examName": "${profile.name}",
  "subjects": [
    {
      "name": "Subject Name",
      "weight": 30,
      "topics": [
        { "name": "Topic Name" }
      ]
    }
  ]
}

Rules:
- 2-6 subjects
- 3-10 topics per subject
- Topics should be specific enough to study independently
- Weights should estimate relative exam importance and sum to 100
- Use clear, concise topic names`

  const response = await streamChat({
    messages: [{ role: 'user', content: prompt }],
    system: 'You are a curriculum analysis expert. Analyze study materials and extract their subject and topic structure. Return only valid JSON.',
    tools: [],
    authToken,
  })

  const text = response.content
    .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
    .map(c => c.text)
    .join('')

  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Failed to parse extraction response')

  const parsed = JSON.parse(jsonMatch[0]) as ExtractionResult

  // Validate basic structure
  if (!parsed.subjects || !Array.isArray(parsed.subjects) || parsed.subjects.length === 0) {
    throw new Error('Invalid extraction result: no subjects found')
  }

  return parsed
}
