/**
 * Automatic feedback loops — detect poor performance patterns and
 * generate targeted review actions.
 */
import type { QuestionResult, Topic, Subject } from '../db/schema'
import type { ErrorPatternSummary } from './errorPatterns'
import type { CalibrationData } from './calibration'

export interface FeedbackAction {
  type: 'queue-flashcards' | 'queue-exercises' | 'queue-concept-review' | 'trigger-reflection'
  topicId: string
  topicName: string
  reason: string
  priority: number // 1-5
}

interface FeedbackInput {
  recentResults: QuestionResult[]  // last 10 per topic
  errorPatterns: ErrorPatternSummary[]
  calibrationData: CalibrationData[]
  topics: Topic[]
  subjects: Subject[]
}

/**
 * Analyze recent performance and produce actionable feedback items.
 */
export function computeFeedbackActions(input: FeedbackInput): FeedbackAction[] {
  const { recentResults, errorPatterns, calibrationData, topics } = input
  const actions: FeedbackAction[] = []
  const seen = new Set<string>() // dedupe by topicId+type

  const topicMap = new Map(topics.map(t => [t.id, t]))

  // Group recent results by topic
  const resultsByTopic = new Map<string, QuestionResult[]>()
  for (const r of recentResults) {
    if (!resultsByTopic.has(r.topicId)) resultsByTopic.set(r.topicId, [])
    resultsByTopic.get(r.topicId)!.push(r)
  }

  for (const [topicId, results] of resultsByTopic) {
    const topic = topicMap.get(topicId)
    if (!topic) continue

    const sorted = [...results].sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    const last3 = sorted.slice(0, 3)
    const last5 = sorted.slice(0, 5)

    // Last 3 answers all incorrect → concept review (priority 5)
    if (last3.length >= 3 && last3.every(r => !r.isCorrect)) {
      const key = `${topicId}:queue-concept-review`
      if (!seen.has(key)) {
        seen.add(key)
        actions.push({
          type: 'queue-concept-review',
          topicId,
          topicName: topic.name,
          reason: 'Last 3 answers were incorrect — review core concepts',
          priority: 5,
        })
      }
    }

    // Score < 40% on last 5 → queue easier exercises (priority 4)
    if (last5.length >= 5) {
      const correct = last5.filter(r => r.isCorrect).length
      if (correct / last5.length < 0.4) {
        const key = `${topicId}:queue-exercises`
        if (!seen.has(key)) {
          seen.add(key)
          actions.push({
            type: 'queue-exercises',
            topicId,
            topicName: topic.name,
            reason: `Only ${Math.round((correct / last5.length) * 100)}% on last 5 questions — practice easier problems`,
            priority: 4,
          })
        }
      }
    }
  }

  // Error pattern dominant types
  for (const ep of errorPatterns) {
    const topic = topics.find(t => t.name === ep.topicName)
    if (!topic) continue

    if (ep.recall >= 3) {
      const key = `${topic.id}:queue-flashcards`
      if (!seen.has(key)) {
        seen.add(key)
        actions.push({
          type: 'queue-flashcards',
          topicId: topic.id,
          topicName: topic.name,
          reason: `${ep.recall} recall errors — flashcard review will help`,
          priority: 4,
        })
      }
    }

    if (ep.conceptual >= 3) {
      const key = `${topic.id}:queue-concept-review`
      if (!seen.has(key)) {
        seen.add(key)
        actions.push({
          type: 'queue-concept-review',
          topicId: topic.id,
          topicName: topic.name,
          reason: `${ep.conceptual} conceptual errors — study the theory`,
          priority: 4,
        })
      }
    }
  }

  // Overconfidence → trigger reflection
  for (const cd of calibrationData) {
    if (cd.isOverconfident) {
      const topic = topics.find(t => t.name === cd.topicName)
      if (!topic) continue
      const key = `${topic.id}:trigger-reflection`
      if (!seen.has(key)) {
        seen.add(key)
        actions.push({
          type: 'trigger-reflection',
          topicId: topic.id,
          topicName: topic.name,
          reason: `Overconfident in ${topic.name} — confidence ${Math.round(cd.confidence * 100)}% vs mastery ${Math.round(cd.mastery * 100)}%`,
          priority: 3,
        })
      }
    }
  }

  return actions.sort((a, b) => b.priority - a.priority)
}
