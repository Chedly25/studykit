/**
 * Pure functions for computing mastery, readiness, and identifying weak areas.
 * No side effects — these operate on data arrays passed in.
 */
import type { Subject, Topic, Flashcard, QuestionResult, DailyStudyLog } from '../db/schema'

// ─── Topic Mastery ──────────────────────────────────────────────

export interface TopicMasteryInput {
  topic: Topic
  flashcards: Flashcard[]
  questionResults: QuestionResult[]
}

/**
 * Compute topic mastery as a weighted combination:
 * - Flashcard retention (0.3): % of cards with easeFactor >= 2.5
 * - Practice question accuracy (0.4): correct / attempted
 * - Recency (0.15): days since last activity (decays over 30 days)
 * - Self-reported confidence (0.15)
 */
export function computeTopicMastery(input: TopicMasteryInput): number {
  const { topic, flashcards, questionResults } = input

  // Flashcard retention
  let flashcardRetention = 0
  if (flashcards.length > 0) {
    const mastered = flashcards.filter(c => c.easeFactor >= 2.5 && c.repetitions >= 2)
    flashcardRetention = mastered.length / flashcards.length
  }

  // Question accuracy
  let questionAccuracy = 0
  if (topic.questionsAttempted > 0) {
    questionAccuracy = topic.questionsCorrect / topic.questionsAttempted
  }

  // Recency: find most recent activity
  let recencyScore = 0
  const now = Date.now()
  let lastActivity = 0

  if (questionResults.length > 0) {
    const latestQ = Math.max(...questionResults.map(q => new Date(q.timestamp).getTime()))
    lastActivity = Math.max(lastActivity, latestQ)
  }
  if (flashcards.length > 0) {
    const latestF = Math.max(...flashcards.map(f => {
      // Use nextReviewDate minus interval to approximate last review
      const reviewDate = new Date(f.nextReviewDate)
      reviewDate.setDate(reviewDate.getDate() - f.interval)
      return reviewDate.getTime()
    }))
    lastActivity = Math.max(lastActivity, latestF)
  }

  if (lastActivity > 0) {
    const daysSince = (now - lastActivity) / (24 * 60 * 60 * 1000)
    recencyScore = Math.max(0, 1 - daysSince / 30)
  }

  // Confidence
  const confidence = topic.confidence

  // Weighted sum
  const mastery = (
    flashcardRetention * 0.3 +
    questionAccuracy * 0.4 +
    recencyScore * 0.15 +
    confidence * 0.15
  )

  return Math.max(0, Math.min(1, mastery))
}

// ─── Subject Mastery ────────────────────────────────────────────

export function computeSubjectMastery(topics: Topic[]): number {
  if (topics.length === 0) return 0
  const total = topics.reduce((sum, t) => sum + t.mastery, 0)
  return total / topics.length
}

// ─── Overall Readiness ──────────────────────────────────────────

export interface ReadinessInput {
  subjects: Subject[]
  passingThreshold: number // 0-100
}

/**
 * Weighted average of subject masteries, compared to passing threshold.
 * Returns 0-100 representing % likelihood of passing.
 */
export function computeReadiness(input: ReadinessInput): number {
  const { subjects, passingThreshold } = input
  if (subjects.length === 0) return 0

  const totalWeight = subjects.reduce((sum, s) => sum + s.weight, 0)
  if (totalWeight === 0) return 0

  const weightedMastery = subjects.reduce(
    (sum, s) => sum + s.mastery * (s.weight / totalWeight),
    0
  )

  // Scale: mastery (0-1) vs threshold (0-1)
  const threshold = passingThreshold / 100
  if (threshold === 0) return weightedMastery * 100

  // Score relative to threshold, capped at 100
  const readiness = Math.min(100, (weightedMastery / threshold) * 100)
  return Math.round(readiness)
}

// ─── Weak Topics ────────────────────────────────────────────────

export function getWeakTopics(topics: Topic[], limit = 5): Topic[] {
  return [...topics]
    .sort((a, b) => a.mastery - b.mastery)
    .slice(0, limit)
}

export function getStrongTopics(topics: Topic[], limit = 5): Topic[] {
  return [...topics]
    .filter(t => t.mastery > 0)
    .sort((a, b) => b.mastery - a.mastery)
    .slice(0, limit)
}

// ─── Due Topics (SRS) ───────────────────────────────────────────

export function getDueTopics(topics: Topic[]): Topic[] {
  const today = new Date().toISOString().slice(0, 10)
  return topics.filter(t => t.nextReviewDate <= today)
}

// ─── Study Stats ────────────────────────────────────────────────

export function computeStreak(logs: DailyStudyLog[]): number {
  if (logs.length === 0) return 0

  const sorted = [...logs].sort((a, b) => b.date.localeCompare(a.date))
  const today = new Date().toISOString().slice(0, 10)
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)

  // Must have studied today or yesterday to have an active streak
  if (sorted[0].date !== today && sorted[0].date !== yesterday) return 0

  let streak = 1
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1].date)
    const curr = new Date(sorted[i].date)
    const diffDays = (prev.getTime() - curr.getTime()) / 86400000

    if (Math.abs(diffDays - 1) < 0.01) {
      streak++
    } else {
      break
    }
  }

  return streak
}

export function computeWeeklyHours(logs: DailyStudyLog[]): number {
  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)
  const weekAgoStr = weekAgo.toISOString().slice(0, 10)

  const thisWeek = logs.filter(l => l.date >= weekAgoStr)
  const totalSeconds = thisWeek.reduce((sum, l) => sum + l.totalSeconds, 0)
  return Number((totalSeconds / 3600).toFixed(1))
}
