/**
 * Write tools — modify the student's data.
 */
import { db } from '../../db'
import type { FlashcardDeck, Flashcard, Assignment, QuestionResult, DailyStudyLog, Topic } from '../../db/schema'
import { computeDailyRecommendations } from '../../lib/studyRecommender'
import { recomputeTopicMastery, advanceTopicSRS } from '../../lib/topicMastery'
import { computeFeedbackActions } from '../../lib/feedbackLoopEngine'
import { computeErrorPatterns } from '../../lib/errorPatterns'
import { getMiscalibratedTopicsFromRaw } from '../../lib/calibration'
import { calculateSM2, modulateIntervalForMisconceptions } from '../../lib/spacedRepetition'

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

  // Update topic question stats
  const newAttempted = topic.questionsAttempted + 1
  const newCorrect = topic.questionsCorrect + (input.isCorrect ? 1 : 0)

  await db.topics.update(topic.id, {
    questionsAttempted: newAttempted,
    questionsCorrect: newCorrect,
  })

  // Recompute mastery using full 4-factor formula (also updates subject mastery)
  await recomputeTopicMastery(topic.id)
  // Advance topic SRS: quality 4 for correct, 1 for incorrect
  await advanceTopicSRS(topic.id, input.isCorrect ? 4 : 1)

  // Feedback loop: check for patterns that trigger review actions
  try {
    const last10 = await db.questionResults
      .where('topicId').equals(topic.id)
      .reverse().limit(10).toArray()
    const allTopics = await db.topics.where('examProfileId').equals(examProfileId).toArray()
    const allSubjects = await db.subjects.where('examProfileId').equals(examProfileId).toArray()
    const allResults = await db.questionResults.where('examProfileId').equals(examProfileId).toArray()
    const errorPatterns = computeErrorPatterns(allResults, allTopics)
    const calibrationData = getMiscalibratedTopicsFromRaw(allTopics, allSubjects)
    const feedbackActions = computeFeedbackActions({
      recentResults: last10,
      errorPatterns,
      calibrationData,
      topics: allTopics,
      subjects: allSubjects,
    })
    // Create notifications for high-priority actions
    for (const action of feedbackActions.filter(a => a.priority >= 4)) {
      const existingNotif = await db.notifications
        .where('examProfileId').equals(examProfileId)
        .filter(n => n.title.includes(action.topicName) && n.createdAt.startsWith(new Date().toISOString().slice(0, 10)))
        .count()
      if (existingNotif === 0) {
        await db.notifications.put({
          id: crypto.randomUUID(),
          examProfileId,
          type: 'performance-alert',
          title: `Review needed: ${action.topicName}`,
          message: action.reason,
          isRead: false,
          createdAt: new Date().toISOString(),
          actionUrl: action.type === 'queue-flashcards' ? '/flashcard-maker'
            : action.type === 'queue-exercises' ? '/exercises'
            : '/session',
        })
      }
    }
  } catch { /* feedback loop errors are non-critical */ }

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

  // Read back recomputed mastery for the response
  const updatedTopic = await db.topics.get(topic.id)
  return JSON.stringify({
    success: true,
    topicMastery: Math.round((updatedTopic?.mastery ?? 0) * 100),
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

  // Compute due flashcards by topic
  const today = new Date().toISOString().slice(0, 10)
  const dueCards = await db.flashcards.where('nextReviewDate').belowOrEqual(today).toArray()
  const dueByTopic = new Map<string, number>()
  for (const card of dueCards) {
    if (card.topicId) {
      dueByTopic.set(card.topicId, (dueByTopic.get(card.topicId) ?? 0) + 1)
    }
  }

  // Load today's study plan activities
  let todayPlanActivities: Array<{ topicName: string; completed: boolean }> | undefined
  const activePlan = await db.studyPlans
    .where('examProfileId').equals(examProfileId)
    .filter(p => p.isActive)
    .first()
  if (activePlan) {
    const planDayId = `${activePlan.id}:${today}`
    const planDay = await db.studyPlanDays.get(planDayId)
    if (planDay) {
      try {
        const activities = JSON.parse(planDay.activities) as Array<{ topicName: string; completed?: boolean }>
        todayPlanActivities = activities.map(a => ({ topicName: a.topicName, completed: a.completed ?? false }))
      } catch { /* ignore */ }
    }
  }

  // Load student model common mistakes
  let commonMistakes: string[] | undefined
  const studentModel = await db.studentModels.where('examProfileId').equals(examProfileId).first()
  if (studentModel?.commonMistakes) {
    try { commonMistakes = JSON.parse(studentModel.commonMistakes) } catch { /* ignore */ }
  }

  // Build prerequisite graph and mastery map
  const prerequisiteGraph = new Map<string, string[]>()
  const topicMasteryMap = new Map<string, number>()
  for (const t of topics) {
    topicMasteryMap.set(t.id, t.mastery)
    if (t.prerequisiteTopicIds && t.prerequisiteTopicIds.length > 0) {
      prerequisiteGraph.set(t.id, t.prerequisiteTopicIds)
    }
  }

  const recommendations = computeDailyRecommendations({
    topics,
    subjects,
    daysUntilExam: daysLeft,
    dueFlashcardsByTopic: dueByTopic,
    todayPlanActivities,
    commonMistakes,
    prerequisiteGraph: prerequisiteGraph.size > 0 ? prerequisiteGraph : undefined,
    topicMasteryMap,
  })

  return JSON.stringify({
    recommendation: {
      focusTopics: recommendations.map(r => ({
        name: r.topicName,
        subject: r.subjectName,
        mastery: Math.round(r.decayedMastery * 100),
        action: r.action,
        reason: r.reason,
        urgency: Math.round(r.score * 100),
      })),
      dueFlashcards: dueCards.length,
      daysLeft,
      suggestedSessionMinutes: Math.min(90, Math.max(25, Math.round(profile.weeklyTargetHours * 60 / 7))),
    },
  })
}

export async function startQuickReview(
  examProfileId: string,
  input: { topicName?: string; limit?: number }
): Promise<string> {
  const today = new Date().toISOString().slice(0, 10)
  const limit = input.limit ?? 5

  let cards: Flashcard[]
  if (input.topicName) {
    const topics = await db.topics.where('examProfileId').equals(examProfileId).toArray()
    const topic = topics.find((t: Topic) => t.name.toLowerCase() === input.topicName!.toLowerCase())
    if (!topic) return JSON.stringify({ error: `Topic "${input.topicName}" not found` })
    cards = await db.flashcards
      .where('nextReviewDate')
      .belowOrEqual(today)
      .filter(c => c.topicId === topic.id)
      .limit(limit)
      .toArray()
  } else {
    // Scope to current profile via deck ownership
    const profileDecks = await db.flashcardDecks.where('examProfileId').equals(examProfileId).toArray()
    const profileDeckIds = new Set(profileDecks.map(d => d.id))
    cards = await db.flashcards
      .where('nextReviewDate')
      .belowOrEqual(today)
      .filter(c => profileDeckIds.has(c.deckId))
      .limit(limit)
      .toArray()
  }

  if (cards.length === 0) {
    return JSON.stringify({ cards: [], message: 'No flashcards due for review right now!' })
  }

  // Get deck names for context
  const deckIds = [...new Set(cards.map(c => c.deckId))]
  const decks = await db.flashcardDecks.where('id').anyOf(deckIds).toArray()
  const deckMap = new Map(decks.map(d => [d.id, d.name]))

  return JSON.stringify({
    count: cards.length,
    cards: cards.map(c => ({
      id: c.id,
      front: c.front,
      back: c.back,
      deckName: deckMap.get(c.deckId) ?? 'Unknown',
      easeFactor: c.easeFactor,
      repetitions: c.repetitions,
    })),
    instructions: 'Present cards one at a time. Show the front, wait for the student to answer, then reveal the back. Use rateFlashcard to record their recall quality.',
  }, null, 2)
}

export async function rateFlashcard(
  examProfileId: string,
  input: { cardId: string; rating: number }
): Promise<string> {
  const card = await db.flashcards.get(input.cardId)
  if (!card) return JSON.stringify({ error: 'Flashcard not found' })

  const rating = Math.max(0, Math.min(5, input.rating))

  const baseResult = calculateSM2(rating, {
    id: card.id,
    front: card.front,
    back: card.back,
    easeFactor: card.easeFactor,
    interval: card.interval,
    repetitions: card.repetitions,
    nextReviewDate: card.nextReviewDate,
    lastRating: card.lastRating,
  })

  // Tighten interval if the card's parent topic has fresh, unresolved
  // misconceptions. See modulateIntervalForMisconceptions for the formula.
  let result = baseResult
  if (card.topicId) {
    const misconceptions = await db.misconceptions
      .where('[examProfileId+topicId]')
      .equals([examProfileId, card.topicId])
      .filter(m => !m.resolvedAt)
      .toArray()
    result = modulateIntervalForMisconceptions(baseResult, rating, misconceptions)
  }

  await db.flashcards.update(input.cardId, {
    easeFactor: result.easeFactor,
    interval: result.interval,
    repetitions: result.repetitions,
    lastRating: rating,
    nextReviewDate: result.nextReviewDate,
  })

  const ratingLabel = rating <= 2 ? 'Again' : rating === 3 ? 'Hard' : rating === 4 ? 'Good' : 'Easy'
  const tightened = result.interval !== baseResult.interval

  return JSON.stringify({
    success: true,
    rating: ratingLabel,
    nextReviewDate: result.nextReviewDate,
    newInterval: result.interval,
    misconceptionTightened: tightened,
  })
}
