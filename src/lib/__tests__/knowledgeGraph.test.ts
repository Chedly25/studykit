import { describe, it, expect } from 'vitest'
import {
  computeTopicMastery,
  decayedMastery,
  computeSubjectMastery,
  computeReadiness,
  getWeakTopics,
  getStrongTopics,
  isTopicLocked,
  computeStreak,
  computeWeeklyHours,
} from '../knowledgeGraph'
import type { Topic, Subject, Flashcard, DailyStudyLog } from '../../db/schema'

function makeTopic(overrides: Partial<Topic> = {}): Topic {
  return {
    id: 't1',
    subjectId: 's1',
    examProfileId: 'p1',
    name: 'Test Topic',
    mastery: 0.5,
    confidence: 0.5,
    questionsAttempted: 10,
    questionsCorrect: 7,
    easeFactor: 2.5,
    interval: 10,
    repetitions: 3,
    nextReviewDate: new Date(Date.now() + 86400000 * 5).toISOString().slice(0, 10),
    ...overrides,
  }
}

function makeFlashcard(overrides: Partial<Flashcard> = {}): Flashcard {
  return {
    id: 'f1',
    deckId: 'd1',
    front: 'Q',
    back: 'A',
    source: 'manual',
    easeFactor: 2.5,
    interval: 10,
    repetitions: 3,
    nextReviewDate: new Date().toISOString().slice(0, 10),
    lastRating: 4,
    ...overrides,
  }
}

describe('computeTopicMastery', () => {
  it('returns 0 for empty inputs', () => {
    const topic = makeTopic({ questionsAttempted: 0, questionsCorrect: 0, confidence: 0 })
    const mastery = computeTopicMastery({ topic, flashcards: [], questionResults: [] })
    expect(mastery).toBe(0)
  })

  it('weights flashcard retention at 0.3', () => {
    const topic = makeTopic({ questionsAttempted: 0, questionsCorrect: 0, confidence: 0 })
    // 2 mastered cards out of 2 = 100% retention → 0.3 * 1 = 0.3
    const cards = [
      makeFlashcard({ easeFactor: 2.5, repetitions: 2 }),
      makeFlashcard({ id: 'f2', easeFactor: 2.8, repetitions: 3 }),
    ]
    const mastery = computeTopicMastery({ topic, flashcards: cards, questionResults: [] })
    // Only flashcard component contributes (0.3) + recency (some value)
    expect(mastery).toBeGreaterThanOrEqual(0.3)
  })

  it('weights question accuracy at 0.4', () => {
    const topic = makeTopic({ questionsAttempted: 10, questionsCorrect: 10, confidence: 0 })
    const mastery = computeTopicMastery({ topic, flashcards: [], questionResults: [] })
    // 100% accuracy → 0.4 * 1 = 0.4
    expect(mastery).toBeGreaterThanOrEqual(0.4)
  })

  it('clamps result to 0-1', () => {
    const topic = makeTopic({ questionsAttempted: 10, questionsCorrect: 10, confidence: 1 })
    const cards = [makeFlashcard({ easeFactor: 3.0, repetitions: 5 })]
    const mastery = computeTopicMastery({ topic, flashcards: cards, questionResults: [] })
    expect(mastery).toBeLessThanOrEqual(1)
    expect(mastery).toBeGreaterThanOrEqual(0)
  })
})

describe('decayedMastery', () => {
  it('returns 0 for zero mastery', () => {
    expect(decayedMastery(makeTopic({ mastery: 0 }))).toBe(0)
  })

  it('returns original mastery if not overdue', () => {
    const future = new Date(Date.now() + 86400000 * 10).toISOString().slice(0, 10)
    const topic = makeTopic({ mastery: 0.8, nextReviewDate: future })
    expect(decayedMastery(topic)).toBe(0.8)
  })

  it('applies decay when overdue', () => {
    const past = new Date(Date.now() - 86400000 * 30).toISOString().slice(0, 10)
    const topic = makeTopic({ mastery: 0.9, nextReviewDate: past, interval: 5, easeFactor: 2.5 })
    const decayed = decayedMastery(topic)
    expect(decayed).toBeLessThan(0.9)
    expect(decayed).toBeGreaterThanOrEqual(0)
  })
})

describe('computeSubjectMastery', () => {
  it('returns average of topic masteries', () => {
    const topics = [
      makeTopic({ mastery: 0.8 }),
      makeTopic({ id: 't2', mastery: 0.4 }),
    ]
    expect(computeSubjectMastery(topics)).toBeCloseTo(0.6)
  })

  it('returns 0 for no topics', () => {
    expect(computeSubjectMastery([])).toBe(0)
  })
})

