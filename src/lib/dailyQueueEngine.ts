/**
 * Daily Queue Engine — builds a prioritized, unified study queue
 * combining flashcards, exercises, concept quizzes, and reading.
 */
import type { Flashcard, Exercise, ConceptCard } from '../db/schema'
import type { StudyRecommendation } from './studyRecommender'
import type { FeedbackAction } from './feedbackLoopEngine'

export type QueueItemType = 'flashcard-review' | 'exercise' | 'concept-quiz'

function safeParseIds(s: string | undefined): string[] {
  try { return JSON.parse(s || '[]') } catch { return [] }
}

export interface QueueItem {
  id: string
  type: QueueItemType
  topicId: string
  topicName: string
  subjectName: string
  priority: number
  estimatedMinutes: number
  reason?: string
  // Type-specific
  flashcardIds?: string[]
  exerciseId?: string
  conceptCardId?: string
  conceptCardTitle?: string
}

interface BuildQueueInput {
  dueFlashcards: Flashcard[]
  recommendations: StudyRecommendation[]
  exercises: Exercise[]
  conceptCards: ConceptCard[]
  feedbackActions?: FeedbackAction[]
  timeAvailableMinutes?: number
  cramMode?: boolean
  // topic/subject name maps
  topicMap: Map<string, { name: string; subjectName: string; mastery: number }>
}

/**
 * Build a prioritized daily study queue.
 * Priority order:
 * 1. Due flashcard reviews (grouped by topic, ~10 cards per batch, ~3 min each)
 * 2. Feedback loop actions
 * 3. Recommender top picks → exercises/concept quizzes
 * 4. Unattempted exercises on weak topics
 */
