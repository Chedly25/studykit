/**
 * Generates session insights by analyzing a conversation via AI.
 */
import { streamChat } from './client'
import { db } from '../db'
import type { SessionInsight } from '../db/schema'
import type { Message } from './types'

export async function generateSessionInsight(
  messages: Message[],
  examProfileId: string,
  conversationId: string,
  authToken: string,
): Promise<SessionInsight | null> {
  // Only run if conversation has >= 4 user messages
  const userMessages = messages.filter(m => m.role === 'user' && typeof m.content === 'string')
  if (userMessages.length < 4) return null

  // Build conversation transcript
  const transcript = messages
    .filter(m => typeof m.content === 'string')
    .map(m => `${m.role}: ${m.content}`)
    .join('\n')

  const prompt = `Analyze this tutoring conversation and return a JSON object with these fields:
- conceptsDiscussed: string[] - key concepts/topics discussed
- misconceptions: string[] - any misconceptions the student showed (empty if none)
- breakthroughs: string[] - moments where the student demonstrated understanding (empty if none)
- openQuestions: string[] - questions or topics left unresolved (empty if none)
- summary: string - 1-2 sentence summary of the session

Return ONLY valid JSON, no markdown or explanation.

Conversation:
${transcript}`

  try {
    const response = await streamChat({
      messages: [{ role: 'user', content: prompt }],
      system: 'You are a learning analytics assistant. Analyze tutoring conversations and return structured JSON insights.',
      tools: [],
      authToken,
    })

    const text = response.content
      .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
      .map(c => c.text)
      .join('')

    // Extract JSON from response (handle potential markdown wrapping)
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null

    const parsed = JSON.parse(jsonMatch[0]) as {
      conceptsDiscussed?: string[]
      misconceptions?: string[]
      breakthroughs?: string[]
      openQuestions?: string[]
      summary?: string
    }

    const insight: SessionInsight = {
      id: crypto.randomUUID(),
      examProfileId,
      conversationId,
      conceptsDiscussed: JSON.stringify(parsed.conceptsDiscussed ?? []),
      misconceptions: JSON.stringify(parsed.misconceptions ?? []),
      breakthroughs: JSON.stringify(parsed.breakthroughs ?? []),
      openQuestions: JSON.stringify(parsed.openQuestions ?? []),
      summary: parsed.summary ?? 'Session completed.',
      timestamp: new Date().toISOString(),
    }

    await db.sessionInsights.put(insight)
    return insight
  } catch {
    return null
  }
}
