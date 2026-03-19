/**
 * AI function: extract topics from free text, pasted content, or descriptions.
 * Returns the same ExtractionResult format as topicExtractor.ts for consistency.
 */
import { streamChat } from './client'
import { createStreamExtractor } from './streamJsonExtractor'
import type { ExtractionResult, ExtractedSubject, ExtractedChapter } from './topicExtractor'

export async function extractLandscapeFromText(
  text: string,
  profileName: string,
  examType: string,
  authToken: string,
  signal?: AbortSignal,
): Promise<ExtractionResult> {
  const prompt = `Analyze this content and extract a structured subject/topic breakdown for a study project called "${profileName}" (type: ${examType}).

Content:
${text.slice(0, 8000)}

Return ONLY valid JSON matching this exact schema (3-level hierarchy: Subject > Chapter > Topic):
{
  "examName": "${profileName}",
  "subjects": [
    {
      "name": "Subject Name",
      "weight": 30,
      "chapters": [
        {
          "name": "Chapter Name",
          "topics": [
            { "name": "Topic Name" }
          ]
        }
      ]
    }
  ]
}

Rules:
- 2-6 subjects
- 2-8 chapters per subject (major sections/units)
- 2-10 topics per chapter (specific concepts/skills)
- Topics should be specific enough to study independently
- Weights should estimate relative importance and sum to 100
- Use clear, concise names
- If the content is vague, infer reasonable structure from domain knowledge`

  const response = await streamChat({
    messages: [{ role: 'user', content: prompt }],
    system: 'You are a curriculum analysis expert. Extract a 3-level hierarchy: subjects > chapters > topics. IMPORTANT: Return only valid JSON with English key names (subjects, chapters, topics, name, weight) even if the content is in another language. Names can be in the original language.',
    tools: [],
    authToken,
    maxTokens: 16384,
    signal,
  })

  const responseText = response.content
    .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
    .map(c => c.text)
    .join('')
    .replace(/```json\s*/g, '')
    .replace(/```\s*/g, '')

  const jsonMatch = responseText.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Failed to parse extraction response')

  const parsed = JSON.parse(jsonMatch[0])

  // Handle French key names
  const subjects: ExtractionResult['subjects'] =
    parsed.subjects ?? parsed.matières ?? parsed.matieres ?? parsed.sujets ?? []

  if (!Array.isArray(subjects) || subjects.length === 0) {
    throw new Error('Invalid extraction result: no subjects found')
  }

  // Normalize keys and handle 3-level hierarchy
  for (const s of subjects) {
    const raw = s as Record<string, unknown>
    if (!s.chapters && raw.chapitres) s.chapters = raw.chapitres as ExtractedSubject['chapters']
    if (s.chapters && Array.isArray(s.chapters) && s.chapters.length > 0) {
      s.topics = s.chapters.flatMap(ch => ch.topics ?? [])
    }
    if (!s.chapters || s.chapters.length === 0) {
      if (!s.topics && raw.sujets) s.topics = raw.sujets as ExtractedSubject['topics']
      if (s.topics && s.topics.length > 0) {
        s.chapters = [{ name: 'General', topics: s.topics }]
      }
    }
    if (!s.topics) s.topics = []
  }

  return { ...parsed, subjects } as ExtractionResult
}

/** Streaming variant — emits subjects one-by-one via onSubject callback. */
export async function extractLandscapeFromTextStreaming(
  text: string,
  profileName: string,
  examType: string,
  authToken: string,
  onSubject: (subject: ExtractedSubject, index: number) => void,
  onStatus?: (message: string) => void,
  signal?: AbortSignal,
): Promise<ExtractionResult> {
  onStatus?.('Analyzing content...')

  const prompt = `Analyze this content and extract a structured subject/topic breakdown for a study project called "${profileName}" (type: ${examType}).

Content:
${text.slice(0, 8000)}

Return ONLY valid JSON matching this exact schema (3-level hierarchy: Subject > Chapter > Topic):
{
  "examName": "${profileName}",
  "subjects": [
    {
      "name": "Subject Name",
      "weight": 30,
      "chapters": [
        {
          "name": "Chapter Name",
          "topics": [
            { "name": "Topic Name" }
          ]
        }
      ]
    }
  ]
}

Rules:
- 2-6 subjects
- 2-8 chapters per subject (major sections/units)
- 2-10 topics per chapter (specific concepts/skills)
- Topics should be specific enough to study independently
- Weights should estimate relative importance and sum to 100
- Use clear, concise names
- If the content is vague, infer reasonable structure from domain knowledge`

  const extractor = createStreamExtractor<ExtractedSubject>('subjects', { onItem: onSubject })

  const response = await streamChat({
    messages: [{ role: 'user', content: prompt }],
    system: 'You are a curriculum analysis expert. Extract a 3-level hierarchy: subjects > chapters > topics. IMPORTANT: Return only valid JSON with English key names (subjects, chapters, topics, name, weight) even if the content is in another language. Names can be in the original language.',
    tools: [],
    authToken,
    maxTokens: 16384,
    onToken: extractor.feed,
    signal,
  })

  const subjects = extractor.finalize()

  // Extract examName from full response
  const responseText = response.content
    .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
    .map(c => c.text)
    .join('')

  let examName = profileName
  try {
    const clean = responseText.replace(/```json\s*/g, '').replace(/```\s*/g, '')
    const jsonMatch = clean.match(/\{[\s\S]*\}/)
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
