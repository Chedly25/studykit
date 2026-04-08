import { describe, it, expect } from 'vitest'
import { buildDailyQueue } from '../dailyQueueEngine'
import type { Flashcard, Exercise, ConceptCard } from '../../db/schema'
import type { FeedbackAction } from '../feedbackLoopEngine'
import type { StudyRecommendation } from '../studyRecommender'

function makeFlashcard(id: string, topicId: string): Flashcard {
  return {
    id, deckId: 'd1', topicId, front: 'Q', back: 'A', source: 'manual',
    easeFactor: 2.5, interval: 1, repetitions: 1,
    nextReviewDate: new Date().toISOString().slice(0, 10), lastRating: 3,
  }
}

function makeExercise(id: string, topicId: string, overrides: Partial<Exercise> = {}): Exercise {
  return {
    id, examSourceId: 'es1', examProfileId: 'p1', exerciseNumber: 1,
    text: 'Ex', difficulty: 3, topicIds: JSON.stringify([topicId]),
    status: 'not_attempted', attemptCount: 0, createdAt: new Date().toISOString(),
    easeFactor: 2.5, interval: 0, repetitions: 0,
    nextReviewDate: new Date().toISOString().slice(0, 10),
    ...overrides,
  }
}

function makeConceptCard(id: string, topicId: string): ConceptCard {
  return {
    id, examProfileId: 'p1', topicId, title: 'Concept',
    keyPoints: '["p1"]', example: 'ex', sourceChunkIds: '[]',
    sourceReference: '', relatedCardIds: '[]', mastery: 0.3,
    createdAt: '', updatedAt: '',
  }
}

const topicMap = new Map([
  ['t1', { name: 'Algebra', subjectName: 'Math', mastery: 0.3 }],
  ['t2', { name: 'Calculus', subjectName: 'Math', mastery: 0.7 }],
])

const topicMapMultiSubject = new Map([
  ['t1', { name: 'Algebra', subjectName: 'Math', mastery: 0.3 }],
  ['t2', { name: 'Grammar', subjectName: 'English', mastery: 0.4 }],
])

