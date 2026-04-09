import { describe, it, expect } from 'vitest'
import { computeCalibrationData, getMiscalibratedTopics, getMiscalibratedTopicsFromRaw } from '../calibration'
import type { Topic, Subject } from '../../db/schema'

function makeTopic(overrides: Partial<Topic> = {}): Topic {
  return {
    id: 'topic-1', examProfileId: 'p1', subjectId: 's1', name: 'Math',
    mastery: 0.5, confidence: 0.5, questionsAttempted: 5, questionsCorrect: 3,
    order: 0, createdAt: '2024-01-01',
    srsNextReview: '', srsInterval: 1, srsEaseFactor: 2.5, srsRepetitions: 0,
    ...overrides,
  } as Topic
}

function makeSubject(overrides: Partial<Subject> = {}): Subject {
  return {
    id: 's1', examProfileId: 'p1', name: 'Science', weight: 50,
    mastery: 0.5, order: 0,
    ...overrides,
  } as Subject
}

describe('computeCalibrationData', () => {
  it('returns empty for no topics', () => {
    expect(computeCalibrationData([], [makeSubject()])).toEqual([])
  })

  it('filters out topics with zero questions attempted', () => {
    const topics = [makeTopic({ questionsAttempted: 0 })]
    expect(computeCalibrationData(topics, [makeSubject()])).toEqual([])
  })

  it('computes gap and overconfidence correctly', () => {
    const topics = [makeTopic({ confidence: 0.9, mastery: 0.3, questionsAttempted: 5 })]
    const result = computeCalibrationData(topics, [makeSubject()])
    expect(result).toHaveLength(1)
    expect(result[0].gap).toBeCloseTo(0.6)
    expect(result[0].isOverconfident).toBe(true)
    expect(result[0].isUnderconfident).toBe(false)
  })

  it('detects underconfidence', () => {
    const topics = [makeTopic({ confidence: 0.2, mastery: 0.8, questionsAttempted: 5 })]
    const result = computeCalibrationData(topics, [makeSubject()])
    expect(result[0].isUnderconfident).toBe(true)
    expect(result[0].isOverconfident).toBe(false)
  })

  it('maps subject names correctly', () => {
    const topics = [makeTopic({ subjectId: 's1', questionsAttempted: 1 })]
    const subjects = [makeSubject({ id: 's1', name: 'Physics' })]
    const result = computeCalibrationData(topics, subjects)
    expect(result[0].subjectName).toBe('Physics')
  })

  it('uses "Unknown" for missing subject', () => {
    const topics = [makeTopic({ subjectId: 'missing', questionsAttempted: 1 })]
    const result = computeCalibrationData(topics, [])
    expect(result[0].subjectName).toBe('Unknown')
  })
})

describe('getMiscalibratedTopics', () => {
  it('only includes topics with >= 3 attempts and gap > threshold', () => {
    const topics = [
      makeTopic({ id: 't1', questionsAttempted: 3, confidence: 0.9, mastery: 0.3 }),
      makeTopic({ id: 't2', questionsAttempted: 2, confidence: 0.9, mastery: 0.3 }),
      makeTopic({ id: 't3', questionsAttempted: 5, confidence: 0.5, mastery: 0.5 }),
    ]
    const result = getMiscalibratedTopics(topics, [makeSubject()])
    expect(result).toHaveLength(1)
    expect(result[0].topicName).toBe('Math')
  })
})

describe('getMiscalibratedTopicsFromRaw', () => {
  it('uses custom threshold for over/underconfidence flags', () => {
    const topics = [
      makeTopic({ id: 't1', questionsAttempted: 5, confidence: 0.6, mastery: 0.3 }),
    ]
    const result = getMiscalibratedTopicsFromRaw(topics, [makeSubject()], 0.25)
    expect(result).toHaveLength(1)
    expect(result[0].isOverconfident).toBe(true)
  })

  it('filters by absolute gap > threshold', () => {
    const topics = [
      makeTopic({ id: 't1', questionsAttempted: 5, confidence: 0.5, mastery: 0.45 }),
    ]
    const result = getMiscalibratedTopicsFromRaw(topics, [makeSubject()], 0.2)
    expect(result).toHaveLength(0)
  })
})
