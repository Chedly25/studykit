import { describe, it, expect } from 'vitest'
import { computeFeedbackActions } from '../feedbackLoopEngine'
import type { QuestionResult, Topic, Subject } from '../../db/schema'
import type { ErrorPatternSummary } from '../errorPatterns'
import type { CalibrationData } from '../calibration'

function makeTopic(overrides: Partial<Topic> = {}): Topic {
  return {
    id: 'topic-1', examProfileId: 'p1', subjectId: 's1', name: 'Math',
    mastery: 0.5, confidence: 0.5, questionsAttempted: 10, questionsCorrect: 5,
    order: 0, createdAt: '2024-01-01',
    srsNextReview: '', srsInterval: 1, srsEaseFactor: 2.5, srsRepetitions: 0,
    ...overrides,
  } as Topic
}

function makeResult(overrides: Partial<QuestionResult> = {}): QuestionResult {
  return {
    id: 'qr-1', examProfileId: 'p1', topicId: 'topic-1',
    isCorrect: false, timestamp: '2024-01-01T00:00:00Z',
    ...overrides,
  } as QuestionResult
}

const emptySubjects: Subject[] = []

describe('computeFeedbackActions', () => {
  it('returns empty when no results', () => {
    const actions = computeFeedbackActions({
      recentResults: [], errorPatterns: [], calibrationData: [],
      topics: [makeTopic()], subjects: emptySubjects,
    })
    expect(actions).toEqual([])
  })

  it('triggers concept review when last 3 answers are incorrect', () => {
    const results = [
      makeResult({ id: 'r1', timestamp: '2024-01-03', isCorrect: false }),
      makeResult({ id: 'r2', timestamp: '2024-01-02', isCorrect: false }),
      makeResult({ id: 'r3', timestamp: '2024-01-01', isCorrect: false }),
    ]
    const actions = computeFeedbackActions({
      recentResults: results, errorPatterns: [], calibrationData: [],
      topics: [makeTopic()], subjects: emptySubjects,
    })
    expect(actions.some(a => a.type === 'queue-concept-review' && a.priority === 5)).toBe(true)
  })

  it('does not trigger concept review when one of last 3 is correct', () => {
    const results = [
      makeResult({ id: 'r1', timestamp: '2024-01-03', isCorrect: false }),
      makeResult({ id: 'r2', timestamp: '2024-01-02', isCorrect: true }),
      makeResult({ id: 'r3', timestamp: '2024-01-01', isCorrect: false }),
    ]
    const actions = computeFeedbackActions({
      recentResults: results, errorPatterns: [], calibrationData: [],
      topics: [makeTopic()], subjects: emptySubjects,
    })
    expect(actions.some(a => a.type === 'queue-concept-review')).toBe(false)
  })

  it('triggers exercises when <40% on last 5', () => {
    const results = Array.from({ length: 5 }, (_, i) =>
      makeResult({ id: `r${i}`, timestamp: `2024-01-0${i + 1}`, isCorrect: i === 0 })
    )
    const actions = computeFeedbackActions({
      recentResults: results, errorPatterns: [], calibrationData: [],
      topics: [makeTopic()], subjects: emptySubjects,
    })
    expect(actions.some(a => a.type === 'queue-exercises' && a.priority === 4)).toBe(true)
  })

  it('does not trigger exercises when >= 40% on last 5', () => {
    const results = Array.from({ length: 5 }, (_, i) =>
      makeResult({ id: `r${i}`, timestamp: `2024-01-0${i + 1}`, isCorrect: i < 2 })
    )
    const actions = computeFeedbackActions({
      recentResults: results, errorPatterns: [], calibrationData: [],
      topics: [makeTopic()], subjects: emptySubjects,
    })
    expect(actions.some(a => a.type === 'queue-exercises')).toBe(false)
  })

  it('triggers flashcard review for recall errors from error patterns', () => {
    const ep: ErrorPatternSummary = {
      topicName: 'Math', totalErrors: 5, recall: 3, conceptual: 1,
      application: 0, distractor: 0, unclassified: 1, dominantType: 'recall',
    }
    const actions = computeFeedbackActions({
      recentResults: [], errorPatterns: [ep], calibrationData: [],
      topics: [makeTopic()], subjects: emptySubjects,
    })
    expect(actions.some(a => a.type === 'queue-flashcards')).toBe(true)
  })

  it('triggers concept review for conceptual errors from error patterns', () => {
    const ep: ErrorPatternSummary = {
      topicName: 'Math', totalErrors: 5, recall: 0, conceptual: 4,
      application: 0, distractor: 0, unclassified: 1, dominantType: 'conceptual',
    }
    const actions = computeFeedbackActions({
      recentResults: [], errorPatterns: [ep], calibrationData: [],
      topics: [makeTopic()], subjects: emptySubjects,
    })
    expect(actions.some(a => a.type === 'queue-concept-review')).toBe(true)
  })

  it('triggers reflection for overconfidence', () => {
    const cd: CalibrationData = {
      topicName: 'Math', subjectName: 'S', confidence: 0.9,
      mastery: 0.3, gap: 0.6, isOverconfident: true, isUnderconfident: false,
    }
    const actions = computeFeedbackActions({
      recentResults: [], errorPatterns: [], calibrationData: [cd],
      topics: [makeTopic()], subjects: emptySubjects,
    })
    expect(actions.some(a => a.type === 'trigger-reflection' && a.priority === 3)).toBe(true)
  })

  it('deduplicates actions by topicId+type', () => {
    const results = [
      makeResult({ id: 'r1', timestamp: '2024-01-03', isCorrect: false }),
      makeResult({ id: 'r2', timestamp: '2024-01-02', isCorrect: false }),
      makeResult({ id: 'r3', timestamp: '2024-01-01', isCorrect: false }),
    ]
    const ep: ErrorPatternSummary = {
      topicName: 'Math', totalErrors: 5, recall: 0, conceptual: 3,
      application: 0, distractor: 0, unclassified: 2, dominantType: 'conceptual',
    }
    const actions = computeFeedbackActions({
      recentResults: results, errorPatterns: [ep], calibrationData: [],
      topics: [makeTopic()], subjects: emptySubjects,
    })
    const conceptReviews = actions.filter(a => a.type === 'queue-concept-review')
    expect(conceptReviews).toHaveLength(1)
  })

  it('sorts actions by priority descending', () => {
    const results = [
      makeResult({ id: 'r1', timestamp: '2024-01-03', isCorrect: false }),
      makeResult({ id: 'r2', timestamp: '2024-01-02', isCorrect: false }),
      makeResult({ id: 'r3', timestamp: '2024-01-01', isCorrect: false }),
    ]
    const cd: CalibrationData = {
      topicName: 'Physics', subjectName: 'S', confidence: 0.9,
      mastery: 0.3, gap: 0.6, isOverconfident: true, isUnderconfident: false,
    }
    const actions = computeFeedbackActions({
      recentResults: results, errorPatterns: [],
      calibrationData: [cd],
      topics: [makeTopic(), makeTopic({ id: 'topic-2', name: 'Physics' })],
      subjects: emptySubjects,
    })
    for (let i = 1; i < actions.length; i++) {
      expect(actions[i - 1].priority).toBeGreaterThanOrEqual(actions[i].priority)
    }
  })
})
