import { vi, describe, it, expect, beforeEach } from 'vitest'

// ─── Hoisted mock state ──────────────────────────────────────────
const { mockDb, mockDecayedMastery } = vi.hoisted(() => {
  function makeChain(data: { toArray?: unknown[]; count?: number; first?: unknown; last?: unknown } = {}) {
    const chain: Record<string, unknown> = {}
    chain.equals = vi.fn().mockReturnValue(chain)
    chain.belowOrEqual = vi.fn().mockReturnValue(chain)
    chain.filter = vi.fn().mockReturnValue(chain)
    chain.toArray = vi.fn().mockResolvedValue(data.toArray ?? [])
    chain.count = vi.fn().mockResolvedValue(data.count ?? 0)
    chain.first = vi.fn().mockResolvedValue(data.first ?? undefined)
    chain.last = vi.fn().mockResolvedValue(data.last ?? undefined)
    return chain
  }

  function makeTable() {
    return {
      where: vi.fn().mockImplementation(() => makeChain()),
      get: vi.fn().mockResolvedValue(undefined),
      bulkPut: vi.fn().mockResolvedValue(undefined),
      put: vi.fn().mockResolvedValue(undefined),
    }
  }

  const mockDb = {
    notifications: makeTable(),
    notificationPreferences: makeTable(),
    flashcardDecks: makeTable(),
    flashcards: makeTable(),
    dailyStudyLogs: makeTable(),
    studyPlans: makeTable(),
    examProfiles: makeTable(),
    topics: makeTable(),
    practiceExamSessions: makeTable(),
    questionResults: makeTable(),
    exerciseAttempts: makeTable(),
    // Need to export makeChain so tests can use it
    _makeChain: makeChain,
  }

  const mockDecayedMastery = vi.fn((topic: { mastery: number }) => topic.mastery * 0.8)

  return { mockDb, mockDecayedMastery }
})

vi.mock('../../db', () => ({ db: mockDb }))
vi.mock('../knowledgeGraph', () => ({
  decayedMastery: mockDecayedMastery,
}))

import { generateNotifications, checkMasteryMilestone } from '../notificationGenerator'

const makeChain = mockDb._makeChain