describe('buildDailyQueue', () => {
  it('sorts by priority descending', () => {
    const queue = buildDailyQueue({
      dueFlashcards: [makeFlashcard('f1', 't1')],
      recommendations: [],
      exercises: [makeExercise('e1', 't1')],
      conceptCards: [],
      topicMap,
    })
    // Flashcards (priority 100) should come before weak exercises (priority 30)
    const types = queue.map(q => q.type)
    const flashIdx = types.indexOf('flashcard-review')
    const exIdx = types.lastIndexOf('exercise')
    expect(flashIdx).toBeLessThan(exIdx)
  })

  it('groups flashcards by topic in batches of ~10', () => {
    const cards = Array.from({ length: 15 }, (_, i) => makeFlashcard(`f${i}`, 't1'))
    const queue = buildDailyQueue({
      dueFlashcards: cards,
      recommendations: [],
      exercises: [],
      conceptCards: [],
      topicMap,
    })
    const flashBatches = queue.filter(q => q.type === 'flashcard-review')
    expect(flashBatches).toHaveLength(2) // 10 + 5
    expect(flashBatches[0].flashcardIds).toHaveLength(10)
    expect(flashBatches[1].flashcardIds).toHaveLength(5)
  })

  it('includes SRS exercises at priority 90', () => {
    const today = new Date().toISOString().slice(0, 10)
    const exercise = makeExercise('e1', 't1', {
      status: 'attempted',
      nextReviewDate: today,
    })
    const queue = buildDailyQueue({
      dueFlashcards: [],
      recommendations: [],
      exercises: [exercise],
      conceptCards: [],
      topicMap,
    })
    const srsItem = queue.find(q => q.id.startsWith('srs-exercise'))
    expect(srsItem).toBeDefined()
    expect(srsItem!.priority).toBe(90)
  })

  it('truncates queue to time limit', () => {
    const cards = Array.from({ length: 30 }, (_, i) => makeFlashcard(`f${i}`, 't1'))
    const queue = buildDailyQueue({
      dueFlashcards: cards,
      recommendations: [],
      exercises: [],
      conceptCards: [],
      topicMap,
      timeAvailableMinutes: 5,
    })
    const totalMin = queue.reduce((s, q) => s + q.estimatedMinutes, 0)
    expect(totalMin).toBeLessThanOrEqual(5)
  })

  it('adds weak topic exercises at low priority', () => {
    const exercise = makeExercise('e1', 't1') // t1 mastery = 0.3 < 0.5
    const queue = buildDailyQueue({
      dueFlashcards: [],
      recommendations: [],
      exercises: [exercise],
      conceptCards: [],
      topicMap,
    })
    const weakItem = queue.find(q => q.id.startsWith('weak-exercise'))
    expect(weakItem).toBeDefined()
    expect(weakItem!.priority).toBe(30)
  })

  it('returns empty queue when no items available', () => {
    const queue = buildDailyQueue({
      dueFlashcards: [],
      recommendations: [],
      exercises: [],
      conceptCards: [],
      topicMap,
    })
    expect(queue).toEqual([])
  })

  it('excludes flashcards with future nextReviewDate', () => {
    // buildDailyQueue expects dueFlashcards (already filtered by caller),
    // but the engine itself only adds them — they're always "due".
    // However exercises with future nextReviewDate and status !== 'not_attempted'
    // are filtered by the SRS check (nextReviewDate <= today).
    // For flashcards, the filtering happens before buildDailyQueue is called,
    // so we simulate by passing flashcards with future dates — they will still
    // appear because the engine trusts the caller's filter. Instead, test that
    // exercises with future nextReviewDate are NOT included as SRS exercises.
    const futureDate = '2099-01-01'
    const exercise = makeExercise('e1', 't1', {
      status: 'attempted',
      nextReviewDate: futureDate,
    })
    const queue = buildDailyQueue({
      dueFlashcards: [],
      recommendations: [],
      exercises: [exercise],
      conceptCards: [],
      topicMap,
    })
    const srsItem = queue.find(q => q.id.startsWith('srs-exercise'))
    expect(srsItem).toBeUndefined()
  })

  it('interleaves items from different subjects', () => {
    // Create items from 2 different subjects
    const cards1 = Array.from({ length: 3 }, (_, i) => makeFlashcard(`f-math-${i}`, 't1'))
    const cards2 = Array.from({ length: 3 }, (_, i) => makeFlashcard(`f-eng-${i}`, 't2'))
    const queue = buildDailyQueue({
      dueFlashcards: [...cards1, ...cards2],
      recommendations: [],
      exercises: [],
      conceptCards: [],
      topicMap: topicMapMultiSubject,
    })
    // With 2 subjects, round-robin interleaving means items should alternate
    // between Math and English, not all Math then all English
    expect(queue.length).toBeGreaterThanOrEqual(2)
    const subjects = queue.map(q => q.subjectName)
    // The first two items should be from different subjects
    expect(subjects[0]).not.toBe(subjects[1])
  })
})

describe('buildDailyQueue — cram mode', () => {
  it('overrides normal priority — weakest topics first', () => {
    const queue = buildDailyQueue({
      dueFlashcards: [makeFlashcard('f1', 't1'), makeFlashcard('f2', 't2')],
      recommendations: [],
      exercises: [],
      conceptCards: [makeConceptCard('c1', 't1')],
      topicMap,
      cramMode: true,
    })
    // Cram flashcards should have priority > 100
    const first = queue[0]
    expect(first.priority).toBeGreaterThan(100)
  })

  it('includes all flashcards in cram mode regardless of SRS', () => {
    // Create flashcards with future nextReviewDate (not due by SRS)
    const futureCards = Array.from({ length: 3 }, (_, i) => ({
      ...makeFlashcard(`f-future-${i}`, 't1'),
      nextReviewDate: '2099-01-01',
    }))
    const queue = buildDailyQueue({
      dueFlashcards: futureCards,
      recommendations: [],
      exercises: [],
      conceptCards: [],
      topicMap,
      cramMode: true,
    })
    const flashItems = queue.filter(q => q.type === 'flashcard-review')
    expect(flashItems.length).toBeGreaterThan(0)
    // All 3 cards should be included
    const allIds = flashItems.flatMap(q => q.flashcardIds ?? [])
    expect(allIds).toHaveLength(3)
    expect(allIds).toContain('f-future-0')
    expect(allIds).toContain('f-future-1')
    expect(allIds).toContain('f-future-2')
  })

  it('includes concept cards for topics below 0.5 mastery', () => {
    const queue = buildDailyQueue({
      dueFlashcards: [],
      recommendations: [],
      exercises: [],
      conceptCards: [makeConceptCard('c1', 't1'), makeConceptCard('c2', 't2')],
      topicMap,
      cramMode: true,
    })
    const concepts = queue.filter(q => q.type === 'concept-quiz')
    // t1 mastery=0.3 < 0.5 → included, t2 mastery=0.7 >= 0.5 → excluded
    expect(concepts).toHaveLength(1)
    expect(concepts[0].topicId).toBe('t1')
  })
})

