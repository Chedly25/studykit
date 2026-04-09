import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { computeReadinessScore } from '../readinessScore'
import type { Subject, Topic, Flashcard, QuestionResult, DailyStudyLog } from '../../db/schema'

function makeSubject(overrides: Partial<Subject> = {}): Subject {
  return { id: 's1', examProfileId: 'p1', name: 'Math', weight: 100, mastery: 0.5, order: 0, ...overrides } as Subject
}

function makeTopic(overrides: Partial<Topic> = {}): Topic {
  return {
    id: 't1', examProfileId: 'p1', subjectId: 's1', name: 'Algebra',
    mastery: 0.5, confidence: 0.5, questionsAttempted: 5, questionsCorrect: 3,
    order: 0, createdAt: '2024-01-01',
    srsNextReview: '', srsInterval: 1, srsEaseFactor: 2.5, srsRepetitions: 0,
    ...overrides,
  } as Topic
}

function makeFlashcard(overrides: Partial<Flashcard> = {}): Flashcard {
  return {
    id: 'fc1', deckId: 'd1', front: 'Q', back: 'A',
    easeFactor: 2.5, interval: 1, repetitions: 2, nextReview: '2024-01-01',
    createdAt: '2024-01-01',
    ...overrides,
  } as Flashcard
}

function makeQR(overrides: Partial<QuestionResult> = {}): QuestionResult {
  return {
    id: 'qr1', examProfileId: 'p1', topicId: 't1',
    isCorrect: true, timestamp: '2024-01-01T00:00:00Z',
    ...overrides,
  } as QuestionResult
}

function makeLog(overrides: Partial<DailyStudyLog> = {}): DailyStudyLog {
  return {
    id: 'dl1', examProfileId: 'p1', date: '2024-01-01', totalSeconds: 3600,
    ...overrides,
  } as DailyStudyLog
}

describe('computeReadinessScore', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('returns all zeros when no data', () => {
    const result = computeReadinessScore({
      subjects: [], topics: [], flashcards: [], questionResults: [],
      dailyLogs: [], passingThreshold: 0.6, weeklyTargetHours: 10,
    })
    expect(result.overall).toBe(0)
    expect(result.flashcardRetention).toBe(0)
    expect(result.questionAccuracy).toBe(0)
    expect(result.topicCoverage).toBe(0)
    expect(result.studyTimeVsTarget).toBe(0)
    expect(result.recency).toBe(0)
  })

  it('computes flashcard retention correctly', () => {
    const flashcards = [
      makeFlashcard({ easeFactor: 2.5, repetitions: 3 }),  // mastered
      makeFlashcard({ id: 'fc2', easeFactor: 1.5, repetitions: 1 }),  // not mastered
    ]
    const result = computeReadinessScore({
      subjects: [makeSubject()], topics: [], flashcards, questionResults: [],
      dailyLogs: [], passingThreshold: 0.6, weeklyTargetHours: 10,
    })
    expect(result.flashcardRetention).toBe(50)
  })

  it('computes question accuracy correctly', () => {
    const questionResults = [
      makeQR({ id: 'q1', isCorrect: true }),
      makeQR({ id: 'q2', isCorrect: true }),
      makeQR({ id: 'q3', isCorrect: false }),
    ]
    const result = computeReadinessScore({
      subjects: [makeSubject()], topics: [], flashcards: [], questionResults,
      dailyLogs: [], passingThreshold: 0.6, weeklyTargetHours: 10,
    })
    expect(result.questionAccuracy).toBe(67)
  })

  it('computes topic coverage', () => {
    const topics = [
      makeTopic({ id: 't1', questionsAttempted: 5 }),
      makeTopic({ id: 't2', questionsAttempted: 0, mastery: 0 }),
      makeTopic({ id: 't3', questionsAttempted: 0, mastery: 0.1 }),
    ]
    const result = computeReadinessScore({
      subjects: [makeSubject()], topics, flashcards: [], questionResults: [],
      dailyLogs: [], passingThreshold: 0.6, weeklyTargetHours: 10,
    })
    expect(result.topicCoverage).toBe(67) // 2/3
  })

  it('computes study time vs target', () => {
    vi.setSystemTime(new Date('2024-01-08T12:00:00Z'))
    const dailyLogs = [
      makeLog({ date: '2024-01-07', totalSeconds: 7200 }),  // 2h
      makeLog({ id: 'dl2', date: '2024-01-06', totalSeconds: 7200 }),  // 2h
    ]
    const result = computeReadinessScore({
      subjects: [makeSubject()], topics: [], flashcards: [], questionResults: [],
      dailyLogs, passingThreshold: 0.6, weeklyTargetHours: 8,
    })
    expect(result.studyTimeVsTarget).toBe(50)
  })

  it('caps study time at 100%', () => {
    vi.setSystemTime(new Date('2024-01-08T12:00:00Z'))
    const dailyLogs = [
      makeLog({ date: '2024-01-07', totalSeconds: 36000 }),  // 10h
    ]
    const result = computeReadinessScore({
      subjects: [makeSubject()], topics: [], flashcards: [], questionResults: [],
      dailyLogs, passingThreshold: 0.6, weeklyTargetHours: 5,
    })
    expect(result.studyTimeVsTarget).toBe(100)
  })

  it('computes recency based on last study date', () => {
    vi.setSystemTime(new Date('2024-01-08T12:00:00Z'))
    const dailyLogs = [makeLog({ date: '2024-01-08' })]
    const result = computeReadinessScore({
      subjects: [makeSubject()], topics: [], flashcards: [], questionResults: [],
      dailyLogs, passingThreshold: 0.6, weeklyTargetHours: 10,
    })
    expect(result.recency).toBeGreaterThan(80)
  })

  it('overall is weighted sum of components', () => {
    vi.setSystemTime(new Date('2024-01-08T12:00:00Z'))
    const result = computeReadinessScore({
      subjects: [makeSubject()],
      topics: [makeTopic({ questionsAttempted: 5 })],
      flashcards: [makeFlashcard()],
      questionResults: [makeQR()],
      dailyLogs: [makeLog({ date: '2024-01-08', totalSeconds: 36000 })],
      passingThreshold: 0.6,
      weeklyTargetHours: 10,
    })
    expect(result.overall).toBeGreaterThan(0)
    expect(result.overall).toBeLessThanOrEqual(100)
  })
})
