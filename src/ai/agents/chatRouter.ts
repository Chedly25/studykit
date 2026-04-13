/**
 * Chat router — automatically selects the best teaching approach
 * via a cheap fast-model call. Replaces manual socratic/explain-back mode toggling.
 */
import { callFastModel } from '../fastClient'
import type { Message } from '../types'
import type { StudentModel, TutoringEpisode } from '../../db/schema'

export type TeachingStyle = 'teach' | 'question' | 'diagnose' | 'encourage' | 'challenge'

export interface RoutingDecision {
  style: TeachingStyle
  addendum: string
}

const DEFAULT_DECISION: RoutingDecision = { style: 'teach', addendum: '' }

/**
 * Analyze the conversation and decide the best teaching approach.
 * Cheap call: ~200 input tokens, ~50 output tokens.
 * Returns default for short conversations (<=2 user messages).
 */
export async function routeChat(
  messages: Message[],
  studentModel: StudentModel | undefined,
  currentTopic: { name: string; mastery: number; confidence: number } | null,
  recentEpisodes: TutoringEpisode[],
  authToken: string,
): Promise<RoutingDecision> {
  // Skip routing for short conversations — not enough context
  const userMessages = messages.filter(m => m.role === 'user')
  if (userMessages.length < 3) return DEFAULT_DECISION

  try {
    // Build compact context for the router
    const lastMessages = messages
      .slice(-15)
      .filter(m => typeof m.content === 'string')
      .map(m => `${m.role}: ${(m.content as string).slice(0, 150)}`)
      .join('\n')

    const studentInfo = studentModel
      ? `Student personality: ${safeParse(studentModel.personalityNotes, []).slice(0, 3).join(', ') || 'unknown'}`
      : ''

    const topicInfo = currentTopic
      ? `Topic: ${currentTopic.name} (mastery: ${Math.round(currentTopic.mastery * 100)}%, confidence: ${Math.round(currentTopic.confidence * 100)}%)`
      : ''

    const episodeInfo = recentEpisodes.length > 0
      ? `Past patterns: ${recentEpisodes.slice(0, 3).map(e => e.description).join('; ')}`
      : ''

    const raw = await callFastModel(
      `Recent conversation:
${lastMessages}

${studentInfo}
${topicInfo}
${episodeInfo}

Pick ONE teaching approach for the AI's next response:
- "teach": Student needs explanation (new concept, low mastery)
- "question": Student should think actively (test understanding, active recall)
- "diagnose": Need to identify what the student knows/doesn't know
- "encourage": Student seems frustrated or anxious
- "challenge": Student is doing well, push harder with edge cases

Return JSON: { "style": "...", "addendum": "one-sentence instruction for the AI" }
Only JSON.`,
      'You are a teaching strategy selector. Return only valid JSON.',
      authToken,
      { maxTokens: 128 },
    )

    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) return DEFAULT_DECISION

    const parsed = JSON.parse(match[0]) as { style?: string; addendum?: string }
    const validStyles: TeachingStyle[] = ['teach', 'question', 'diagnose', 'encourage', 'challenge']
    const style = validStyles.includes(parsed.style as TeachingStyle)
      ? (parsed.style as TeachingStyle)
      : 'teach'

    return {
      style,
      addendum: typeof parsed.addendum === 'string' ? parsed.addendum : '',
    }
  } catch {
    return DEFAULT_DECISION
  }
}

function safeParse<T>(json: string | undefined | null, fallback: T): T {
  try { return JSON.parse(json || '') ?? fallback }
  catch { return fallback }
}