describe('notificationGenerator', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset all table mocks to return empty/undefined defaults
    for (const [key, table] of Object.entries(mockDb)) {
      if (key === '_makeChain') continue
      const t = table as ReturnType<typeof makeChain> & { get?: ReturnType<typeof vi.fn>; where?: ReturnType<typeof vi.fn>; bulkPut?: ReturnType<typeof vi.fn>; put?: ReturnType<typeof vi.fn> }
      if (t.get) t.get.mockResolvedValue(undefined)
      if (t.where) t.where.mockImplementation(() => makeChain())
      if (t.bulkPut) t.bulkPut.mockResolvedValue(undefined)
      if (t.put) t.put.mockResolvedValue(undefined)
    }
    mockDecayedMastery.mockImplementation((topic: { mastery: number }) => topic.mastery * 0.8)
  })

  describe('generateNotifications', () => {
    it('skips generation if already generated today (idempotency)', async () => {
      mockDb.notifications.where.mockReturnValue(makeChain({ count: 3 }))

      await generateNotifications('profile-1')
      expect(mockDb.notifications.bulkPut).not.toHaveBeenCalled()
    })

    it('bypasses idempotency check with forceRefresh', async () => {
      mockDb.notifications.where.mockReturnValue(makeChain({ count: 3 }))
      mockDb.notificationPreferences.get.mockResolvedValue(undefined)

      mockDb.flashcardDecks.where.mockReturnValue(makeChain({ toArray: [] }))
      mockDb.flashcards.where.mockReturnValue(makeChain({ count: 0 }))
      mockDb.dailyStudyLogs.get.mockResolvedValue(undefined)
      mockDb.studyPlans.where.mockReturnValue(makeChain({ first: undefined }))
      mockDb.examProfiles.get.mockResolvedValue(undefined)
      mockDb.topics.where.mockReturnValue(makeChain({ toArray: [] }))
      mockDb.practiceExamSessions.where.mockReturnValue(makeChain({ last: undefined }))
      mockDb.questionResults.where.mockReturnValue(makeChain({ count: 0 }))
      mockDb.exerciseAttempts.where.mockReturnValue(makeChain({ count: 0 }))

      await generateNotifications('profile-1', true)
      // Should proceed (plan-suggestion + streak-warning at minimum)
      expect(mockDb.notifications.bulkPut).toHaveBeenCalled()
    })

    it('generates review-due notification when flashcards are due', async () => {
      mockDb.notifications.where.mockReturnValue(makeChain({ count: 0 }))
      mockDb.notificationPreferences.get.mockResolvedValue(undefined)

      mockDb.flashcardDecks.where.mockReturnValue(makeChain({ toArray: [{ id: 'deck-1' }] }))
      mockDb.flashcards.where.mockReturnValue(makeChain({ count: 5 }))

      mockDb.dailyStudyLogs.get.mockResolvedValue({ totalSeconds: 100 })
      mockDb.studyPlans.where.mockReturnValue(makeChain({ first: { isActive: true } }))
      mockDb.examProfiles.get.mockResolvedValue(undefined)
      mockDb.topics.where.mockReturnValue(makeChain({ toArray: [] }))
      mockDb.practiceExamSessions.where.mockReturnValue(makeChain({ last: undefined }))
      mockDb.questionResults.where.mockReturnValue(makeChain({ count: 0 }))
      mockDb.exerciseAttempts.where.mockReturnValue(makeChain({ count: 0 }))

      await generateNotifications('profile-1', true)

      expect(mockDb.notifications.bulkPut).toHaveBeenCalled()
      const notifications = mockDb.notifications.bulkPut.mock.calls[0][0] as Array<{ type: string; title: string }>
      const reviewDue = notifications.find(n => n.type === 'review-due')
      expect(reviewDue).toBeDefined()
      expect(reviewDue!.title).toContain('flashcard')
    })

    it('generates streak-warning when no study yesterday or today', async () => {
      mockDb.notifications.where.mockReturnValue(makeChain({ count: 0 }))
      mockDb.notificationPreferences.get.mockResolvedValue(undefined)

      mockDb.flashcardDecks.where.mockReturnValue(makeChain({ toArray: [] }))
      mockDb.flashcards.where.mockReturnValue(makeChain({ count: 0 }))
      mockDb.dailyStudyLogs.get.mockResolvedValue(undefined)
      mockDb.studyPlans.where.mockReturnValue(makeChain({ first: { isActive: true } }))
      mockDb.examProfiles.get.mockResolvedValue(undefined)
      mockDb.topics.where.mockReturnValue(makeChain({ toArray: [] }))
      mockDb.practiceExamSessions.where.mockReturnValue(makeChain({ last: undefined }))
      mockDb.questionResults.where.mockReturnValue(makeChain({ count: 0 }))
      mockDb.exerciseAttempts.where.mockReturnValue(makeChain({ count: 0 }))

      await generateNotifications('profile-1', true)

      const notifications = mockDb.notifications.bulkPut.mock.calls[0][0] as Array<{ type: string; message: string }>
      const streakWarning = notifications.find(n => n.type === 'streak-warning')
      expect(streakWarning).toBeDefined()
      expect(streakWarning!.message).toContain("haven't studied")
    })

    it('generates plan-suggestion when no active plan', async () => {
      mockDb.notifications.where.mockReturnValue(makeChain({ count: 0 }))
      mockDb.notificationPreferences.get.mockResolvedValue(undefined)

      mockDb.flashcardDecks.where.mockReturnValue(makeChain({ toArray: [] }))
      mockDb.flashcards.where.mockReturnValue(makeChain({ count: 0 }))
      mockDb.dailyStudyLogs.get.mockResolvedValue({ totalSeconds: 100 })
      mockDb.studyPlans.where.mockReturnValue(makeChain({ first: undefined }))
      mockDb.examProfiles.get.mockResolvedValue(undefined)
      mockDb.topics.where.mockReturnValue(makeChain({ toArray: [] }))
      mockDb.practiceExamSessions.where.mockReturnValue(makeChain({ last: undefined }))
      mockDb.questionResults.where.mockReturnValue(makeChain({ count: 0 }))
      mockDb.exerciseAttempts.where.mockReturnValue(makeChain({ count: 0 }))

      await generateNotifications('profile-1', true)

      const notifications = mockDb.notifications.bulkPut.mock.calls[0][0] as Array<{ type: string; actionUrl: string }>
      const planSuggestion = notifications.find(n => n.type === 'plan-suggestion')
      expect(planSuggestion).toBeDefined()
      expect(planSuggestion!.actionUrl).toBe('/study-plan')
    })

    it('generates milestone notification when exam is approaching', async () => {
      mockDb.notifications.where.mockReturnValue(makeChain({ count: 0 }))
      mockDb.notificationPreferences.get.mockResolvedValue(undefined)

      mockDb.flashcardDecks.where.mockReturnValue(makeChain({ toArray: [] }))
      mockDb.flashcards.where.mockReturnValue(makeChain({ count: 0 }))
      mockDb.dailyStudyLogs.get.mockResolvedValue({ totalSeconds: 100 })
      mockDb.studyPlans.where.mockReturnValue(makeChain({ first: { isActive: true } }))

      const sevenDaysFromNow = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
      mockDb.examProfiles.get.mockResolvedValue({
        id: 'profile-1',
        name: 'Bar Exam',
        examDate: sevenDaysFromNow,
        passingThreshold: 70,
      })

      mockDb.topics.where.mockReturnValue(makeChain({ toArray: [] }))
      mockDb.practiceExamSessions.where.mockReturnValue(makeChain({ last: undefined }))
      mockDb.questionResults.where.mockReturnValue(makeChain({ count: 0 }))
      mockDb.exerciseAttempts.where.mockReturnValue(makeChain({ count: 0 }))

      await generateNotifications('profile-1', true)

      const notifications = mockDb.notifications.bulkPut.mock.calls[0][0] as Array<{ type: string; title: string }>
      const milestone = notifications.find(n => n.type === 'milestone')
      expect(milestone).toBeDefined()
      expect(milestone!.title).toContain('7 days')
    })

    it('generates mastery-drop notification when topic mastery decayed', async () => {
      mockDecayedMastery.mockReturnValue(0.25)

      mockDb.notifications.where.mockReturnValue(makeChain({ count: 0 }))
      mockDb.notificationPreferences.get.mockResolvedValue(undefined)

      mockDb.flashcardDecks.where.mockReturnValue(makeChain({ toArray: [] }))
      mockDb.flashcards.where.mockReturnValue(makeChain({ count: 0 }))
      mockDb.dailyStudyLogs.get.mockResolvedValue({ totalSeconds: 100 })
      mockDb.studyPlans.where.mockReturnValue(makeChain({ first: { isActive: true } }))
      mockDb.examProfiles.get.mockResolvedValue(undefined)

      mockDb.topics.where.mockReturnValue(makeChain({
        toArray: [{
          id: 't1', name: 'Calculus', mastery: 0.5, nextReviewDate: '2020-01-01',
          subjectId: 's1', examProfileId: 'profile-1',
        }],
      }))
      mockDb.practiceExamSessions.where.mockReturnValue(makeChain({ last: undefined }))
      mockDb.questionResults.where.mockReturnValue(makeChain({ count: 0 }))
      mockDb.exerciseAttempts.where.mockReturnValue(makeChain({ count: 0 }))

      await generateNotifications('profile-1', true)

      const notifications = mockDb.notifications.bulkPut.mock.calls[0][0] as Array<{ type: string; title: string }>
      const masteryDrop = notifications.find(n => n.type === 'mastery-drop')
      expect(masteryDrop).toBeDefined()
      expect(masteryDrop!.title).toContain('Calculus')
    })

    it('generates weak-topic notification for topics below 40% mastery and due', async () => {
      mockDecayedMastery.mockReturnValue(0.35)

      mockDb.notifications.where.mockReturnValue(makeChain({ count: 0 }))
      mockDb.notificationPreferences.get.mockResolvedValue(undefined)

      mockDb.flashcardDecks.where.mockReturnValue(makeChain({ toArray: [] }))
      mockDb.flashcards.where.mockReturnValue(makeChain({ count: 0 }))
      mockDb.dailyStudyLogs.get.mockResolvedValue({ totalSeconds: 100 })
      mockDb.studyPlans.where.mockReturnValue(makeChain({ first: { isActive: true } }))
      mockDb.examProfiles.get.mockResolvedValue(undefined)

      const today = new Date().toISOString().slice(0, 10)
      mockDb.topics.where.mockReturnValue(makeChain({
        toArray: [
          { id: 't1', name: 'Algebra', mastery: 0.3, nextReviewDate: today, subjectId: 's1', examProfileId: 'profile-1' },
          { id: 't2', name: 'Geometry', mastery: 0.2, nextReviewDate: today, subjectId: 's1', examProfileId: 'profile-1' },
        ],
      }))
      mockDb.practiceExamSessions.where.mockReturnValue(makeChain({ last: undefined }))
      mockDb.questionResults.where.mockReturnValue(makeChain({ count: 0 }))
      mockDb.exerciseAttempts.where.mockReturnValue(makeChain({ count: 0 }))

      await generateNotifications('profile-1', true)

      const notifications = mockDb.notifications.bulkPut.mock.calls[0][0] as Array<{ type: string; title: string }>
      const weakTopic = notifications.find(n => n.type === 'weak-topic')
      expect(weakTopic).toBeDefined()
      expect(weakTopic!.title).toContain('2 weak topics')
    })

    it('generates performance-alert when practice exam below threshold', async () => {
      mockDecayedMastery.mockReturnValue(0.5)

      mockDb.notifications.where.mockReturnValue(makeChain({ count: 0 }))
      mockDb.notificationPreferences.get.mockResolvedValue(undefined)

      mockDb.flashcardDecks.where.mockReturnValue(makeChain({ toArray: [] }))
      mockDb.flashcards.where.mockReturnValue(makeChain({ count: 0 }))
      mockDb.dailyStudyLogs.get.mockResolvedValue({ totalSeconds: 100 })
      mockDb.studyPlans.where.mockReturnValue(makeChain({ first: { isActive: true } }))

      mockDb.examProfiles.get.mockResolvedValue({
        id: 'profile-1',
        name: 'Bar Exam',
        examDate: '',
        passingThreshold: 70,
      })

      mockDb.topics.where.mockReturnValue(makeChain({ toArray: [] }))
      mockDb.practiceExamSessions.where.mockReturnValue(makeChain({
        last: {
          phase: 'graded',
          totalScore: 50,
          maxScore: 100,
          examProfileId: 'profile-1',
        },
      }))
      mockDb.questionResults.where.mockReturnValue(makeChain({ count: 0 }))
      mockDb.exerciseAttempts.where.mockReturnValue(makeChain({ count: 0 }))

      await generateNotifications('profile-1', true)

      const notifications = mockDb.notifications.bulkPut.mock.calls[0][0] as Array<{ type: string; title: string }>
      const perf = notifications.find(n => n.type === 'performance-alert')
      expect(perf).toBeDefined()
      expect(perf!.title).toContain('50%')
    })

    it('does not create notifications when all prefs are disabled', async () => {
      mockDb.notifications.where.mockReturnValue(makeChain({ count: 0 }))
      mockDb.notificationPreferences.get.mockResolvedValue({
        id: 'profile-1',
        reviewDue: false,
        streakWarnings: false,
        planSuggestions: false,
        milestones: false,
      })

      await generateNotifications('profile-1', true)
      expect(mockDb.notifications.bulkPut).not.toHaveBeenCalled()
    })

    it('creates notification objects with correct shape', async () => {
      mockDb.notifications.where.mockReturnValue(makeChain({ count: 0 }))
      mockDb.notificationPreferences.get.mockResolvedValue(undefined)

      mockDb.flashcardDecks.where.mockReturnValue(makeChain({ toArray: [] }))
      mockDb.flashcards.where.mockReturnValue(makeChain({ count: 0 }))
      mockDb.dailyStudyLogs.get.mockResolvedValue(undefined)
      mockDb.studyPlans.where.mockReturnValue(makeChain({ first: undefined }))
      mockDb.examProfiles.get.mockResolvedValue(undefined)
      mockDb.topics.where.mockReturnValue(makeChain({ toArray: [] }))
      mockDb.practiceExamSessions.where.mockReturnValue(makeChain({ last: undefined }))
      mockDb.questionResults.where.mockReturnValue(makeChain({ count: 0 }))
      mockDb.exerciseAttempts.where.mockReturnValue(makeChain({ count: 0 }))

      await generateNotifications('profile-1', true)

      const notifications = mockDb.notifications.bulkPut.mock.calls[0][0] as Array<Record<string, unknown>>
      for (const n of notifications) {
        expect(n).toHaveProperty('id')
        expect(n).toHaveProperty('examProfileId', 'profile-1')
        expect(n).toHaveProperty('type')
        expect(n).toHaveProperty('title')
        expect(n).toHaveProperty('message')
        expect(n).toHaveProperty('isRead', false)
        expect(n).toHaveProperty('createdAt')
      }
    })
  })

  describe('checkMasteryMilestone', () => {
    it('fires milestone when mastery crosses 0.8 threshold', async () => {
      mockDb.notifications.where.mockReturnValue(makeChain({ count: 0 }))

      await checkMasteryMilestone('t1', 'Physics', 'profile-1', 0.7, 0.85)

      expect(mockDb.notifications.put).toHaveBeenCalledTimes(1)
      const notification = mockDb.notifications.put.mock.calls[0][0] as { type: string; title: string }
      expect(notification.type).toBe('milestone')
      expect(notification.title).toContain('mastered')
      expect(notification.title).toContain('Physics')
    })

    it('fires milestone when mastery crosses 0.6 threshold', async () => {
      mockDb.notifications.where.mockReturnValue(makeChain({ count: 0 }))

      await checkMasteryMilestone('t1', 'Chemistry', 'profile-1', 0.5, 0.65)

      expect(mockDb.notifications.put).toHaveBeenCalledTimes(1)
      const notification = mockDb.notifications.put.mock.calls[0][0] as { title: string }
      expect(notification.title).toContain('Chemistry')
      expect(notification.title).toContain('solid')
    })

    it('fires milestone when mastery crosses 0.3 threshold', async () => {
      mockDb.notifications.where.mockReturnValue(makeChain({ count: 0 }))

      await checkMasteryMilestone('t1', 'Biology', 'profile-1', 0.2, 0.35)

      expect(mockDb.notifications.put).toHaveBeenCalledTimes(1)
      const notification = mockDb.notifications.put.mock.calls[0][0] as { title: string }
      expect(notification.title).toContain('Biology')
      expect(notification.title).toContain('taking shape')
    })

    it('only fires the highest crossed threshold', async () => {
      mockDb.notifications.where.mockReturnValue(makeChain({ count: 0 }))

      await checkMasteryMilestone('t1', 'Math', 'profile-1', 0.2, 0.9)

      expect(mockDb.notifications.put).toHaveBeenCalledTimes(1)
      const notification = mockDb.notifications.put.mock.calls[0][0] as { title: string }
      expect(notification.title).toContain('mastered')
    })

    it('deduplicates existing milestone notifications', async () => {
      mockDb.notifications.where.mockReturnValue(makeChain({ count: 1 }))

      await checkMasteryMilestone('t1', 'Physics', 'profile-1', 0.7, 0.85)

      expect(mockDb.notifications.put).not.toHaveBeenCalled()
    })

    it('does nothing when no threshold is crossed', async () => {
      await checkMasteryMilestone('t1', 'Physics', 'profile-1', 0.5, 0.55)

      expect(mockDb.notifications.put).not.toHaveBeenCalled()
    })
  })
})