export function buildDailyQueue(input: BuildQueueInput): QueueItem[] {
  if (input.cramMode) {
    return buildCramQueue(input)
  }

  const queue: QueueItem[] = []

  // 1. Due flashcard reviews — group by topic, batches of ~10
  const cardsByTopic = new Map<string, Flashcard[]>()
  for (const card of input.dueFlashcards) {
    const tid = card.topicId ?? 'general'
    if (!cardsByTopic.has(tid)) cardsByTopic.set(tid, [])
    cardsByTopic.get(tid)!.push(card)
  }

  for (const [topicId, cards] of cardsByTopic) {
    const info = input.topicMap.get(topicId)
    const batchSize = 10
    for (let i = 0; i < cards.length; i += batchSize) {
      const batch = cards.slice(i, i + batchSize)
      queue.push({
        id: `flashcard-${topicId}-${i}`,
        type: 'flashcard-review',
        topicId,
        topicName: info?.name ?? 'General',
        subjectName: info?.subjectName ?? '',
        priority: 100,
        estimatedMinutes: Math.ceil(batch.length * 0.3),
        reason: `${batch.length} card${batch.length > 1 ? 's' : ''} due — mastery at ${Math.round((info?.mastery ?? 0) * 100)}%`,
        flashcardIds: batch.map(c => c.id),
      })
    }
  }

  // 1.5. Due exercises (SRS-scheduled, priority 90)
  const today = new Date().toISOString().slice(0, 10)
  const dueExercises = input.exercises.filter(e =>
    !e.hidden && e.nextReviewDate && e.nextReviewDate <= today && e.status !== 'not_attempted'
  )
  for (const exercise of dueExercises) {
    const topicIds: string[] = safeParseIds(exercise.topicIds)
    const tid = topicIds[0] ?? ''
    const info = input.topicMap.get(tid)
    queue.push({
      id: `srs-exercise-${exercise.id}`,
      type: 'exercise',
      topicId: tid,
      topicName: info?.name ?? 'Unknown',
      subjectName: info?.subjectName ?? '',
      priority: 90,
      estimatedMinutes: 5,
      reason: `Mastery at ${Math.round((info?.mastery ?? 0) * 100)}% — scheduled review`,
      exerciseId: exercise.id,
    })
  }

  // 1.75. Due concept cards (SRS-scheduled, priority 85)
  const dueConceptCards = input.conceptCards.filter(c =>
    c.nextReviewDate && c.nextReviewDate <= today
  )
  for (const card of dueConceptCards) {
    if (queue.some(q => q.conceptCardId === card.id)) continue
    const info = input.topicMap.get(card.topicId)
    queue.push({
      id: `srs-concept-${card.id}`,
      type: 'concept-quiz',
      topicId: card.topicId,
      topicName: info?.name ?? 'Unknown',
      subjectName: info?.subjectName ?? '',
      priority: 85,
      estimatedMinutes: 3,
      reason: `Mastery at ${Math.round((info?.mastery ?? 0) * 100)}% — scheduled review`,
      conceptCardId: card.id,
      conceptCardTitle: card.title,
    })
  }

  // 2. Feedback loop actions
  if (input.feedbackActions) {
    for (const action of input.feedbackActions) {
      const info = input.topicMap.get(action.topicId)
      if (action.type === 'queue-flashcards') {
        // Already covered by due flashcards above if they're due
        continue
      }
      if (action.type === 'queue-concept-review') {
        const card = input.conceptCards.find(c => c.topicId === action.topicId)
        if (card) {
          queue.push({
            id: `feedback-concept-${action.topicId}`,
            type: 'concept-quiz',
            topicId: action.topicId,
            topicName: info?.name ?? action.topicName,
            subjectName: info?.subjectName ?? '',
            priority: 80 + action.priority,
            estimatedMinutes: 3,
            reason: action.reason,
            conceptCardId: card.id,
            conceptCardTitle: card.title,
          })
        }
      }
      if (action.type === 'queue-exercises') {
        const exercise = input.exercises.find(e => {
          const topicIds: string[] = safeParseIds(e.topicIds)
          return topicIds.includes(action.topicId) && e.status === 'not_attempted'
        })
        if (exercise) {
          queue.push({
            id: `feedback-exercise-${exercise.id}`,
            type: 'exercise',
            topicId: action.topicId,
            topicName: info?.name ?? action.topicName,
            subjectName: info?.subjectName ?? '',
            priority: 80 + action.priority,
            estimatedMinutes: 5,
            reason: action.reason,
            exerciseId: exercise.id,
          })
        }
      }
    }
  }

  // 3. Recommender top picks → exercises/concept quizzes
  for (const rec of input.recommendations) {
    if (rec.action === 'practice') {
      const exercise = input.exercises.find(e => {
        const topicIds: string[] = safeParseIds(e.topicIds)
        return topicIds.includes(rec.topicId) && e.status !== 'completed'
      })
      if (exercise && !queue.some(q => q.exerciseId === exercise.id)) {
        queue.push({
          id: `rec-exercise-${exercise.id}`,
          type: 'exercise',
          topicId: rec.topicId,
          topicName: rec.topicName,
          subjectName: rec.subjectName,
          priority: 60,
          estimatedMinutes: 5,
          reason: rec.reason,
          exerciseId: exercise.id,
        })
      }
    } else if (rec.action === 'review' || rec.action === 'read') {
      const card = input.conceptCards.find(c => c.topicId === rec.topicId)
      if (card && !queue.some(q => q.conceptCardId === card.id)) {
        queue.push({
          id: `rec-concept-${card.id}`,
          type: 'concept-quiz',
          topicId: rec.topicId,
          topicName: rec.topicName,
          subjectName: rec.subjectName,
          priority: 50,
          estimatedMinutes: 3,
          reason: rec.reason,
          conceptCardId: card.id,
          conceptCardTitle: card.title,
        })
      }
    }
  }

  // 4. Unattempted exercises on weak topics
  const weakExercises = input.exercises
    .filter(e => {
      if (e.status !== 'not_attempted') return false
      const topicIds: string[] = safeParseIds(e.topicIds)
      return topicIds.some(tid => {
        const info = input.topicMap.get(tid)
        return info && info.mastery < 0.5
      })
    })
    .slice(0, 5)

  for (const exercise of weakExercises) {
    if (queue.some(q => q.exerciseId === exercise.id)) continue
    const topicIds: string[] = safeParseIds(exercise.topicIds)
    const tid = topicIds[0] ?? ''
    const info = input.topicMap.get(tid)
    queue.push({
      id: `weak-exercise-${exercise.id}`,
      type: 'exercise',
      topicId: tid,
      topicName: info?.name ?? 'Unknown',
      subjectName: info?.subjectName ?? '',
      priority: 30,
      estimatedMinutes: 5,
      reason: `Low mastery (${Math.round((info?.mastery ?? 0) * 100)}%) — needs practice`,
      exerciseId: exercise.id,
    })
  }

  // Sort by priority descending, then interleave by subject/type
  queue.sort((a, b) => b.priority - a.priority)
  const interleaved = interleaveQueue(queue)

  // Time truncation
  if (input.timeAvailableMinutes) {
    let totalMinutes = 0
    return interleaved.filter(item => {
      totalMinutes += item.estimatedMinutes
      return totalMinutes <= input.timeAvailableMinutes!
    })
  }

  return interleaved
}

/**
 * Cram mode queue — aggressive review for exam prep.
 * Weakest topics first, ALL flashcards (override SRS), unattempted exercises.
 */
