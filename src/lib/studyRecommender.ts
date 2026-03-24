/**
 * Pure function: compute daily study recommendations.
 * Combines decayed mastery, subject weight, exam urgency, activity state,
 * study plan awareness, student model signals, and prerequisite checks.
 */
import type { Topic, Subject } from '../db/schema'
import { decayedMastery } from './knowledgeGraph'
import type { FeedbackAction } from './feedbackLoopEngine'

export type RecommendationAction = 'read' | 'practice' | 'review' | 'explain-back' | 'flashcards'

export interface StudyRecommendation {
  topicId: string
  topicName: string
  subjectName: string
  action: RecommendationAction
  score: number
  reason: string
  decayedMastery: number
  linkTo: string
}

export interface RecommenderInput {
  topics: Topic[]
  subjects: Subject[]
  daysUntilExam: number
  dueFlashcardsByTopic: Map<string, number>
  // Optional enrichments (backward-compatible)
  todayPlanActivities?: Array<{ topicName: string; completed: boolean }>
  commonMistakes?: string[]
  prerequisiteGraph?: Map<string, string[]>  // topicId → prerequisite topicIds
  topicMasteryMap?: Map<string, number>      // topicId → mastery (for prereq check)
  feedbackActions?: FeedbackAction[]
}

export function computeDailyRecommendations(input: RecommenderInput): StudyRecommendation[] {
  const { topics, subjects, daysUntilExam, dueFlashcardsByTopic, todayPlanActivities, commonMistakes, prerequisiteGraph, topicMasteryMap, feedbackActions } = input
  const subjectMap = new Map(subjects.map(s => [s.id, s]))

  // Build plan lookup for quick access
  const planLookup = new Map<string, boolean>() // topicName (lowercase) → completed
  if (todayPlanActivities) {
    for (const act of todayPlanActivities) {
      planLookup.set(act.topicName.toLowerCase(), act.completed)
    }
  }

  const recommendations: StudyRecommendation[] = []

  for (const topic of topics) {
    const subject = subjectMap.get(topic.subjectId)
    if (!subject) continue
    if (!topic.name) continue // Skip topics with missing names (bad data)

    const dm = decayedMastery(topic)
    const subjectWeight = subject.weight / 100
    const examUrgency = 1 + Math.max(0, (30 - daysUntilExam) / 30)
    const dueCards = dueFlashcardsByTopic.get(topic.id) ?? 0

    // Activity multiplier
    let activityMultiplier = 1.0
    if (dueCards > 0) activityMultiplier = 1.5
    else if (topic.nextReviewDate <= new Date().toISOString().slice(0, 10)) activityMultiplier = 1.3

    let score = (1 - dm) * subjectWeight * examUrgency * activityMultiplier

    // Plan de-duplication: de-prioritize topics already scheduled in today's plan
    const planEntry = planLookup.get(topic.name.toLowerCase())
    if (planEntry !== undefined) {
      score *= planEntry ? 0.3 : 0.5 // completed → strong de-prioritize, pending → moderate
    }

    // Feedback action boost: topics with pending feedback actions get boosted
    if (feedbackActions) {
      const topicActions = feedbackActions.filter(a => a.topicId === topic.id)
      if (topicActions.length > 0) {
        const maxPriority = Math.max(...topicActions.map(a => a.priority))
        score += maxPriority * 0.3
      }
    }

    // Student model boost: topics matching common mistakes get a priority bump
    if (commonMistakes && commonMistakes.length > 0) {
      const topicLower = topic.name.toLowerCase()
      const hasMatchingMistake = commonMistakes.some(m => m.toLowerCase().includes(topicLower) || topicLower.includes(m.toLowerCase()))
      if (hasMatchingMistake) score *= 1.4
    }

    // Determine action
    let action: RecommendationAction
    let reason: string
    let linkTo: string

    const sessionLink = `/session?topic=${encodeURIComponent(topic.name)}`

    const weightPct = Math.round(subjectWeight * 100)

    if (dueCards > 0) {
      action = 'flashcards'
      reason = `${dueCards} flashcard${dueCards > 1 ? 's' : ''} due — mastery at ${Math.round(dm * 100)}%`
      linkTo = '/flashcard-maker'
    } else if (dm < 0.3) {
      action = 'read'
      reason = dm < topic.mastery
        ? `Mastery dropped to ${Math.round(dm * 100)}% — was ${Math.round(topic.mastery * 100)}%`
        : `Low mastery (${Math.round(dm * 100)}%) — ${weightPct}% of exam`
      linkTo = sessionLink
    } else if (dm < 0.6) {
      action = 'practice'
      reason = topic.questionsAttempted < 5
        ? `${Math.round(dm * 100)}% mastery — only ${topic.questionsAttempted} practice attempts`
        : `${Math.round(dm * 100)}% mastery — reinforce with practice`
      linkTo = `/exercises?topic=${encodeURIComponent(topic.name)}`
    } else if (dm > 0.7 && topic.questionsAttempted < 5) {
      action = 'explain-back'
      reason = `${Math.round(dm * 100)}% mastery but only ${topic.questionsAttempted} attempts — test deeper`
      linkTo = sessionLink
    } else {
      action = 'review'
      reason = `${Math.round(dm * 100)}% mastery — scheduled review`
      linkTo = sessionLink
    }

    recommendations.push({
      topicId: topic.id,
      topicName: topic.name,
      subjectName: subject.name,
      action,
      score,
      reason,
      decayedMastery: dm,
      linkTo,
    })
  }

  // Sort by score descending, take top 5
  recommendations.sort((a, b) => b.score - a.score)
  const top = recommendations.slice(0, 5)

  // Prerequisite redirect: if a recommended topic has unmastered prerequisites, swap it
  if (prerequisiteGraph && topicMasteryMap) {
    const topicMap = new Map(topics.map(t => [t.id, t]))
    for (let i = 0; i < top.length; i++) {
      const prereqIds = prerequisiteGraph.get(top[i].topicId)
      if (!prereqIds || prereqIds.length === 0) continue

      const weakPrereq = prereqIds.find(pid => (topicMasteryMap.get(pid) ?? 0) < 0.6)
      if (weakPrereq) {
        const prereqTopic = topicMap.get(weakPrereq)
        if (prereqTopic) {
          const prereqSubject = subjectMap.get(prereqTopic.subjectId)
          top[i] = {
            ...top[i],
            topicId: prereqTopic.id,
            topicName: prereqTopic.name,
            subjectName: prereqSubject?.name ?? top[i].subjectName,
            reason: `Master this prerequisite first (for ${top[i].topicName})`,
            action: 'read',
            linkTo: `/session?topic=${encodeURIComponent(prereqTopic.name)}`,
            decayedMastery: decayedMastery(prereqTopic),
          }
        }
      }
    }
  }

  return top
}
