/**
 * AI function: extract topics from free text, pasted content, or descriptions.
 * Returns the same ExtractionResult format as topicExtractor.ts for consistency.
 */
import { streamChat } from './client'
import type { ExtractionResult } from './topicExtractor'

export async function extractLandscapeFromText(
  text: string,
  profileName: string,
  examType: string,
  authToken: string,
  signal?: AbortSignal,
): Promise<ExtractionResult> {
  const prompt = `Analyze this content and extract a structured subject/topic breakdown for a study project called "${profileName}" (type: ${examType}).

Content:
${text.slice(0, 15000)}

Return ONLY valid JSON matching this exact schema:
{
  "examName": "${profileName}",
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
- Weights should estimate relative importance and sum to 100
- Use clear, concise topic names
- If the content is vague, infer reasonable structure from domain knowledge`

  const response = await streamChat({
    messages: [{ role: 'user', content: prompt }],
    system: 'You are a curriculum analysis expert. Extract structured subject/topic breakdowns from any content. Return only valid JSON.',
    tools: [],
    authToken,
    maxTokens: 4096,
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

  const parsed = JSON.parse(jsonMatch[0]) as ExtractionResult

  if (!parsed.subjects || !Array.isArray(parsed.subjects) || parsed.subjects.length === 0) {
    throw new Error('Invalid extraction result: no subjects found')
  }

  return parsed
}
