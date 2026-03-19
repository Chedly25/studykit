/**
 * AI function: extracts subject/topic structure from uploaded document chunks.
 */
import { streamChat } from './client'
import { createStreamExtractor } from './streamJsonExtractor'
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

  // Limit total content to ~8k chars
  let sampleContent = ''
  for (const s of allSamples) {
    if (sampleContent.length + s.length > 8000) break
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
    system: 'You are a curriculum analysis expert. Analyze study materials and extract their subject and topic structure. IMPORTANT: Return only valid JSON with English key names (subjects, topics, name, weight) even if the content is in another language. Topic and subject names can be in the original language.',
    tools: [],
    authToken,
    maxTokens: 16384,
  })

  const text = response.content
    .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
    .map(c => c.text)
    .join('')
    .replace(/```json\s*/g, '')
    .replace(/```\s*/g, '')

  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Failed to parse extraction response')

  const parsed = JSON.parse(jsonMatch[0])

  // Handle French key names (LLM may respond with matières/matiere instead of subjects)
  const subjects: ExtractionResult['subjects'] =
    parsed.subjects ?? parsed.matières ?? parsed.matieres ?? parsed.sujets ?? []

  if (!Array.isArray(subjects) || subjects.length === 0) {
    throw new Error('Invalid extraction result: no subjects found')
  }

  // Normalize topic keys (LLM may use French names)
  for (const s of subjects) {
    if (!s.topics && (s as Record<string, unknown>).chapitres) {
      s.topics = (s as Record<string, unknown>).chapitres as typeof s.topics
    }
    if (!s.topics && (s as Record<string, unknown>).sujets) {
      s.topics = (s as Record<string, unknown>).sujets as typeof s.topics
    }
  }

  return { ...parsed, subjects } as ExtractionResult
}

/**
 * Streaming variant — emits subjects one-by-one via onSubject callback.
 * contentOverride lets callers pass in-memory text to skip the DB read
 * (enables parallel upload + extract).
 */
export async function extractTopicStructureStreaming(
  examProfileId: string,
  authToken: string,
  onSubject: (subject: ExtractedSubject, index: number) => void,
  onStatus?: (message: string) => void,
  signal?: AbortSignal,
  contentOverride?: string,
): Promise<ExtractionResult> {
  const profile = await db.examProfiles.get(examProfileId)
  if (!profile) throw new Error('No exam profile found')

  let sampleContent: string
  let titles: string[]

  if (contentOverride) {
    sampleContent = contentOverride.slice(0, 8000)
    titles = ['Uploaded content']
  } else {
    const documents = await db.documents
      .where('examProfileId')
      .equals(examProfileId)
      .toArray()

    if (documents.length === 0) throw new Error('No documents found')

    const allSamples: string[] = []
    titles = []

    for (const doc of documents) {
      titles.push(doc.title)
      const chunks = await db.documentChunks
        .where('documentId')
        .equals(doc.id)
        .sortBy('chunkIndex')
      const sample = chunks.slice(0, 8).map(c => c.content)
      allSamples.push(...sample)
    }

    sampleContent = ''
    for (const s of allSamples) {
      if (sampleContent.length + s.length > 8000) break
      sampleContent += s + '\n\n---\n\n'
    }
  }

  onStatus?.('Analyzing content...')

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

  const extractor = createStreamExtractor<ExtractedSubject>('subjects', { onItem: onSubject })

  const response = await streamChat({
    messages: [{ role: 'user', content: prompt }],
    system: 'You are a curriculum analysis expert. Analyze study materials and extract their subject and topic structure. IMPORTANT: Return only valid JSON with English key names (subjects, topics, name, weight) even if the content is in another language. Topic and subject names can be in the original language.',
    tools: [],
    authToken,
    maxTokens: 16384,
    onToken: extractor.feed,
    signal,
  })

  const subjects = extractor.finalize()

  // Extract examName from full response
  const text = response.content
    .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
    .map(c => c.text)
    .join('')

  let examName = profile.name
  try {
    const jsonMatch = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      if (parsed.examName) examName = parsed.examName
    }
  } catch {
    // Use profile name as fallback
  }

  if (subjects.length === 0) {
    throw new Error('Invalid extraction result: no subjects found')
  }

  return { subjects, examName }
}
