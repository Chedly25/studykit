/**
 * React hook managing the daily study queue state and progression.
 */
import { useState, useCallback, useMemo, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { buildDailyQueue } from '../lib/dailyQueueEngine'
import { computeDailyRecommendations } from '../lib/studyRecommender'
import { computeFeedbackActions } from '../lib/feedbackLoopEngine'
import { computeErrorPatterns } from '../lib/errorPatterns'
import { getMiscalibratedTopicsFromRaw } from '../lib/calibration'
import type { Subject, Topic, Flashcard, Exercise, ConceptCard, QuestionResult } from '../db/schema'

const PROGRESS_KEY = (profileId: string, date: string) => `queue_progress_${profileId}_${date}`

interface QueueProgress {
  completedIds: string[]
  skippedIds: string[]
  currentIndex: number
}

export function useDailyQueue(examProfileId: string | undefined, timeAvailableMinutes?: number, cramMode = false) {
  const today = new Date().toISOString().slice(0, 10)

  // Load saved progress
  const savedKey = examProfileId ? PROGRESS_KEY(examProfileId, today) : ''
  const [progress, setProgress] = useState<QueueProgress>(() => {
    if (!savedKey) return { completedIds: [], skippedIds: [], currentIndex: 0 }
    try {
      const saved = localStorage.getItem(savedKey)
      return saved ? JSON.parse(saved) : { completedIds: [], skippedIds: [], currentIndex: 0 }
    } catch {
      return { completedIds: [], skippedIds: [], currentIndex: 0 }
    }
  })

  // Persist progress
  useEffect(() => {
    if (savedKey) {
      localStorage.setItem(savedKey, JSON.stringify(progress))
    }
  }, [progress, savedKey])

  const subjects = useLiveQuery(
    () => examProfileId
      ? db.subjects.where('examProfileId').equals(examProfileId).toArray()
      : Promise.resolve([] as Subject[]),
    [examProfileId]
  ) ?? []

  const topics = useLiveQuery(
    () => examProfileId
      ? db.topics.where('examProfileId').equals(examProfileId).toArray()
      : Promise.resolve([] as Topic[]),
    [examProfileId]
  ) ?? []

  const profile = useLiveQuery(
    () => examProfileId ? db.examProfiles.get(examProfileId) : undefined,
    [examProfileId]
  )

  const dueFlashcards = useLiveQuery(async () => {
    if (!examProfileId) return [] as Flashcard[]
    if (cramMode) {
      // In cram mode, get ALL flashcards for this profile
      const decks = await db.flashcardDecks.where('examProfileId').equals(examProfileId).toArray()
      const deckIds = new Set(decks.map(d => d.id))
      const all = await db.flashcards.toArray()
      return all.filter(c => deckIds.has(c.deckId))
    }
    const profileDecks = await db.flashcardDecks.where('examProfileId').equals(examProfileId).toArray()
    const deckIds = new Set(profileDecks.map(d => d.id))
    return db.flashcards.where('nextReviewDate').belowOrEqual(today).filter(c => deckIds.has(c.deckId)).toArray()
  }, [examProfileId, cramMode, today]) ?? []

  const exercises = useLiveQuery(
    async () => examProfileId
      ? (await db.exercises.where('examProfileId').equals(examProfileId).toArray()).filter(e => !e.hidden)
      : [] as Exercise[],
    [examProfileId]
  ) ?? []

  const conceptCards = useLiveQuery(
    () => examProfileId
      ? db.conceptCards.where('examProfileId').equals(examProfileId).toArray()
      : Promise.resolve([] as ConceptCard[]),
    [examProfileId]
  ) ?? []

  const questionResults = useLiveQuery(
    () => examProfileId
      ? db.questionResults.where('examProfileId').equals(examProfileId).toArray()
      : Promise.resolve([] as QuestionResult[]),
    [examProfileId]
  ) ?? []

  // Build topic map
  const topicMap = useMemo(() => {
    const subjectMap = new Map(subjects.map(s => [s.id, s.name]))
    const map = new Map<string, { name: string; subjectName: string; mastery: number }>()
    for (const t of topics) {
      map.set(t.id, {
        name: t.name,
        subjectName: subjectMap.get(t.subjectId) ?? '',
        mastery: t.mastery,
      })
    }
    return map
  }, [topics, subjects])

  // Build queue
  const queue = useMemo(() => {
    if (topics.length === 0) return []

    const daysUntilExam = profile?.examDate
      ? Math.max(1, Math.ceil((new Date(profile.examDate).getTime() - Date.now()) / 86400000))
      : 30

    const dueByTopic = new Map<string, number>()
    for (const card of dueFlashcards) {
      if (card.topicId) {
        dueByTopic.set(card.topicId, (dueByTopic.get(card.topicId) ?? 0) + 1)
      }
    }

    const recommendations = computeDailyRecommendations({
      topics, subjects, daysUntilExam, dueFlashcardsByTopic: dueByTopic,
    })

    // Compute feedback actions
    let feedbackActions
    try {
      const errorPatterns = computeErrorPatterns(questionResults, topics)
      const calibrationData = getMiscalibratedTopicsFromRaw(topics, subjects)
      feedbackActions = computeFeedbackActions({
        recentResults: questionResults.slice(-50),
        errorPatterns,
        calibrationData,
        topics,
        subjects,
      })
    } catch { /* non-critical */ }

    return buildDailyQueue({
      dueFlashcards,
      recommendations,
      exercises,
      conceptCards,
      feedbackActions,
      timeAvailableMinutes,
      cramMode,
      topicMap,
    })
  }, [topics, subjects, dueFlashcards, exercises, conceptCards, questionResults, profile, timeAvailableMinutes, cramMode, topicMap])

  // Filter out completed/skipped
  const activeQueue = useMemo(() => {
    const doneSet = new Set([...progress.completedIds, ...progress.skippedIds])
    return queue.filter(item => !doneSet.has(item.id))
  }, [queue, progress])

  const currentItem = activeQueue[0] ?? null
  const completedCount = progress.completedIds.length
  const totalCount = queue.length
  const remainingMinutes = activeQueue.reduce((sum, item) => sum + item.estimatedMinutes, 0)

  const typeCounts = useMemo(() => {
    const counts = { flashcards: 0, exercises: 0, concepts: 0 }
    for (const item of queue) {
      if (item.type === 'flashcard-review') counts.flashcards++
      else if (item.type === 'exercise') counts.exercises++
      else if (item.type === 'concept-quiz') counts.concepts++
    }
    return counts
  }, [queue])

  const completeItem = useCallback((itemId: string) => {
    setProgress(prev => ({
      ...prev,
      completedIds: [...prev.completedIds, itemId],
      currentIndex: prev.currentIndex + 1,
    }))
  }, [])

  const skipItem = useCallback((itemId: string) => {
    setProgress(prev => ({
      ...prev,
      skippedIds: [...prev.skippedIds, itemId],
      currentIndex: prev.currentIndex + 1,
    }))
  }, [])

  const reset = useCallback(() => {
    setProgress({ completedIds: [], skippedIds: [], currentIndex: 0 })
  }, [])

  const isQueueEmpty = activeQueue.length === 0 && queue.length > 0

  return {
    queue,
    activeQueue,
    currentItem,
    completedCount,
    totalCount,
    remainingMinutes,
    typeCounts,
    completeItem,
    skipItem,
    reset,
    isQueueEmpty,
  }
}
