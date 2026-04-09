import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('../knowledgeGraph', () => ({
  decayedMastery: vi.fn((topic: { mastery: number }) => topic.mastery),
}))

import { computeDailyRecommendations } from '../studyRecommender'
import type { RecommenderInput } from '../studyRecommender'
import type { Topic, Subject } from '../../db/schema'
import { decayedMastery } from '../knowledgeGraph'

function makeTopic(overrides: Partial<Topic> = {}): Topic {
  return {
    id: 'topic-1',
    subjectId: 'sub-1',
    examProfileId: 'p1',
    name: 'Test Topic',
    mastery: 0.5,
    confidence: 0.5,
    questionsAttempted: 10,
    questionsCorrect: 5,
    easeFactor: 2.5,
    interval: 10,
    repetitions: 3,
    nextReviewDate: '2026-04-01',
    ...overrides,
  } as Topic
}

function makeSubject(overrides: Partial<Subject> = {}): Subject {
  return {
    id: 'sub-1',
    examProfileId: 'p1',
    name: 'Mathematics',
    weight: 50,
    mastery: 0.5,
    color: 'blue',
    order: 0,
    ...overrides,
  } as Subject
}

function makeInput(overrides: Partial<RecommenderInput> = {}): RecommenderInput {
  return {
    topics: [makeTopic()],
    subjects: [makeSubject()],
    daysUntilExam: 30,
    dueFlashcardsByTopic: new Map(),
    ...overrides,
  }
}

