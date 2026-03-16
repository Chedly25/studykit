/**
 * Memory tools — persistent student model + conversation history.
 */
import { db } from '../../db'
import type { StudentModel, ConversationSummary } from '../../db/schema'

function safeParse<T>(json: string | undefined | null, fallback: T): T {
  try { return JSON.parse(json || '') ?? fallback }
  catch { return fallback }
}

export async function getStudentModel(examProfileId: string): Promise<string> {
  const model = await db.studentModels.get(examProfileId)
  if (!model) {
    return JSON.stringify({ exists: false, message: 'No student model yet. Observe and record patterns as you interact.' })
  }

  return JSON.stringify({
    exists: true,
    learningStyle: safeParse(model.learningStyle, {}),
    commonMistakes: safeParse(model.commonMistakes, []),
    personalityNotes: safeParse(model.personalityNotes, []),
    preferredExplanations: safeParse(model.preferredExplanations, []),
    motivationTriggers: safeParse(model.motivationTriggers, []),
    updatedAt: model.updatedAt,
  }, null, 2)
}

export async function updateStudentModel(
  examProfileId: string,
  input: {
    learningStyle?: Record<string, unknown>
    commonMistakes?: string[]
    personalityNotes?: string[]
    preferredExplanations?: string[]
    motivationTriggers?: string[]
  }
): Promise<string> {
  const existing = await db.studentModels.get(examProfileId)

  // Merge with existing data (append arrays, merge objects)
  const merged: StudentModel = {
    id: examProfileId,
    examProfileId,
    learningStyle: JSON.stringify(
      input.learningStyle
        ? { ...safeParse(existing?.learningStyle, {}), ...input.learningStyle }
        : safeParse(existing?.learningStyle, {})
    ),
    commonMistakes: JSON.stringify(
      mergeArrays(safeParse(existing?.commonMistakes, []), input.commonMistakes)
    ),
    personalityNotes: JSON.stringify(
      mergeArrays(safeParse(existing?.personalityNotes, []), input.personalityNotes)
    ),
    preferredExplanations: JSON.stringify(
      mergeArrays(safeParse(existing?.preferredExplanations, []), input.preferredExplanations)
    ),
    motivationTriggers: JSON.stringify(
      mergeArrays(safeParse(existing?.motivationTriggers, []), input.motivationTriggers)
    ),
    updatedAt: new Date().toISOString(),
  }

  await db.studentModels.put(merged)
  return JSON.stringify({ success: true, message: 'Student model updated.' })
}

function mergeArrays(existing: string[], incoming?: string[], maxItems = 10): string[] {
  if (!incoming || incoming.length === 0) return existing.slice(0, maxItems)
  const combined = [...new Set([...existing, ...incoming])]
  return combined.slice(-maxItems)
}

export async function getConversationHistory(
  examProfileId: string,
  input: { keyword?: string; topicName?: string }
): Promise<string> {
  let summaries = await db.conversationSummaries
    .where('examProfileId')
    .equals(examProfileId)
    .toArray()

  // Filter by keyword/topic if provided
  if (input.keyword) {
    const kw = input.keyword.toLowerCase()
    summaries = summaries.filter(s => {
      const topics: string[] = safeParse(s.topicsCovered, [])
      const outcomes: string[] = safeParse(s.keyOutcomes, [])
      return topics.some(t => t.toLowerCase().includes(kw)) ||
        outcomes.some(o => o.toLowerCase().includes(kw))
    })
  }

  if (input.topicName) {
    const tn = input.topicName.toLowerCase()
    summaries = summaries.filter(s => {
      const topics: string[] = safeParse(s.topicsCovered, [])
      return topics.some(t => t.toLowerCase().includes(tn))
    })
  }

  // Sort by date descending, limit to 10
  summaries.sort((a, b) => b.sessionDate.localeCompare(a.sessionDate))
  const limited = summaries.slice(0, 10)

  return JSON.stringify(limited.map(s => ({
    conversationId: s.conversationId,
    topicsCovered: safeParse(s.topicsCovered, []),
    keyOutcomes: safeParse(s.keyOutcomes, []),
    masteryChanges: safeParse(s.masteryChanges, {}),
    sessionDate: s.sessionDate,
    durationEstimate: s.durationEstimate,
  })), null, 2)
}

export async function getRecentSessions(
  examProfileId: string,
  input: { limit?: number }
): Promise<string> {
  const limit = input.limit ?? 5
  const summaries = await db.conversationSummaries
    .where('examProfileId')
    .equals(examProfileId)
    .toArray()

  // Sort by date descending
  summaries.sort((a, b) => b.sessionDate.localeCompare(a.sessionDate))
  const limited = summaries.slice(0, limit)

  return JSON.stringify(limited.map(s => ({
    conversationId: s.conversationId,
    topicsCovered: safeParse(s.topicsCovered, []),
    keyOutcomes: safeParse(s.keyOutcomes, []),
    masteryChanges: safeParse(s.masteryChanges, {}),
    sessionDate: s.sessionDate,
    durationEstimate: s.durationEstimate,
  })), null, 2)
}
