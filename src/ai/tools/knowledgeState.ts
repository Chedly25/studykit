/**
 * Read-only tools for querying the knowledge graph.
 */
import { db } from '../../db'
import type { Flashcard, Assignment } from '../../db/schema'
import { computeReadiness, getWeakTopics, computeStreak, computeWeeklyHours } from '../../lib/knowledgeGraph'
import { computeErrorPatterns } from '../../lib/errorPatterns'

export async function getKnowledgeGraph(examProfileId: string): Promise<string> {
  const subjects = await db.subjects.where('examProfileId').equals(examProfileId).sortBy('order')
  const topics = await db.topics.where('examProfileId').equals(examProfileId).toArray()

  const graph = subjects.map(s => {
    const subTopics = topics.filter(t => t.subjectId === s.id)
    return {
      subject: s.name,
      weight: s.weight,
      mastery: Math.round(s.mastery * 100),
      topics: subTopics.map(t => ({
        name: t.name,
        mastery: Math.round(t.mastery * 100),
        questionsAttempted: t.questionsAttempted,
        questionsCorrect: t.questionsCorrect,
        confidence: Math.round(t.confidence * 100),
      })),
    }
  })

  return JSON.stringify(graph, null, 2)
}

export async function getWeakTopicsTool(examProfileId: string, limit = 10): Promise<string> {
  const topics = await db.topics.where('examProfileId').equals(examProfileId).toArray()
  const weak = getWeakTopics(topics, limit)

  const subjects = await db.subjects.where('examProfileId').equals(examProfileId).toArray()
  const subjectMap = new Map(subjects.map(s => [s.id, s.name]))

  const result = weak.map(t => ({
    name: t.name,
    subject: subjectMap.get(t.subjectId) ?? 'Unknown',
    mastery: Math.round(t.mastery * 100),
    questionsAttempted: t.questionsAttempted,
    nextReviewDate: t.nextReviewDate,
  }))

  return JSON.stringify(result, null, 2)
}

export async function getReadinessScore(examProfileId: string): Promise<string> {
  const profile = await db.examProfiles.get(examProfileId)
  if (!profile) return JSON.stringify({ error: 'No active profile' })

  const subjects = await db.subjects.where('examProfileId').equals(examProfileId).toArray()
  const readiness = computeReadiness({ subjects, passingThreshold: profile.passingThreshold })

  return JSON.stringify({
    readiness,
    passingThreshold: profile.passingThreshold,
    examDate: profile.examDate,
    daysLeft: Math.max(0, Math.ceil((new Date(profile.examDate).getTime() - Date.now()) / 86400000)),
  })
}

export async function getStudyStats(examProfileId: string): Promise<string> {
  const logs = await db.dailyStudyLogs.where('examProfileId').equals(examProfileId).toArray()
  const sessions = await db.studySessions.where('examProfileId').equals(examProfileId).toArray()
  const questions = await db.questionResults.where('examProfileId').equals(examProfileId).toArray()

  const streak = computeStreak(logs)
  const weeklyHours = computeWeeklyHours(logs)
  const totalSessions = sessions.length
  const totalQuestions = questions.length
  const correctQuestions = questions.filter(q => q.isCorrect).length

  return JSON.stringify({
    streak,
    weeklyHours,
    totalSessions,
    totalQuestions,
    correctQuestions,
    accuracy: totalQuestions > 0 ? Math.round((correctQuestions / totalQuestions) * 100) : 0,
  })
}

export async function getDueFlashcards(examProfileId: string, topicId?: string): Promise<string> {
  const today = new Date().toISOString().slice(0, 10)
  let cards: Flashcard[]

  if (topicId) {
    cards = await db.flashcards
      .where('nextReviewDate')
      .belowOrEqual(today)
      .filter(c => c.topicId === topicId)
      .toArray()
  } else {
    // Scope to current profile's decks
    const profileDecks = await db.flashcardDecks
      .where('examProfileId').equals(examProfileId).toArray()
    const profileDeckIds = new Set(profileDecks.map(d => d.id))
    cards = await db.flashcards
      .where('nextReviewDate')
      .belowOrEqual(today)
      .filter(c => profileDeckIds.has(c.deckId))
      .toArray()
  }

  return JSON.stringify({
    count: cards.length,
    cards: cards.slice(0, 10).map(c => ({
      front: c.front,
      back: c.back,
      deckId: c.deckId,
      easeFactor: c.easeFactor,
    })),
  })
}

export async function getUpcomingDeadlines(examProfileId: string, days = 7): Promise<string> {
  const today = new Date().toISOString().slice(0, 10)
  const future = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10)

  // Get all assignments and filter
  const all = await db.assignments.toArray()
  const upcoming = all.filter((a: Assignment) =>
    a.status !== 'done' && a.dueDate >= today && a.dueDate <= future &&
    (a.examProfileId === examProfileId || !a.examProfileId)
  )

  return JSON.stringify(
    upcoming.map(a => ({
      title: a.title,
      dueDate: a.dueDate,
      priority: a.priority,
      status: a.status,
    }))
  )
}

export async function getFlashcardPerformance(examProfileId: string): Promise<string> {
  const decks = await db.flashcardDecks.where('examProfileId').equals(examProfileId).toArray()
  if (decks.length === 0) return JSON.stringify({ decks: [], message: 'No flashcard decks yet.' })

  const today = new Date().toISOString().slice(0, 10)
  const result = await Promise.all(decks.map(async deck => {
    const cards = await db.flashcards.where('deckId').equals(deck.id).toArray()
    const retained = cards.filter(c => c.easeFactor >= 2.5 && c.repetitions >= 2).length
    const due = cards.filter(c => c.nextReviewDate <= today).length
    const avgEF = cards.length > 0 ? cards.reduce((s, c) => s + c.easeFactor, 0) / cards.length : 2.5

    return {
      deckName: deck.name,
      deckId: deck.id,
      cardCount: cards.length,
      retentionRate: cards.length > 0 ? Math.round((retained / cards.length) * 100) : 0,
      dueCount: due,
      averageEaseFactor: Math.round(avgEF * 100) / 100,
    }
  }))

  return JSON.stringify({ decks: result }, null, 2)
}

export async function getErrorPatterns(examProfileId: string, topicName?: string): Promise<string> {
  const questionResults = await db.questionResults.where('examProfileId').equals(examProfileId).toArray()
  const topics = await db.topics.where('examProfileId').equals(examProfileId).toArray()

  let patterns = computeErrorPatterns(questionResults, topics)

  if (topicName) {
    patterns = patterns.filter(p => p.topicName.toLowerCase() === topicName.toLowerCase())
  }

  return JSON.stringify(patterns, null, 2)
}
