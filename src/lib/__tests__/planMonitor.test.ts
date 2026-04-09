import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { shouldReplan } from '../planMonitor'
import type { StudyPlan, StudyPlanDay, Topic } from '../../db/schema'

function makePlan(): StudyPlan {
  return { id: 'plan-1', examProfileId: 'p1', generatedAt: '2024-01-01', isActive: true, totalDays: 30 } as StudyPlan
}

function makePlanDay(overrides: Partial<StudyPlanDay> & { date: string; activities: string }): StudyPlanDay {
  return { id: `day-${overrides.date}`, planId: 'plan-1', ...overrides } as StudyPlanDay
}

function makeTopic(overrides: Partial<Topic> = {}): Topic {
  return {
    id: 't1', examProfileId: 'p1', subjectId: 's1', name: 'Math',
    mastery: 0.5, confidence: 0.5, questionsAttempted: 5, questionsCorrect: 3,
    order: 0, createdAt: '2024-01-01',
    srsNextReview: '', srsInterval: 1, srsEaseFactor: 2.5, srsRepetitions: 0,
    ...overrides,
  } as Topic
}

describe('shouldReplan', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('returns false when no issues', () => {
    vi.setSystemTime(new Date('2024-01-05'))
    const days = [
      makePlanDay({ date: '2024-01-03', activities: JSON.stringify([{ topicName: 'Math', completed: true }]) }),
      makePlanDay({ date: '2024-01-04', activities: JSON.stringify([{ topicName: 'Math', completed: true }]) }),
      makePlanDay({ date: '2024-01-06', activities: JSON.stringify([{ topicName: 'Math', completed: false }]) }),
    ]
    const result = shouldReplan(makePlan(), days, [makeTopic()], [])
    expect(result.shouldReplan).toBe(false)
  })

  it('triggers replan for 2+ consecutive skipped days', () => {
    vi.setSystemTime(new Date('2024-01-05'))
    const days = [
      makePlanDay({ date: '2024-01-03', activities: JSON.stringify([{ topicName: 'Math', completed: false }]) }),
      makePlanDay({ date: '2024-01-04', activities: JSON.stringify([{ topicName: 'Math', completed: false }]) }),
    ]
    const result = shouldReplan(makePlan(), days, [makeTopic()], [])
    expect(result.shouldReplan).toBe(true)
    expect(result.reason).toContain('2')
  })

  it('triggers replan when 50%+ remaining topics are mastered', () => {
    vi.setSystemTime(new Date('2024-01-05'))
    const days = [
      makePlanDay({ date: '2024-01-06', activities: JSON.stringify([{ topicName: 'Math', completed: false }, { topicName: 'Physics', completed: false }]) }),
    ]
    const topics = [
      makeTopic({ name: 'Math', mastery: 0.9 }),
      makeTopic({ id: 't2', name: 'Physics', mastery: 0.85 }),
    ]
    const result = shouldReplan(makePlan(), days, topics, [])
    expect(result.shouldReplan).toBe(true)
    expect(result.reason).toContain('mastered')
  })

  it('does not trigger when less than 50% remaining topics mastered', () => {
    vi.setSystemTime(new Date('2024-01-05'))
    const days = [
      makePlanDay({ date: '2024-01-06', activities: JSON.stringify([{ topicName: 'Math', completed: false }, { topicName: 'Physics', completed: false }, { topicName: 'Chemistry', completed: false }]) }),
    ]
    const topics = [
      makeTopic({ name: 'Math', mastery: 0.9 }),
      makeTopic({ id: 't2', name: 'Physics', mastery: 0.3 }),
      makeTopic({ id: 't3', name: 'Chemistry', mastery: 0.2 }),
    ]
    const result = shouldReplan(makePlan(), days, topics, [])
    expect(result.shouldReplan).toBe(false)
  })
})
