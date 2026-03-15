/**
 * Enhanced readiness score computation.
 * Used by the dashboard and AI agent.
 */
import type { Subject, Topic, DailyStudyLog, Flashcard, QuestionResult } from '../db/schema'

export interface ReadinessComponents {
  flashcardRetention: number
  questionAccuracy: number
  topicCoverage: number
  studyTimeVsTarget: number
  recency: number
  overall: number
}

export function computeReadinessScore(opts: {
  subjects: Subject[]
  topics: Topic[]
  flashcards: Flashcard[]
  questionResults: QuestionResult[]
  dailyLogs: DailyStudyLog[]
  passingThreshold: number
  weeklyTargetHours: number
}): ReadinessComponents {
  const { topics, flashcards, questionResults, dailyLogs, weeklyTargetHours } = opts

  // Flashcard retention (0.2): % of cards with EF >= 2.5 and reps >= 2
  let flashcardRetention = 0
  if (flashcards.length > 0) {
    const mastered = flashcards.filter(c => c.easeFactor >= 2.5 && c.repetitions >= 2)
    flashcardRetention = mastered.length / flashcards.length
  }

  // Question accuracy (0.3)
  let questionAccuracy = 0
  if (questionResults.length > 0) {
    const correct = questionResults.filter(q => q.isCorrect).length
    questionAccuracy = correct / questionResults.length
  }

  // Topic coverage (0.2): % of topics with mastery > 0
  let topicCoverage = 0
  if (topics.length > 0) {
    const touched = topics.filter(t => t.questionsAttempted > 0 || t.mastery > 0)
    topicCoverage = touched.length / topics.length
  }

  // Study time vs target (0.15)
  let studyTimeVsTarget = 0
  if (weeklyTargetHours > 0 && dailyLogs.length > 0) {
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    const weekStr = weekAgo.toISOString().slice(0, 10)
    const weekLogs = dailyLogs.filter(l => l.date >= weekStr)
    const weekHours = weekLogs.reduce((s, l) => s + l.totalSeconds, 0) / 3600
    studyTimeVsTarget = Math.min(1, weekHours / weeklyTargetHours)
  }

  // Recency (0.15): have they studied in the last 3 days?
  let recency = 0
  if (dailyLogs.length > 0) {
    const sorted = [...dailyLogs].sort((a, b) => b.date.localeCompare(a.date))
    const daysSinceStudy = (Date.now() - new Date(sorted[0].date).getTime()) / 86400000
    recency = Math.max(0, 1 - daysSinceStudy / 7) // decays over a week
  }

  // Overall
  const overall = Math.round(
    (flashcardRetention * 0.2 +
    questionAccuracy * 0.3 +
    topicCoverage * 0.2 +
    studyTimeVsTarget * 0.15 +
    recency * 0.15) * 100
  )

  return {
    flashcardRetention: Math.round(flashcardRetention * 100),
    questionAccuracy: Math.round(questionAccuracy * 100),
    topicCoverage: Math.round(topicCoverage * 100),
    studyTimeVsTarget: Math.round(studyTimeVsTarget * 100),
    recency: Math.round(recency * 100),
    overall: Math.min(100, overall),
  }
}
