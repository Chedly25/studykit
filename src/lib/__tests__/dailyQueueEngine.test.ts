import { describe, it, expect } from 'vitest'
import { buildDailyQueue } from '../dailyQueueEngine'
import type { Flashcard, Exercise, ConceptCard } from '../../db/schema'

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
