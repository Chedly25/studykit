import { vi, describe, it, expect, beforeEach } from 'vitest'

// ─── Hoisted mock state ──────────────────────────────────────────
const { mockDb, makeChain } = vi.hoisted(() => {
  function makeChain(data: { toArray?: unknown[]; count?: number; sortBy?: unknown[] } = {}) {
    const chain: Record<string, unknown> = {}
    chain.equals = vi.fn().mockReturnValue(chain)
    chain.anyOf = vi.fn().mockReturnValue(chain)
    chain.filter = vi.fn().mockReturnValue(chain)
    chain.toArray = vi.fn().mockResolvedValue(data.toArray ?? [])
    chain.count = vi.fn().mockResolvedValue(data.count ?? 0)
    chain.sortBy = vi.fn().mockResolvedValue(data.sortBy ?? data.toArray ?? [])
    return chain
  }

  function makeTable() {
    return {
      where: vi.fn().mockReturnValue(makeChain()),
      bulkPut: vi.fn().mockResolvedValue(undefined),
    }
  }

  const mockDb = {
    studySessions: makeTable(),
    questionResults: makeTable(),
    exerciseAttempts: makeTable(),
    topics: makeTable(),
    flashcardDecks: makeTable(),
    flashcards: makeTable(),
    dailyStudyLogs: makeTable(),
    achievements: makeTable(),
  }

  return { mockDb, makeChain }
})

vi.mock('../../db', () => ({ db: mockDb }))

import {
  ACHIEVEMENTS,
  ACHIEVEMENT_MAP,
  getAchievementStats,
  checkAchievements,
} from '../achievements'

