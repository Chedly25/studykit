import type { QuestionResult, Topic, ErrorType } from '../db/schema'

export interface ErrorPatternSummary {
  topicName: string
  totalErrors: number
  recall: number
  conceptual: number
  application: number
  distractor: number
  unclassified: number
  dominantType: ErrorType | 'unclassified'
}

export function computeErrorPatterns(
  questionResults: QuestionResult[],
  topics: Topic[],
): ErrorPatternSummary[] {
  const topicMap = new Map(topics.map(t => [t.id, t.name]))
  const errorsByTopic = new Map<string, QuestionResult[]>()

  for (const qr of questionResults) {
    if (qr.isCorrect) continue
    const topicName = topicMap.get(qr.topicId) ?? 'Unknown'
    if (!errorsByTopic.has(topicName)) errorsByTopic.set(topicName, [])
    errorsByTopic.get(topicName)!.push(qr)
  }

  const summaries: ErrorPatternSummary[] = []

  for (const [topicName, errors] of errorsByTopic) {
    const counts = { recall: 0, conceptual: 0, application: 0, distractor: 0, unclassified: 0 }
    for (const e of errors) {
      if (e.errorType && e.errorType in counts) {
        counts[e.errorType as ErrorType]++
      } else {
        counts.unclassified++
      }
    }

    const max = Math.max(counts.recall, counts.conceptual, counts.application, counts.distractor, counts.unclassified)
    let dominantType: ErrorType | 'unclassified' = 'unclassified'
    if (counts.recall === max) dominantType = 'recall'
    else if (counts.conceptual === max) dominantType = 'conceptual'
    else if (counts.application === max) dominantType = 'application'
    else if (counts.distractor === max) dominantType = 'distractor'

    summaries.push({
      topicName,
      totalErrors: errors.length,
      ...counts,
      dominantType,
    })
  }

  return summaries.sort((a, b) => b.totalErrors - a.totalErrors)
}
