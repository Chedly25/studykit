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

// ─── Mastery Decay (Ebbinghaus) ─────────────────────────────────

/**
 * Compute decayed mastery using Ebbinghaus forgetting curve.
 * mastery_decayed = mastery * e^(-t/S)
 * where S = stability derived from SRS fields.
 * Computed on read — never overwrites stored mastery.
 */
export function decayedMastery(topic: Topic): number {
  if (topic.mastery === 0) return 0
  // No SRS decay for topics that haven't been reviewed yet (interval=0)
  if (topic.interval === 0) return topic.mastery

  // Stability: higher interval + higher ease = slower decay
  const S = Math.max(1, topic.interval * Math.sqrt(topic.easeFactor / 2.5))

  // Days since last review (when the topic was last due)
  const today = new Date()
  const nextReview = new Date(topic.nextReviewDate)
  const daysSinceReview = Math.max(0, (today.getTime() - nextReview.getTime()) / (24 * 60 * 60 * 1000))

  // If not overdue, no decay
  if (daysSinceReview <= 0) return topic.mastery

  const decay = Math.exp(-daysSinceReview / S)
  return Math.max(0, Math.min(1, topic.mastery * decay))
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

// ─── Prerequisite Enforcement ────────────────────────────────────

/**
 * Check if a topic is locked because its prerequisites aren't mastered.
 */
export function isTopicLocked(
  topic: Topic,
  topicMasteryMap: Map<string, number>,
  threshold = 0.5,
): { locked: boolean; blockingPrereqs: string[] } {
  if (!topic.prerequisiteTopicIds || topic.prerequisiteTopicIds.length === 0) {
    return { locked: false, blockingPrereqs: [] }
  }

  const blockingPrereqs = topic.prerequisiteTopicIds.filter(
    pid => (topicMasteryMap.get(pid) ?? 0) < threshold
  )

  return { locked: blockingPrereqs.length > 0, blockingPrereqs }
}

/**
 * Topological sort of prerequisite subgraph, filtered to unmastered topics.
 * Returns the path a student should follow to unlock a given topic.
 */
export function getUnlockPath(
  topicId: string,
  topics: Topic[],
  threshold = 0.5,
): Topic[] {
  const topicMap = new Map(topics.map(t => [t.id, t]))
  const visited = new Set<string>()
  const path: Topic[] = []

  function visit(id: string) {
    if (visited.has(id)) return
    visited.add(id)
    const t = topicMap.get(id)
    if (!t) return
    if (t.prerequisiteTopicIds) {
      for (const prereqId of t.prerequisiteTopicIds) {
        const prereq = topicMap.get(prereqId)
        if (prereq && prereq.mastery < threshold) {
          visit(prereqId)
        }
      }
    }
    if (t.mastery < threshold && t.id !== topicId) {
      path.push(t)
    }
  }

  visit(topicId)
  return path
}

// ─── Due Topics (SRS) ───────────────────────────────────────────

export function getDueTopics(topics: Topic[]): Topic[] {
  const today = new Date().toISOString().slice(0, 10)
  return topics.filter(t => t.nextReviewDate <= today)
}

// ─── Study Stats ────────────────────────────────────────────────

export function computeStreak(logs: DailyStudyLog[]): { streak: number; freezeUsed: boolean } {
  if (logs.length === 0) return { streak: 0, freezeUsed: false }

  const sorted = [...logs].sort((a, b) => b.date.localeCompare(a.date))
  // Use local date for "today" comparison (matches how dates are stored)
  const now = new Date()
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const yd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
  const yesterday = `${yd.getFullYear()}-${String(yd.getMonth() + 1).padStart(2, '0')}-${String(yd.getDate()).padStart(2, '0')}`

  // Must have studied today or yesterday to have an active streak
  if (sorted[0].date !== today && sorted[0].date !== yesterday) return { streak: 0, freezeUsed: false }

  let streak = 1
  let freezeUsed = false
  for (let i = 1; i < sorted.length; i++) {
    // Parse as UTC to avoid DST issues in date arithmetic
    const prev = new Date(sorted[i - 1].date + 'T00:00:00Z')
    const curr = new Date(sorted[i].date + 'T00:00:00Z')
    const diffDays = (prev.getTime() - curr.getTime()) / 86400000

    if (Math.abs(diffDays - 1) < 0.01) {
      streak++
    } else if (Math.abs(diffDays - 2) < 0.01 && !freezeUsed) {
      // Allow one gap day (streak freeze)
      streak++
      freezeUsed = true
    } else {
      break
    }
  }

  return { streak, freezeUsed }
}

export function computeWeeklyHours(logs: DailyStudyLog[]): number {
  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)
  const weekAgoStr = weekAgo.toISOString().slice(0, 10)

  const thisWeek = logs.filter(l => l.date >= weekAgoStr)
  const totalSeconds = thisWeek.reduce((sum, l) => sum + l.totalSeconds, 0)
  return Number((totalSeconds / 3600).toFixed(1))
}