describe('computeReadiness', () => {
  it('returns 0 for no subjects', () => {
    expect(computeReadiness({ subjects: [], passingThreshold: 70 })).toBe(0)
  })

  it('computes weighted mastery relative to threshold', () => {
    const subjects: Subject[] = [
      { id: 's1', examProfileId: 'p1', name: 'Math', weight: 50, mastery: 0.8, color: '#000', order: 0 },
      { id: 's2', examProfileId: 'p1', name: 'Phys', weight: 50, mastery: 0.6, color: '#000', order: 1 },
    ]
    const readiness = computeReadiness({ subjects, passingThreshold: 70 })
    // weighted mastery = (0.8*0.5 + 0.6*0.5) = 0.7
    // readiness = (0.7 / 0.7) * 100 = 100
    expect(readiness).toBe(100)
  })

  it('caps readiness at 100', () => {
    const subjects: Subject[] = [
      { id: 's1', examProfileId: 'p1', name: 'X', weight: 100, mastery: 1.0, color: '#000', order: 0 },
    ]
    const readiness = computeReadiness({ subjects, passingThreshold: 50 })
    expect(readiness).toBe(100)
  })
})

describe('getWeakTopics / getStrongTopics', () => {
  const topics = [
    makeTopic({ id: '1', mastery: 0.1 }),
    makeTopic({ id: '2', mastery: 0.9 }),
    makeTopic({ id: '3', mastery: 0.5 }),
  ]

  it('returns weakest topics first', () => {
    const weak = getWeakTopics(topics, 2)
    expect(weak[0].mastery).toBe(0.1)
    expect(weak).toHaveLength(2)
  })

  it('returns strongest topics first', () => {
    const strong = getStrongTopics(topics, 2)
    expect(strong[0].mastery).toBe(0.9)
    expect(strong).toHaveLength(2)
  })
})

describe('isTopicLocked', () => {
  it('returns unlocked when no prerequisites', () => {
    const topic = makeTopic({ prerequisiteTopicIds: [] })
    const result = isTopicLocked(topic, new Map())
    expect(result.locked).toBe(false)
  })

  it('returns locked when prerequisite is below threshold', () => {
    const topic = makeTopic({ prerequisiteTopicIds: ['prereq1'] })
    const masteryMap = new Map([['prereq1', 0.2]])
    const result = isTopicLocked(topic, masteryMap, 0.5)
    expect(result.locked).toBe(true)
    expect(result.blockingPrereqs).toContain('prereq1')
  })

  it('returns unlocked when prerequisite mastery meets threshold', () => {
    const topic = makeTopic({ prerequisiteTopicIds: ['prereq1'] })
    const masteryMap = new Map([['prereq1', 0.7]])
    const result = isTopicLocked(topic, masteryMap, 0.5)
    expect(result.locked).toBe(false)
  })
})

describe('computeStreak', () => {
  it('returns 0 for empty logs', () => {
    expect(computeStreak([]).streak).toBe(0)
  })

  it('counts consecutive days', () => {
    const today = new Date().toISOString().slice(0, 10)
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
    const dayBefore = new Date(Date.now() - 86400000 * 2).toISOString().slice(0, 10)

    const logs: DailyStudyLog[] = [
      { id: `p:${today}`, examProfileId: 'p', date: today, totalSeconds: 100, subjectBreakdown: [], questionsAnswered: 0, questionsCorrect: 0 },
      { id: `p:${yesterday}`, examProfileId: 'p', date: yesterday, totalSeconds: 100, subjectBreakdown: [], questionsAnswered: 0, questionsCorrect: 0 },
      { id: `p:${dayBefore}`, examProfileId: 'p', date: dayBefore, totalSeconds: 100, subjectBreakdown: [], questionsAnswered: 0, questionsCorrect: 0 },
    ]
    expect(computeStreak(logs).streak).toBe(3)
  })

  it('allows one freeze day', () => {
    const today = new Date().toISOString().slice(0, 10)
    const twoDaysAgo = new Date(Date.now() - 86400000 * 2).toISOString().slice(0, 10)

    const logs: DailyStudyLog[] = [
      { id: `p:${today}`, examProfileId: 'p', date: today, totalSeconds: 100, subjectBreakdown: [], questionsAnswered: 0, questionsCorrect: 0 },
      { id: `p:${twoDaysAgo}`, examProfileId: 'p', date: twoDaysAgo, totalSeconds: 100, subjectBreakdown: [], questionsAnswered: 0, questionsCorrect: 0 },
    ]
    const result = computeStreak(logs)
    expect(result.streak).toBe(2)
    expect(result.freezeUsed).toBe(true)
  })
})

describe('computeWeeklyHours', () => {
  it('sums only logs from past 7 days', () => {
    const today = new Date().toISOString().slice(0, 10)
    const oldDate = new Date(Date.now() - 86400000 * 10).toISOString().slice(0, 10)

    const logs: DailyStudyLog[] = [
      { id: `p:${today}`, examProfileId: 'p', date: today, totalSeconds: 3600, subjectBreakdown: [], questionsAnswered: 0, questionsCorrect: 0 },
      { id: `p:${oldDate}`, examProfileId: 'p', date: oldDate, totalSeconds: 7200, subjectBreakdown: [], questionsAnswered: 0, questionsCorrect: 0 },
    ]
    expect(computeWeeklyHours(logs)).toBe(1)
  })
})