describe('computeDailyRecommendations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(decayedMastery).mockImplementation((t: { mastery: number }) => t.mastery)
  })

  it('returns at most 5 recommendations', () => {
    const topics = Array.from({ length: 10 }, (_, i) =>
      makeTopic({ id: `t${i}`, name: `Topic ${i}` })
    )
    const result = computeDailyRecommendations(makeInput({ topics }))
    expect(result.length).toBeLessThanOrEqual(5)
  })

  it('sorts recommendations by score descending', () => {
    const topics = [
      makeTopic({ id: 't1', name: 'Low mastery', mastery: 0.1 }),
      makeTopic({ id: 't2', name: 'High mastery', mastery: 0.9 }),
    ]
    vi.mocked(decayedMastery).mockImplementation((t: { mastery: number }) => t.mastery)

    const result = computeDailyRecommendations(makeInput({ topics }))

    // Lower mastery = higher score (1 - dm), so Low mastery should be first
    expect(result[0].topicName).toBe('Low mastery')
  })

  it('assigns "flashcards" action when due flashcards exist', () => {
    const dueFlashcardsByTopic = new Map([['topic-1', 5]])

    const result = computeDailyRecommendations(makeInput({ dueFlashcardsByTopic }))

    expect(result[0].action).toBe('flashcards')
    expect(result[0].reason).toContain('flashcard')
    expect(result[0].linkTo).toBe('/flashcard-maker')
  })

  it('assigns "read" action for low mastery topics (< 0.3)', () => {
    vi.mocked(decayedMastery).mockReturnValue(0.2)

    const result = computeDailyRecommendations(makeInput())

    expect(result[0].action).toBe('read')
  })

  it('assigns "practice" action for mid-mastery topics (0.3-0.6)', () => {
    vi.mocked(decayedMastery).mockReturnValue(0.45)

    const result = computeDailyRecommendations(makeInput())

    expect(result[0].action).toBe('practice')
  })

  it('assigns "explain-back" for high mastery with few attempts', () => {
    vi.mocked(decayedMastery).mockReturnValue(0.75)
    const topics = [makeTopic({ mastery: 0.75, questionsAttempted: 2 })]

    const result = computeDailyRecommendations(makeInput({ topics }))

    expect(result[0].action).toBe('explain-back')
  })

  it('assigns "review" for high mastery with sufficient attempts', () => {
    vi.mocked(decayedMastery).mockReturnValue(0.65)
    const topics = [makeTopic({ mastery: 0.65, questionsAttempted: 10 })]

    const result = computeDailyRecommendations(makeInput({ topics }))

    expect(result[0].action).toBe('review')
  })

  it('shows mastery drop in reason when decayed below stored mastery', () => {
    vi.mocked(decayedMastery).mockReturnValue(0.2) // decayed
    const topics = [makeTopic({ mastery: 0.5 })] // stored mastery higher

    const result = computeDailyRecommendations(makeInput({ topics }))

    expect(result[0].reason).toContain('dropped')
    expect(result[0].reason).toContain('20%')
  })

  it('boosts score when exam is approaching', () => {
    vi.mocked(decayedMastery).mockReturnValue(0.5)
    const farResult = computeDailyRecommendations(makeInput({ daysUntilExam: 60 }))
    const closeResult = computeDailyRecommendations(makeInput({ daysUntilExam: 5 }))

    expect(closeResult[0].score).toBeGreaterThan(farResult[0].score)
  })

  it('boosts activity multiplier for due flashcard topics', () => {
    vi.mocked(decayedMastery).mockReturnValue(0.5)
    const noDue = computeDailyRecommendations(makeInput())
    const withDue = computeDailyRecommendations(makeInput({
      dueFlashcardsByTopic: new Map([['topic-1', 3]]),
    }))

    expect(withDue[0].score).toBeGreaterThan(noDue[0].score)
  })

  it('skips topics with missing names', () => {
    const topics = [
      makeTopic({ id: 't1', name: '', mastery: 0.1 }),
      makeTopic({ id: 't2', name: 'Valid Topic', mastery: 0.5 }),
    ]

    const result = computeDailyRecommendations(makeInput({ topics }))

    expect(result.every(r => r.topicName !== '')).toBe(true)
  })

  it('skips topics with no matching subject', () => {
    const topics = [makeTopic({ subjectId: 'nonexistent' })]

    const result = computeDailyRecommendations(makeInput({ topics }))

    expect(result).toHaveLength(0)
  })

  it('de-prioritizes topics already in today study plan', () => {
    vi.mocked(decayedMastery).mockReturnValue(0.5)
    const topics = [
      makeTopic({ id: 't1', name: 'Planned Topic' }),
    ]
    const withoutPlan = computeDailyRecommendations(makeInput({ topics }))
    const withPlan = computeDailyRecommendations(makeInput({
      topics,
      todayPlanActivities: [{ topicName: 'Planned Topic', completed: false }],
    }))

    expect(withPlan[0].score).toBeLessThan(withoutPlan[0].score)
  })

  it('de-prioritizes completed plan topics even more', () => {
    vi.mocked(decayedMastery).mockReturnValue(0.5)
    const topics = [
      makeTopic({ id: 't1', name: 'Plan Topic' }),
    ]

    const pending = computeDailyRecommendations(makeInput({
      topics,
      todayPlanActivities: [{ topicName: 'Plan Topic', completed: false }],
    }))
    const completed = computeDailyRecommendations(makeInput({
      topics,
      todayPlanActivities: [{ topicName: 'Plan Topic', completed: true }],
    }))

    expect(completed[0].score).toBeLessThan(pending[0].score)
  })

  it('boosts topics matching common mistakes', () => {
    vi.mocked(decayedMastery).mockReturnValue(0.5)
    const topics = [makeTopic({ name: 'Algebra' })]

    const noBoosted = computeDailyRecommendations(makeInput({ topics }))
    const boosted = computeDailyRecommendations(makeInput({
      topics,
      commonMistakes: ['algebra'],
    }))

    expect(boosted[0].score).toBeGreaterThan(noBoosted[0].score)
  })

  it('boosts topics with pending feedback actions', () => {
    vi.mocked(decayedMastery).mockReturnValue(0.5)

    const noBoosted = computeDailyRecommendations(makeInput())
    const boosted = computeDailyRecommendations(makeInput({
      feedbackActions: [{
        type: 'queue-exercises',
        topicId: 'topic-1',
        topicName: 'Test Topic',
        reason: 'needs practice',
        priority: 4,
      }],
    }))

    expect(boosted[0].score).toBeGreaterThan(noBoosted[0].score)
  })

  it('redirects to weak prerequisite when available', () => {
    vi.mocked(decayedMastery).mockImplementation((t: { mastery: number }) => t.mastery)

    const topics = [
      makeTopic({ id: 't1', name: 'Advanced Topic', mastery: 0.4, subjectId: 'sub-1' }),
      makeTopic({ id: 't2', name: 'Prerequisite', mastery: 0.3, subjectId: 'sub-1' }),
    ]

    const result = computeDailyRecommendations(makeInput({
      topics,
      prerequisiteGraph: new Map([['t1', ['t2']]]),
      topicMasteryMap: new Map([['t1', 0.4], ['t2', 0.3]]),
    }))

    // t1 should be redirected to its weak prereq t2
    const t1rec = result.find(r => r.reason.includes('prerequisite'))
    expect(t1rec).toBeDefined()
    expect(t1rec!.topicName).toBe('Prerequisite')
  })

  it('returns correct recommendation shape', () => {
    const result = computeDailyRecommendations(makeInput())

    for (const rec of result) {
      expect(rec).toHaveProperty('topicId')
      expect(rec).toHaveProperty('topicName')
      expect(rec).toHaveProperty('subjectName')
      expect(rec).toHaveProperty('action')
      expect(rec).toHaveProperty('score')
      expect(rec).toHaveProperty('reason')
      expect(rec).toHaveProperty('decayedMastery')
      expect(rec).toHaveProperty('linkTo')
      expect(['read', 'practice', 'review', 'explain-back', 'flashcards']).toContain(rec.action)
    }
  })
})