describe('achievements', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    for (const table of Object.values(mockDb)) {
      table.where.mockReturnValue(makeChain())
      table.bulkPut.mockResolvedValue(undefined)
    }
  })

  describe('ACHIEVEMENTS constant', () => {
    it('has at least 15 achievements', () => {
      expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(15)
    })

    it('all have required fields', () => {
      for (const a of ACHIEVEMENTS) {
        expect(a.id).toBeTruthy()
        expect(a.title).toBeTruthy()
        expect(a.description).toBeTruthy()
        expect(['streak', 'volume', 'mastery', 'special']).toContain(a.category)
        expect(a.icon).toBeTruthy()
      }
    })

    it('all IDs are unique', () => {
      const ids = ACHIEVEMENTS.map(a => a.id)
      expect(new Set(ids).size).toBe(ids.length)
    })
  })

  describe('ACHIEVEMENT_MAP', () => {
    it('maps all achievement IDs', () => {
      expect(ACHIEVEMENT_MAP.size).toBe(ACHIEVEMENTS.length)
      for (const a of ACHIEVEMENTS) {
        expect(ACHIEVEMENT_MAP.get(a.id)).toBe(a)
      }
    })
  })

  describe('getAchievementStats', () => {
    it('returns correct stats from DB data', async () => {
      const today = new Date().toISOString().slice(0, 10)

      mockDb.studySessions.where.mockReturnValue(makeChain({
        toArray: [
          { startTime: today + 'T10:00:00', durationSeconds: 3600, topicId: 't1' },
          { startTime: today + 'T14:00:00', durationSeconds: 1800, topicId: 't2' },
        ],
      }))
      mockDb.questionResults.where.mockReturnValue(makeChain({ count: 42 }))
      mockDb.exerciseAttempts.where.mockReturnValue(makeChain({ count: 15 }))
      mockDb.topics.where.mockReturnValue(makeChain({
        toArray: [{ mastery: 0.7 }, { mastery: 0.3 }],
      }))
      mockDb.flashcardDecks.where.mockReturnValue(makeChain({
        toArray: [{ id: 'deck-1' }],
      }))
      mockDb.flashcards.where.mockReturnValue(makeChain({
        toArray: [{ repetitions: 5 }, { repetitions: 3 }],
      }))
      mockDb.dailyStudyLogs.where.mockReturnValue(makeChain({
        toArray: [{ date: today }],
      }))

      const stats = await getAchievementStats('p1')

      expect(stats.totalSessions).toBe(2)
      expect(stats.totalQuestions).toBe(42)
      expect(stats.totalExerciseAttempts).toBe(15)
      expect(stats.topicMasteries).toHaveLength(2)
      expect(stats.totalFlashcardReviews).toBe(8)
      expect(stats.longestSessionSeconds).toBe(3600)
      expect(stats.distinctTopicsStudied).toBe(2)
      expect(stats.lastSessionDate).toBe(today)
      expect(stats.streak).toBeGreaterThanOrEqual(1)
    })

    it('returns zero stats for empty data', async () => {
      const stats = await getAchievementStats('p1')

      expect(stats.totalSessions).toBe(0)
      expect(stats.totalQuestions).toBe(0)
      expect(stats.streak).toBe(0)
      expect(stats.lastSessionDate).toBeNull()
      expect(stats.longestSessionSeconds).toBe(0)
    })
  })

  describe('checkAchievements', () => {
    it('unlocks FIRST_SESSION when at least 1 session exists', async () => {
      const today = new Date().toISOString().slice(0, 10)
      mockDb.studySessions.where.mockReturnValue(makeChain({
        toArray: [{ startTime: today + 'T10:00:00', durationSeconds: 600, topicId: 't1' }],
      }))
      mockDb.dailyStudyLogs.where.mockReturnValue(makeChain({ toArray: [] }))
      mockDb.achievements.where.mockReturnValue(makeChain({ toArray: [] }))

      const unlocked = await checkAchievements('p1')

      expect(unlocked.map(a => a.id)).toContain('FIRST_SESSION')
    })

    it('unlocks volume achievements at thresholds', async () => {
      mockDb.questionResults.where.mockReturnValue(makeChain({ count: 100 }))
      mockDb.exerciseAttempts.where.mockReturnValue(makeChain({ count: 50 }))
      mockDb.dailyStudyLogs.where.mockReturnValue(makeChain({ toArray: [] }))
      mockDb.achievements.where.mockReturnValue(makeChain({ toArray: [] }))

      const unlocked = await checkAchievements('p1')
      const ids = unlocked.map(a => a.id)

      expect(ids).toContain('QUESTIONS_25')
      expect(ids).toContain('QUESTIONS_100')
      expect(ids).toContain('EXERCISES_50')
    })

    it('unlocks mastery achievements', async () => {
      mockDb.topics.where.mockReturnValue(makeChain({
        toArray: [{ mastery: 0.85 }, { mastery: 0.6 }],
      }))
      mockDb.dailyStudyLogs.where.mockReturnValue(makeChain({ toArray: [] }))
      mockDb.achievements.where.mockReturnValue(makeChain({ toArray: [] }))

      const unlocked = await checkAchievements('p1')
      const ids = unlocked.map(a => a.id)

      expect(ids).toContain('FIRST_TOPIC_50')
      expect(ids).toContain('FIRST_TOPIC_80')
    })

    it('unlocks ALL_TOPICS_30 when all topics above 30%', async () => {
      mockDb.topics.where.mockReturnValue(makeChain({
        toArray: [{ mastery: 0.35 }, { mastery: 0.5 }],
      }))
      mockDb.dailyStudyLogs.where.mockReturnValue(makeChain({ toArray: [] }))
      mockDb.achievements.where.mockReturnValue(makeChain({ toArray: [] }))

      const unlocked = await checkAchievements('p1')
      expect(unlocked.map(a => a.id)).toContain('ALL_TOPICS_30')
    })

    it('does not unlock ALL_TOPICS_30 when some topics below 30%', async () => {
      mockDb.topics.where.mockReturnValue(makeChain({
        toArray: [{ mastery: 0.2 }, { mastery: 0.5 }],
      }))
      mockDb.dailyStudyLogs.where.mockReturnValue(makeChain({ toArray: [] }))
      mockDb.achievements.where.mockReturnValue(makeChain({ toArray: [] }))

      const unlocked = await checkAchievements('p1')
      expect(unlocked.map(a => a.id)).not.toContain('ALL_TOPICS_30')
    })

    it('skips already-unlocked achievements (deduplication)', async () => {
      const today = new Date().toISOString().slice(0, 10)
      mockDb.studySessions.where.mockReturnValue(makeChain({
        toArray: [{ startTime: today + 'T10:00:00', durationSeconds: 600, topicId: 't1' }],
      }))
      mockDb.dailyStudyLogs.where.mockReturnValue(makeChain({ toArray: [] }))
      mockDb.achievements.where.mockReturnValue(makeChain({
        toArray: [{ achievementId: 'FIRST_SESSION' }],
      }))

      const unlocked = await checkAchievements('p1')
      expect(unlocked.map(a => a.id)).not.toContain('FIRST_SESSION')
    })

    it('unlocks HOUR_SESSION for 60+ minute sessions', async () => {
      mockDb.studySessions.where.mockReturnValue(makeChain({
        toArray: [{ startTime: '2026-01-01T10:00:00', durationSeconds: 4000, topicId: 't1' }],
      }))
      mockDb.dailyStudyLogs.where.mockReturnValue(makeChain({ toArray: [] }))
      mockDb.achievements.where.mockReturnValue(makeChain({ toArray: [] }))

      const unlocked = await checkAchievements('p1')
      expect(unlocked.map(a => a.id)).toContain('HOUR_SESSION')
    })

    it('unlocks COMEBACK when gap of 7+ days between logs', async () => {
      const today = new Date().toISOString().slice(0, 10)
      mockDb.studySessions.where.mockReturnValue(makeChain({
        toArray: [{ startTime: today + 'T10:00:00', durationSeconds: 600, topicId: 't1' }],
      }))
      mockDb.dailyStudyLogs.where.mockReturnValue(makeChain({
        toArray: [{ date: today }, { date: '2025-01-01' }],
        sortBy: [{ date: '2025-01-01' }, { date: today }],
      }))
      mockDb.achievements.where.mockReturnValue(makeChain({ toArray: [] }))

      const unlocked = await checkAchievements('p1')
      expect(unlocked.map(a => a.id)).toContain('COMEBACK')
    })

    it('persists newly unlocked achievements via bulkPut', async () => {
      const today = new Date().toISOString().slice(0, 10)
      mockDb.studySessions.where.mockReturnValue(makeChain({
        toArray: [{ startTime: today + 'T10:00:00', durationSeconds: 600, topicId: 't1' }],
      }))
      mockDb.dailyStudyLogs.where.mockReturnValue(makeChain({ toArray: [] }))
      mockDb.achievements.where.mockReturnValue(makeChain({ toArray: [] }))

      await checkAchievements('p1')

      expect(mockDb.achievements.bulkPut).toHaveBeenCalledTimes(1)
      const records = mockDb.achievements.bulkPut.mock.calls[0][0] as Array<Record<string, unknown>>
      expect(records.length).toBeGreaterThan(0)
      for (const r of records) {
        expect(r).toHaveProperty('id')
        expect(r).toHaveProperty('examProfileId', 'p1')
        expect(r).toHaveProperty('achievementId')
        expect(r).toHaveProperty('unlockedAt')
      }
    })

    it('does not call bulkPut when nothing new unlocked', async () => {
      mockDb.dailyStudyLogs.where.mockReturnValue(makeChain({ toArray: [] }))
      mockDb.achievements.where.mockReturnValue(makeChain({ toArray: [] }))

      const unlocked = await checkAchievements('p1')

      expect(unlocked).toHaveLength(0)
      expect(mockDb.achievements.bulkPut).not.toHaveBeenCalled()
    })
  })
})
