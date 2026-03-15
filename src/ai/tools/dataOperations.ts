/**
 * Write tools — modify the student's data.
 */
import { db } from '../../db'
import type { FlashcardDeck, Flashcard, Assignment, QuestionResult, DailyStudyLog } from '../../db/schema'

export async function logQuestionResult(
  examProfileId: string,
  input: {
    topicName: string
    question: string
    userAnswer: string
    correctAnswer: string
    isCorrect: boolean
    difficulty?: number
    explanation?: string
    errorType?: string
  }
): Promise<string> {
  // Find topic by name
  const topics = await db.topics.where('examProfileId').equals(examProfileId).toArray()
  const topic = topics.find(t => t.name.toLowerCase() === input.topicName.toLowerCase())
  if (!topic) return JSON.stringify({ error: `Topic "${input.topicName}" not found` })

  // Log the result
  const result: QuestionResult = {
    id: crypto.randomUUID(),
    examProfileId,
    topicId: topic.id,
    question: input.question,
    userAnswer: input.userAnswer,
    correctAnswer: input.correctAnswer,
    isCorrect: input.isCorrect,
    difficulty: input.difficulty ?? 3,
    confidence: topic.confidence,
    format: 'multiple-choice',
    explanation: input.explanation ?? '',
    timestamp: new Date().toISOString(),
    errorType: input.isCorrect ? null : (input.errorType as 'recall' | 'conceptual' | 'application' | 'distractor' | null ?? null),
  }
  await db.questionResults.put(result)

  // Update topic stats
  const newAttempted = topic.questionsAttempted + 1
  const newCorrect = topic.questionsCorrect + (input.isCorrect ? 1 : 0)
  const newMastery = newAttempted > 0 ? newCorrect / newAttempted * 0.6 + topic.confidence * 0.4 : 0

  await db.topics.update(topic.id, {
    questionsAttempted: newAttempted,
    questionsCorrect: newCorrect,
    mastery: Math.max(0, Math.min(1, newMastery)),
  })

  // Update subject mastery
  const subjectTopics = await db.topics.where('subjectId').equals(topic.subjectId).toArray()
  const avgMastery = subjectTopics.reduce((s, t) => s + t.mastery, 0) / subjectTopics.length
  await db.subjects.update(topic.subjectId, { mastery: avgMastery })

  // Update daily log
  const today = new Date().toISOString().slice(0, 10)
  const logId = `${examProfileId}:${today}`
  const existingLog = await db.dailyStudyLogs.get(logId)
  if (existingLog) {
    await db.dailyStudyLogs.update(logId, {
      questionsAnswered: existingLog.questionsAnswered + 1,
      questionsCorrect: existingLog.questionsCorrect + (input.isCorrect ? 1 : 0),
    })
  } else {
    const log: DailyStudyLog = {
      id: logId,
      examProfileId,
      date: today,
      totalSeconds: 0,
      subjectBreakdown: [],
      questionsAnswered: 1,
      questionsCorrect: input.isCorrect ? 1 : 0,
    }
    await db.dailyStudyLogs.put(log)
  }

  return JSON.stringify({
    success: true,
    topicMastery: Math.round(newMastery * 100),
    questionsAttempted: newAttempted,
    questionsCorrect: newCorrect,
  })
}

export async function updateTopicConfidence(
  examProfileId: string,
  topicName: string,
  confidence: number
): Promise<string> {
  const topics = await db.topics.where('examProfileId').equals(examProfileId).toArray()
  const topic = topics.find(t => t.name.toLowerCase() === topicName.toLowerCase())
  if (!topic) return JSON.stringify({ error: `Topic "${topicName}" not found` })

  const clamped = Math.max(0, Math.min(1, confidence))
  await db.topics.update(topic.id, { confidence: clamped })

  return JSON.stringify({ success: true, topic: topic.name, confidence: clamped })
}

export async function createFlashcardDeck(
  examProfileId: string,
  input: {
    name: string
    topicName?: string
    cards: Array<{ front: string; back: string }>
  }
): Promise<string> {
  // Resolve topic
  let topicId: string | undefined
  if (input.topicName) {
    const topics = await db.topics.where('examProfileId').equals(examProfileId).toArray()
    const topic = topics.find(t => t.name.toLowerCase() === input.topicName!.toLowerCase())
    topicId = topic?.id
  }

  const deck: FlashcardDeck = {
    id: crypto.randomUUID(),
    examProfileId,
    topicId,
    name: input.name,
    createdAt: new Date().toISOString(),
  }
  await db.flashcardDecks.put(deck)

  const cards: Flashcard[] = input.cards.map(c => ({
    id: crypto.randomUUID(),
    deckId: deck.id,
    topicId,
    front: c.front,
    back: c.back,
    source: 'ai-generated' as const,
    easeFactor: 2.5,
    interval: 0,
    repetitions: 0,
    nextReviewDate: new Date().toISOString().slice(0, 10),
    lastRating: 0,
  }))
  await db.flashcards.bulkPut(cards)

  return JSON.stringify({
    success: true,
    deckId: deck.id,
    deckName: deck.name,
    cardCount: cards.length,
  })
}

export async function addAssignment(
  examProfileId: string,
  input: {
    title: string
    description?: string
    dueDate: string
    priority?: string
  }
): Promise<string> {
  const assignment: Assignment = {
    id: crypto.randomUUID(),
    examProfileId,
    title: input.title,
    description: input.description ?? '',
    dueDate: input.dueDate,
    priority: (input.priority as 'low' | 'medium' | 'high') ?? 'medium',
    status: 'todo',
    createdAt: new Date().toISOString(),
  }
  await db.assignments.put(assignment)

  return JSON.stringify({ success: true, id: assignment.id, title: assignment.title })
}

export async function getStudyRecommendation(examProfileId: string): Promise<string> {
  const profile = await db.examProfiles.get(examProfileId)
  if (!profile) return JSON.stringify({ error: 'No active profile' })

  const topics = await db.topics.where('examProfileId').equals(examProfileId).toArray()
  const subjects = await db.subjects.where('examProfileId').equals(examProfileId).toArray()

  const daysLeft = Math.max(1, Math.ceil((new Date(profile.examDate).getTime() - Date.now()) / 86400000))

  // Priority: low mastery + high weight subjects
  const subjectMap = new Map(subjects.map(s => [s.id, s]))
  const prioritized = [...topics]
    .map(t => {
      const subject = subjectMap.get(t.subjectId)
      const weight = subject?.weight ?? 0
      const urgency = (1 - t.mastery) * (weight / 100) * (1 + (daysLeft < 30 ? 0.5 : 0))
      return { ...t, urgency, subjectName: subject?.name ?? '' }
    })
    .sort((a, b) => b.urgency - a.urgency)
    .slice(0, 5)

  const today = new Date().toISOString().slice(0, 10)
  const dueCards = await db.flashcards.where('nextReviewDate').belowOrEqual(today).count()

  return JSON.stringify({
    recommendation: {
      focusTopics: prioritized.map(t => ({
        name: t.name,
        subject: t.subjectName,
        mastery: Math.round(t.mastery * 100),
        urgency: Math.round(t.urgency * 100),
      })),
      dueFlashcards: dueCards,
      daysLeft,
      suggestedSessionMinutes: Math.min(90, Math.max(25, Math.round(profile.weeklyTargetHours * 60 / 7))),
    },
  })
}