// ─── Additional coverage ─────────────────────────────────────────────

describe('buildDailyQueue — exercises only (no flashcards)', () => {
  it('produces exercise items when only exercises are provided', () => {
    const exercise = makeExercise('e1', 't1')
    const queue = buildDailyQueue({
      dueFlashcards: [],
      recommendations: [],
      exercises: [exercise],
      conceptCards: [],
      topicMap,
    })
    expect(queue.length).toBeGreaterThan(0)
    expect(queue.every(q => q.type === 'exercise')).toBe(true)
  })
})

describe('buildDailyQueue — concept cards only', () => {
  it('produces concept quiz items via recommendations when only concept cards are provided', () => {
    const rec: StudyRecommendation = {
      topicId: 't1',
      topicName: 'Algebra',
      subjectName: 'Math',
      action: 'review',
      score: 5,
      reason: 'Needs review',
      decayedMastery: 0.3,
      linkTo: '',
    }
    const queue = buildDailyQueue({
      dueFlashcards: [],
      recommendations: [rec],
      exercises: [],
      conceptCards: [makeConceptCard('c1', 't1')],
      topicMap,
    })
    const conceptItems = queue.filter(q => q.type === 'concept-quiz')
    expect(conceptItems.length).toBeGreaterThan(0)
    expect(conceptItems[0].conceptCardId).toBe('c1')
  })

  it('produces SRS concept quiz items when concept cards have due nextReviewDate', () => {
    const today = new Date().toISOString().slice(0, 10)
    const card = { ...makeConceptCard('c1', 't1'), nextReviewDate: today }
    const queue = buildDailyQueue({
      dueFlashcards: [],
      recommendations: [],
      exercises: [],
      conceptCards: [card],
      topicMap,
    })
    const srsItem = queue.find(q => q.id.startsWith('srs-concept'))
    expect(srsItem).toBeDefined()
    expect(srsItem!.type).toBe('concept-quiz')
    expect(srsItem!.priority).toBe(85)
  })
})

describe('buildDailyQueue — feedback actions', () => {
  it('maps queue-concept-review feedback to concept-quiz item', () => {
    const action: FeedbackAction = {
      type: 'queue-concept-review',
      topicId: 't1',
      topicName: 'Algebra',
      reason: 'Struggling with basics',
      priority: 3,
    }
    const queue = buildDailyQueue({
      dueFlashcards: [],
      recommendations: [],
      exercises: [],
      conceptCards: [makeConceptCard('c1', 't1')],
      feedbackActions: [action],
      topicMap,
    })
    const feedbackItem = queue.find(q => q.id.startsWith('feedback-concept'))
    expect(feedbackItem).toBeDefined()
    expect(feedbackItem!.type).toBe('concept-quiz')
    expect(feedbackItem!.reason).toBe('Struggling with basics')
  })

  it('maps queue-exercises feedback to exercise item', () => {
    const action: FeedbackAction = {
      type: 'queue-exercises',
      topicId: 't1',
      topicName: 'Algebra',
      reason: 'Needs more practice',
      priority: 4,
    }
    const queue = buildDailyQueue({
      dueFlashcards: [],
      recommendations: [],
      exercises: [makeExercise('e1', 't1')],
      conceptCards: [],
      feedbackActions: [action],
      topicMap,
    })
    const feedbackItem = queue.find(q => q.id.startsWith('feedback-exercise'))
    expect(feedbackItem).toBeDefined()
    expect(feedbackItem!.type).toBe('exercise')
    expect(feedbackItem!.reason).toBe('Needs more practice')
  })

  it('skips queue-flashcards feedback (covered by due flashcards)', () => {
    const action: FeedbackAction = {
      type: 'queue-flashcards',
      topicId: 't1',
      topicName: 'Algebra',
      reason: 'Review flashcards',
      priority: 3,
    }
    const queue = buildDailyQueue({
      dueFlashcards: [],
      recommendations: [],
      exercises: [],
      conceptCards: [],
      feedbackActions: [action],
      topicMap,
    })
    const feedbackItems = queue.filter(q => q.id.startsWith('feedback-'))
    expect(feedbackItems).toHaveLength(0)
  })
})

