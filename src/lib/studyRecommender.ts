/**
 * Pure function: compute daily study recommendations.
 * Combines decayed mastery, subject weight, exam urgency, and activity state.
 */
import type { Topic, Subject, Flashcard } from '../db/schema'
import { decayedMastery } from './knowledgeGraph'

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

interface RecommenderInput {
  topics: Topic[]
  subjects: Subject[]
  daysUntilExam: number
  dueFlashcardsByTopic: Map<string, number>
}

export function computeDailyRecommendations(input: RecommenderInput): StudyRecommendation[] {
  const { topics, subjects, daysUntilExam, dueFlashcardsByTopic } = input
  const subjectMap = new Map(subjects.map(s => [s.id, s]))

  const recommendations: StudyRecommendation[] = []

  for (const topic of topics) {
    const subject = subjectMap.get(topic.subjectId)
    if (!subject) continue

    const dm = decayedMastery(topic)
    const subjectWeight = subject.weight / 100
    const examUrgency = 1 + Math.max(0, (30 - daysUntilExam) / 30)
    const dueCards = dueFlashcardsByTopic.get(topic.id) ?? 0

    // Activity multiplier
    let activityMultiplier = 1.0
    if (dueCards > 0) activityMultiplier = 1.5
    else if (topic.nextReviewDate <= new Date().toISOString().slice(0, 10)) activityMultiplier = 1.3

    const score = (1 - dm) * subjectWeight * examUrgency * activityMultiplier

    // Determine action
    let action: RecommendationAction
    let reason: string
    let linkTo: string

    if (dueCards > 0) {
      action = 'flashcards'
      reason = `${dueCards} flashcard${dueCards > 1 ? 's' : ''} due for review`
      linkTo = '/flashcard-maker'
    } else if (dm < 0.3) {
      action = 'read'
      reason = dm < topic.mastery
        ? `Mastery decayed to ${Math.round(dm * 100)}% — needs refreshing`
        : 'Low mastery — build foundation first'
      linkTo = '/sources'
    } else if (dm < 0.6) {
      action = 'practice'
      reason = 'Moderate mastery — reinforce with practice questions'
      linkTo = '/practice-exam'
    } else if (dm > 0.7 && topic.questionsAttempted < 5) {
      action = 'explain-back'
      reason = 'Good mastery — test deep understanding'
      linkTo = `/chat?mode=explain-back&topic=${encodeURIComponent(topic.name)}`
    } else {
      action = 'review'
      reason = 'Due for spaced review'
      linkTo = '/chat'
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
  return recommendations.slice(0, 5)
}
