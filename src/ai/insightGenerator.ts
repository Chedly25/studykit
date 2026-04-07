/**
 * Generates session insights by analyzing a conversation via AI.
 */
import { streamChat } from './client'
import { db } from '../db'
import type { SessionInsight, ConversationSummary, StudentModel } from '../db/schema'
import type { Message } from './types'
import { recomputeTopicMastery } from '../lib/topicMastery'

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
- topicsCovered: string[] - specific topic names covered (for session history)
- keyOutcomes: string[] - what was achieved (e.g. "Understood recursion basics", "Practiced 5 MCQs on cell biology")
- masteryChanges: object - any mastery changes observed (e.g. {"recursion": "+15%", "cell biology": "-5%"})
- durationEstimate: number - estimated session duration in minutes
- studentObservations: object - new observations about the student with optional fields:
  - learningStyle: object (e.g. {"visual": true}) - only include if new patterns observed
  - commonMistakes: string[] - recurring mistake patterns
  - personalityNotes: string[] - interaction style observations
  - preferredExplanations: string[] - what explanation types worked best
  - motivationTriggers: string[] - what motivated or discouraged the student
- episodes: array - tutoring episodes to remember for future sessions, each with:
  - type: "breakthrough" | "struggle-pattern" | "strategy-effective" | "strategy-ineffective" | "preference-observed"
  - description: string - specific, actionable description (e.g. "The rows-as-functions analogy helped understand matrix multiplication")
  - topicName: string - topic name if identifiable
  - tags: string[] - relevant tags for searchability

Return ONLY valid JSON, no markdown or explanation.

Conversation:
${transcript}`

  try {
    const response = await streamChat({
      messages: [{ id: crypto.randomUUID(), role: 'user', content: prompt }],
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
      topicsCovered?: string[]
      keyOutcomes?: string[]
      masteryChanges?: Record<string, string>
      durationEstimate?: number
      studentObservations?: {
        learningStyle?: Record<string, unknown>
        commonMistakes?: string[]
        personalityNotes?: string[]
        preferredExplanations?: string[]
        motivationTriggers?: string[]
      }
      episodes?: Array<{
        type?: string
        description?: string
        topicName?: string
        tags?: string[]
      }>
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

    // Save conversation summary for session history (upsert by conversationId)
    const existingSummary = await db.conversationSummaries.where('conversationId').equals(conversationId).first()
    const summary: ConversationSummary = {
      id: existingSummary?.id ?? crypto.randomUUID(),
      examProfileId,
      conversationId,
      topicsCovered: JSON.stringify(parsed.topicsCovered ?? parsed.conceptsDiscussed ?? []),
      keyOutcomes: JSON.stringify(parsed.keyOutcomes ?? []),
      masteryChanges: JSON.stringify(parsed.masteryChanges ?? {}),
      sessionDate: new Date().toISOString().slice(0, 10),
      durationEstimate: parsed.durationEstimate ?? 0,
    }
    await db.conversationSummaries.put(summary)

    // Apply mastery changes to knowledge graph as confidence nudges
    const masteryChanges = parsed.masteryChanges ?? {}
    if (Object.keys(masteryChanges).length > 0) {
      const allTopics = await db.topics.where('examProfileId').equals(examProfileId).toArray()
      for (const [topicName, change] of Object.entries(masteryChanges)) {
        const matchedTopic = allTopics.find(t => t.name.toLowerCase() === topicName.toLowerCase())
        if (!matchedTopic) continue
        const rawDelta = parseFloat(String(change).replace(/[+%]/g, '')) / 100
        if (isNaN(rawDelta)) continue
        // Clamp delta to ±15% per observation to prevent LLM hallucination from spiking mastery
        const delta = Math.max(-0.15, Math.min(0.15, rawDelta))
        // Nudge confidence (the self-reported 15%-weighted factor) based on AI observation
        const newConfidence = Math.max(0, Math.min(1, matchedTopic.confidence + delta))
        await db.topics.update(matchedTopic.id, { confidence: newConfidence })
        await recomputeTopicMastery(matchedTopic.id)
      }
    }

    // Update student model if observations were extracted
    const obs = parsed.studentObservations
    if (obs) {
      const existing = await db.studentModels.get(examProfileId)
      const mergeArr = (prev: string[], next?: string[], max = 10): string[] => {
        if (!next || next.length === 0) return prev.slice(0, max)
        return [...new Set([...prev, ...next])].slice(-max)
      }

      const model: StudentModel = {
        id: examProfileId,
        examProfileId,
        learningStyle: JSON.stringify(
          obs.learningStyle
            ? { ...JSON.parse(existing?.learningStyle || '{}'), ...obs.learningStyle }
            : JSON.parse(existing?.learningStyle || '{}')
        ),
        commonMistakes: JSON.stringify(mergeArr(JSON.parse(existing?.commonMistakes || '[]'), obs.commonMistakes)),
        personalityNotes: JSON.stringify(mergeArr(JSON.parse(existing?.personalityNotes || '[]'), obs.personalityNotes)),
        preferredExplanations: JSON.stringify(mergeArr(JSON.parse(existing?.preferredExplanations || '[]'), obs.preferredExplanations)),
        motivationTriggers: JSON.stringify(mergeArr(JSON.parse(existing?.motivationTriggers || '[]'), obs.motivationTriggers)),
        updatedAt: new Date().toISOString(),
      }
      await db.studentModels.put(model)
    }

    // Record tutoring episodes to episodic memory
    if (parsed.episodes && Array.isArray(parsed.episodes)) {
      try {
        const { recordEpisode } = await import('./memory/episodicMemory')
        const profile = await db.examProfiles.get(examProfileId)
        const userId = profile?.userId ?? ''
        if (userId) {
          for (const ep of parsed.episodes.slice(0, 5)) {
            if (ep.description) {
              const validTypes = ['breakthrough', 'struggle-pattern', 'strategy-effective', 'strategy-ineffective', 'preference-observed', 'misconception-detected', 'mastery-change'] as const
              const epType = validTypes.includes(ep.type as typeof validTypes[number])
                ? (ep.type as typeof validTypes[number])
                : 'breakthrough'
              await recordEpisode({
                userId,
                examProfileId,
                topicName: ep.topicName,
                type: epType,
                description: ep.description,
                context: JSON.stringify({ conversationId, source: 'insight-generator' }),
                effectiveness: 0.5,
                tags: JSON.stringify(ep.tags ?? []),
              }).catch(() => {})
            }
          }
        }
      } catch { /* non-fatal */ }
    }

    return insight
  } catch {
    return null
  }
}