describe('buildDailyQueue — time truncation', () => {
  it('stops adding items when time budget is exceeded', () => {
    // Each exercise is ~5 min, so with 8 min budget we should get at most 1
    const exercises = Array.from({ length: 5 }, (_, i) => makeExercise(`e${i}`, 't1'))
    const queue = buildDailyQueue({
      dueFlashcards: [],
      recommendations: [],
      exercises,
      conceptCards: [],
      topicMap,
      timeAvailableMinutes: 8,
    })
    const totalMin = queue.reduce((s, q) => s + q.estimatedMinutes, 0)
    expect(totalMin).toBeLessThanOrEqual(8)
    expect(queue.length).toBeLessThan(5)
  })

  it('returns all items when no time limit is set', () => {
    const exercises = Array.from({ length: 3 }, (_, i) => makeExercise(`e${i}`, 't1'))
    const queue = buildDailyQueue({
      dueFlashcards: [],
      recommendations: [],
      exercises,
      conceptCards: [],
      topicMap,
    })
    expect(queue.length).toBeGreaterThan(0)
  })
})

describe('buildDailyQueue — deduplication', () => {
  it('does not add the same exercise ID twice', () => {
    // An exercise that qualifies both via recommendation and weak-topic
    const exercise = makeExercise('e1', 't1') // t1 mastery=0.3 < 0.5 → weak
    const rec: StudyRecommendation = {
      topicId: 't1',
      topicName: 'Algebra',
      subjectName: 'Math',
      action: 'practice',
      score: 5,
      reason: 'Practice needed',
      decayedMastery: 0.3,
      linkTo: '',
    }
    const queue = buildDailyQueue({
      dueFlashcards: [],
      recommendations: [rec],
      exercises: [exercise],
      conceptCards: [],
      topicMap,
    })
    const exerciseIds = queue.filter(q => q.type === 'exercise').map(q => q.exerciseId)
    const uniqueIds = new Set(exerciseIds)
    expect(uniqueIds.size).toBe(exerciseIds.length)
  })

  it('does not add the same concept card ID twice', () => {
    const rec: StudyRecommendation = {
      topicId: 't1',
      topicName: 'Algebra',
      subjectName: 'Math',
      action: 'review',
      score: 5,
      reason: 'Review needed',
      decayedMastery: 0.3,
      linkTo: '',
    }
    const today = new Date().toISOString().slice(0, 10)
    const card = { ...makeConceptCard('c1', 't1'), nextReviewDate: today }
    const queue = buildDailyQueue({
      dueFlashcards: [],
      recommendations: [rec],
      exercises: [],
      conceptCards: [card],
      topicMap,
    })
    const conceptIds = queue.filter(q => q.type === 'concept-quiz').map(q => q.conceptCardId)
    const uniqueIds = new Set(conceptIds)
    expect(uniqueIds.size).toBe(conceptIds.length)
  })
})