function buildCramQueue(input: BuildQueueInput): QueueItem[] {
  const queue: QueueItem[] = []

  // Sort topics by mastery ascending (weakest first)
  const sortedTopics = [...input.topicMap.entries()]
    .sort((a, b) => a[1].mastery - b[1].mastery)

  // ALL flashcards, not just due ones — override SRS
  const allFlashcardsByTopic = new Map<string, Flashcard[]>()
  for (const card of input.dueFlashcards) {
    const tid = card.topicId ?? 'general'
    if (!allFlashcardsByTopic.has(tid)) allFlashcardsByTopic.set(tid, [])
    allFlashcardsByTopic.get(tid)!.push(card)
  }

  // Flashcards first (highest priority in cram)
  for (const [topicId, info] of sortedTopics) {
    const cards = allFlashcardsByTopic.get(topicId)
    if (!cards || cards.length === 0) continue
    const batchSize = 10
    for (let i = 0; i < cards.length; i += batchSize) {
      const batch = cards.slice(i, i + batchSize)
      queue.push({
        id: `cram-flashcard-${topicId}-${i}`,
        type: 'flashcard-review',
        topicId,
        topicName: info.name,
        subjectName: info.subjectName,
        priority: 100 + (1 - info.mastery) * 50,
        estimatedMinutes: Math.ceil(batch.length * 0.3),
        reason: 'Cram mode — review all cards',
        flashcardIds: batch.map(c => c.id),
      })
    }
  }

  // All non-completed exercises for weak topics (mastery < 0.6) — override SRS in cram
  for (const [topicId, info] of sortedTopics) {
    if (info.mastery >= 0.6) continue
    const topicExercises = input.exercises.filter(e => {
      const tids: string[] = safeParseIds(e.topicIds)
      return tids.includes(topicId) && e.status !== 'completed' && !e.hidden
    }).slice(0, 3)

    for (const exercise of topicExercises) {
      if (queue.some(q => q.exerciseId === exercise.id)) continue
      queue.push({
        id: `cram-exercise-${exercise.id}`,
        type: 'exercise',
        topicId,
        topicName: info.name,
        subjectName: info.subjectName,
        priority: 80 + (1 - info.mastery) * 20,
        estimatedMinutes: 5,
        reason: `Weak topic (${Math.round(info.mastery * 100)}%) — exam prep`,
        exerciseId: exercise.id,
      })
    }
  }

  // Concept cards for topics below 0.5 mastery
  for (const [topicId, info] of sortedTopics) {
    if (info.mastery >= 0.5) continue
    const card = input.conceptCards.find(c => c.topicId === topicId)
    if (card && !queue.some(q => q.conceptCardId === card.id)) {
      queue.push({
        id: `cram-concept-${card.id}`,
        type: 'concept-quiz',
        topicId,
        topicName: info.name,
        subjectName: info.subjectName,
        priority: 60,
        estimatedMinutes: 3,
        reason: 'Low mastery — refresh concepts',
        conceptCardId: card.id,
        conceptCardTitle: card.title,
      })
    }
  }

  queue.sort((a, b) => b.priority - a.priority)
  const interleaved = interleaveQueue(queue)

  if (input.timeAvailableMinutes) {
    let totalMinutes = 0
    return interleaved.filter(item => {
      totalMinutes += item.estimatedMinutes
      return totalMinutes <= input.timeAvailableMinutes!
    })
  }

  return interleaved
}

// ─── Interleaving ─────────────────────────────────────────────────────

/**
 * Interleave queue items by subject (round-robin).
 * If only 1 subject, interleave by type instead.
 * Within each group, priority order from the original sort is preserved.
 */
function interleaveQueue(items: QueueItem[]): QueueItem[] {
  if (items.length <= 2) return items

  const bySubject = new Map<string, QueueItem[]>()
  for (const item of items) {
    const key = item.subjectName || '_none'
    if (!bySubject.has(key)) bySubject.set(key, [])
    bySubject.get(key)!.push(item)
  }

  if (bySubject.size <= 1) {
    return interleaveByKey(items, item => item.type)
  }

  return roundRobin([...bySubject.values()])
}

function interleaveByKey(items: QueueItem[], keyFn: (item: QueueItem) => string): QueueItem[] {
  const groups = new Map<string, QueueItem[]>()
  for (const item of items) {
    const key = keyFn(item)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(item)
  }
  if (groups.size <= 1) return items
  return roundRobin([...groups.values()])
}

function roundRobin(groups: QueueItem[][]): QueueItem[] {
  const result: QueueItem[] = []
  const iterators = groups.map(g => ({ items: g, idx: 0 }))
  let placed = 0
  const total = groups.reduce((sum, g) => sum + g.length, 0)
  while (placed < total) {
    for (const iter of iterators) {
      if (iter.idx < iter.items.length) {
        result.push(iter.items[iter.idx++])
        placed++
      }
    }
  }
  return result
}
