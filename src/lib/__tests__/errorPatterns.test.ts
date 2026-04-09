import { describe, it, expect } from 'vitest'
import { computeErrorPatterns } from '../errorPatterns'
import type { QuestionResult, Topic } from '../../db/schema'

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
    isCorrect: false, timestamp: '2024-01-01',
    ...overrides,
  } as QuestionResult
}

describe('computeErrorPatterns', () => {
  it('returns empty for no results', () => {
    expect(computeErrorPatterns([], [makeTopic()])).toEqual([])
  })

  it('excludes correct answers', () => {
    const results = [makeResult({ isCorrect: true })]
    expect(computeErrorPatterns(results, [makeTopic()])).toEqual([])
  })

  it('groups errors by topic', () => {
    const results = [
      makeResult({ id: 'r1', topicId: 'topic-1', isCorrect: false }),
      makeResult({ id: 'r2', topicId: 'topic-2', isCorrect: false }),
    ]
    const topics = [
      makeTopic({ id: 'topic-1', name: 'Math' }),
      makeTopic({ id: 'topic-2', name: 'Physics' }),
    ]
    const patterns = computeErrorPatterns(results, topics)
    expect(patterns).toHaveLength(2)
  })

  it('counts error types correctly', () => {
    const results = [
      makeResult({ id: 'r1', errorType: 'recall' } as any),
      makeResult({ id: 'r2', errorType: 'recall' } as any),
      makeResult({ id: 'r3', errorType: 'conceptual' } as any),
    ]
    const patterns = computeErrorPatterns(results, [makeTopic()])
    expect(patterns[0].recall).toBe(2)
    expect(patterns[0].conceptual).toBe(1)
    expect(patterns[0].totalErrors).toBe(3)
  })

  it('determines dominant error type', () => {
    const results = [
      makeResult({ id: 'r1', errorType: 'application' } as any),
      makeResult({ id: 'r2', errorType: 'application' } as any),
      makeResult({ id: 'r3', errorType: 'recall' } as any),
    ]
    const patterns = computeErrorPatterns(results, [makeTopic()])
    expect(patterns[0].dominantType).toBe('application')
  })

  it('classifies unknown error types as unclassified', () => {
    const results = [
      makeResult({ id: 'r1' }), // no errorType
    ]
    const patterns = computeErrorPatterns(results, [makeTopic()])
    expect(patterns[0].unclassified).toBe(1)
  })

  it('sorts by total errors descending', () => {
    const results = [
      makeResult({ id: 'r1', topicId: 'topic-1' }),
      makeResult({ id: 'r2', topicId: 'topic-2' }),
      makeResult({ id: 'r3', topicId: 'topic-2' }),
    ]
    const topics = [
      makeTopic({ id: 'topic-1', name: 'Math' }),
      makeTopic({ id: 'topic-2', name: 'Physics' }),
    ]
    const patterns = computeErrorPatterns(results, topics)
    expect(patterns[0].topicName).toBe('Physics')
    expect(patterns[0].totalErrors).toBe(2)
  })

  it('uses "Unknown" for unmapped topic ids', () => {
    const results = [makeResult({ topicId: 'nonexistent' })]
    const patterns = computeErrorPatterns(results, [])
    expect(patterns[0].topicName).toBe('Unknown')
  })
})