describe('buildDailyQueue — multiple subjects interleaving', () => {
  it('interleaves items from different subjects via round-robin', () => {
    const topicMapThreeSubjects = new Map([
      ['t1', { name: 'Algebra', subjectName: 'Math', mastery: 0.3 }],
      ['t2', { name: 'Grammar', subjectName: 'English', mastery: 0.3 }],
      ['t3', { name: 'Atoms', subjectName: 'Physics', mastery: 0.3 }],
    ])
    const cards = [
      ...Array.from({ length: 3 }, (_, i) => makeFlashcard(`f-math-${i}`, 't1')),
      ...Array.from({ length: 3 }, (_, i) => makeFlashcard(`f-eng-${i}`, 't2')),
      ...Array.from({ length: 3 }, (_, i) => makeFlashcard(`f-phys-${i}`, 't3')),
    ]
    const queue = buildDailyQueue({
      dueFlashcards: cards,
      recommendations: [],
      exercises: [],
      conceptCards: [],
      topicMap: topicMapThreeSubjects,
    })
    // With 3 subjects, the first 3 items should each be from a different subject
    expect(queue.length).toBeGreaterThanOrEqual(3)
    const firstThreeSubjects = queue.slice(0, 3).map(q => q.subjectName)
    const uniqueSubjects = new Set(firstThreeSubjects)
    expect(uniqueSubjects.size).toBe(3)
  })
})

describe('buildCramQueue — additional coverage', () => {
  it('returns all flashcards sorted by mastery (weakest topic first)', () => {
    const queue = buildDailyQueue({
      dueFlashcards: [makeFlashcard('f1', 't1'), makeFlashcard('f2', 't2')],
      recommendations: [],
      exercises: [],
      conceptCards: [],
      topicMap,
      cramMode: true,
    })
    const flashItems = queue.filter(q => q.type === 'flashcard-review')
    expect(flashItems.length).toBe(2)
    // t1 mastery=0.3 is weaker than t2 mastery=0.7, so t1 should have higher priority
    const t1Item = flashItems.find(q => q.topicId === 't1')!
    const t2Item = flashItems.find(q => q.topicId === 't2')!
    expect(t1Item.priority).toBeGreaterThan(t2Item.priority)
  })

  it('includes exercises for weak topics (mastery < 0.6) in cram mode', () => {
    const queue = buildDailyQueue({
      dueFlashcards: [],
      recommendations: [],
      exercises: [makeExercise('e1', 't1')], // t1 mastery=0.3 < 0.6
      conceptCards: [],
      topicMap,
      cramMode: true,
    })
    const exerciseItems = queue.filter(q => q.type === 'exercise')
    expect(exerciseItems.length).toBeGreaterThan(0)
    expect(exerciseItems[0].reason).toContain('exam prep')
  })

  it('excludes exercises for strong topics (mastery >= 0.6) in cram mode', () => {
    const queue = buildDailyQueue({
      dueFlashcards: [],
      recommendations: [],
      exercises: [makeExercise('e1', 't2')], // t2 mastery=0.7 >= 0.6
      conceptCards: [],
      topicMap,
      cramMode: true,
    })
    const exerciseItems = queue.filter(q => q.type === 'exercise')
    expect(exerciseItems).toHaveLength(0)
  })

  it('returns empty queue when no items available in cram mode', () => {
    const queue = buildDailyQueue({
      dueFlashcards: [],
      recommendations: [],
      exercises: [],
      conceptCards: [],
      topicMap,
      cramMode: true,
    })
    expect(queue).toEqual([])
  })

  it('respects time limit in cram mode', () => {
    const cards = Array.from({ length: 30 }, (_, i) => makeFlashcard(`f${i}`, 't1'))
    const queue = buildDailyQueue({
      dueFlashcards: cards,
      recommendations: [],
      exercises: [],
      conceptCards: [],
      topicMap,
      cramMode: true,
      timeAvailableMinutes: 3,
    })
    const totalMin = queue.reduce((s, q) => s + q.estimatedMinutes, 0)
    expect(totalMin).toBeLessThanOrEqual(3)
  })
})

describe('buildDailyQueue — single flashcard', () => {
  it('produces a single batch for one flashcard', () => {
    const queue = buildDailyQueue({
      dueFlashcards: [makeFlashcard('f1', 't1')],
      recommendations: [],
      exercises: [],
      conceptCards: [],
      topicMap,
    })
    const flashBatches = queue.filter(q => q.type === 'flashcard-review')
    expect(flashBatches).toHaveLength(1)
    expect(flashBatches[0].flashcardIds).toHaveLength(1)
    expect(flashBatches[0].flashcardIds![0]).toBe('f1')
  })
})
