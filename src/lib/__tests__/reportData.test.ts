import { vi, describe, it, expect, beforeEach } from 'vitest'

// ─── Hoisted mock state ──────────────────────────────────────────
const { mockDb, mockComputeStreak, mockComputeReadiness, makeChain } = vi.hoisted(() => {
  function makeChain(data: { toArray?: unknown[]; sortBy?: unknown[] } = {}) {
    const chain: Record<string, unknown> = {}
    chain.equals = vi.fn().mockReturnValue(chain)
    chain.anyOf = vi.fn().mockReturnValue(chain)
    chain.filter = vi.fn().mockReturnValue(chain)
    chain.toArray = vi.fn().mockResolvedValue(data.toArray ?? [])
    chain.sortBy = vi.fn().mockResolvedValue(data.sortBy ?? data.toArray ?? [])
    return chain
  }

  function makeTable() {
    return {
      get: vi.fn().mockResolvedValue(undefined),
      where: vi.fn().mockReturnValue(makeChain()),
    }
  }

  const mockDb = {
    examProfiles: makeTable(),
    subjects: makeTable(),
    topics: makeTable(),
    masterySnapshots: makeTable(),
    practiceExamSessions: makeTable(),
    dailyStudyLogs: makeTable(),
    questionResults: makeTable(),
    studySessions: makeTable(),
    flashcardDecks: makeTable(),
    flashcards: makeTable(),
  }

  const mockComputeStreak = vi.fn(() => ({ streak: 3, freezeUsed: false }))
  const mockComputeReadiness = vi.fn(() => ({
    overall: 72,
    flashcardRetention: 0.8,
    questionAccuracy: 0.7,
    topicCoverage: 0.6,
    studyTimeVsTarget: 0.5,
    recency: 0.9,
  }))

  return { mockDb, mockComputeStreak, mockComputeReadiness, makeChain }
})

vi.mock('../../db', () => ({ db: mockDb }))
vi.mock('../knowledgeGraph', () => ({
  computeStreak: mockComputeStreak,
}))
vi.mock('../readinessScore', () => ({
  computeReadinessScore: mockComputeReadiness,
}))

import { computeReportData } from '../reportData'

describe('computeReportData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    for (const table of Object.values(mockDb)) {
      table.where.mockReturnValue(makeChain())
      table.get.mockResolvedValue(undefined)
    }
  })

  it('returns null when profile does not exist', async () => {
    mockDb.examProfiles.get.mockResolvedValue(undefined)
    const result = await computeReportData('nonexistent')
    expect(result).toBeNull()
  })

  it('returns report data with correct profile info', async () => {
    mockDb.examProfiles.get.mockResolvedValue({
      id: 'p1', name: 'Bar Exam', examDate: '2026-06-01',
      examType: 'professional-exam', passingThreshold: 70, weeklyTargetHours: 20,
    })
    mockDb.subjects.where.mockReturnValue(makeChain({ sortBy: [] }))
    mockDb.flashcardDecks.where.mockReturnValue(makeChain({ toArray: [] }))
    mockDb.flashcards.where.mockReturnValue(makeChain({ toArray: [] }))

    const result = await computeReportData('p1')

    expect(result).not.toBeNull()
    expect(result!.profile.name).toBe('Bar Exam')
    expect(result!.profile.examDate).toBe('2026-06-01')
    expect(result!.profile.examType).toBe('professional-exam')
  })

  it('computes summary statistics from mock data', async () => {
    mockDb.examProfiles.get.mockResolvedValue({
      id: 'p1', name: 'Test', examDate: '', examType: 'custom',
      passingThreshold: 50, weeklyTargetHours: 10,
    })
    mockDb.subjects.where.mockReturnValue(makeChain({ sortBy: [] }))
    mockDb.questionResults.where.mockReturnValue(makeChain({
      toArray: [
        { id: 'q1', isCorrect: true },
        { id: 'q2', isCorrect: false },
        { id: 'q3', isCorrect: true },
      ],
    }))
    mockDb.studySessions.where.mockReturnValue(makeChain({
      toArray: [
        { durationSeconds: 3600 },
        { durationSeconds: 1800 },
      ],
    }))
    mockDb.flashcardDecks.where.mockReturnValue(makeChain({ toArray: [] }))
    mockDb.flashcards.where.mockReturnValue(makeChain({ toArray: [] }))

    const result = await computeReportData('p1')

    expect(result!.summary.questionsAnswered).toBe(3)
    expect(result!.summary.accuracy).toBe(67)
    expect(result!.summary.studyHours).toBe(1.5)
    expect(result!.summary.streak).toBe(3)
    expect(result!.summary.readiness).toBe(72)
  })

  it('computes exam history from graded sessions', async () => {
    mockDb.examProfiles.get.mockResolvedValue({
      id: 'p1', name: 'Test', examDate: '', examType: 'custom',
      passingThreshold: 60, weeklyTargetHours: 10,
    })
    mockDb.subjects.where.mockReturnValue(makeChain({ sortBy: [] }))
    mockDb.practiceExamSessions.where.mockReturnValue(makeChain({
      toArray: [
        { phase: 'graded', totalScore: 80, maxScore: 100, questionCount: 20, completedAt: '2026-03-15T10:00:00', createdAt: '2026-03-15' },
        { phase: 'graded', totalScore: 50, maxScore: 100, questionCount: 20, completedAt: '2026-03-10T10:00:00', createdAt: '2026-03-10' },
        { phase: 'in-progress', totalScore: null, maxScore: null, questionCount: 10, createdAt: '2026-03-12' },
      ],
    }))
    mockDb.flashcardDecks.where.mockReturnValue(makeChain({ toArray: [] }))
    mockDb.flashcards.where.mockReturnValue(makeChain({ toArray: [] }))

    const result = await computeReportData('p1')

    expect(result!.examHistory).toHaveLength(2)
    expect(result!.examHistory[0].percentage).toBe(80)
    expect(result!.examHistory[0].passed).toBe(true)
    expect(result!.examHistory[1].percentage).toBe(50)
    expect(result!.examHistory[1].passed).toBe(false)
  })

  it('computes topic details sorted by mastery ascending', async () => {
    mockDb.examProfiles.get.mockResolvedValue({
      id: 'p1', name: 'Test', examDate: '', examType: 'custom',
      passingThreshold: 50, weeklyTargetHours: 10,
    })
    mockDb.subjects.where.mockReturnValue(makeChain({
      sortBy: [
        { id: 's1', name: 'Math', weight: 60, mastery: 0.5, color: 'red', order: 0, examProfileId: 'p1' },
      ],
    }))
    mockDb.topics.where.mockReturnValue(makeChain({
      toArray: [
        { id: 't1', subjectId: 's1', name: 'Algebra', mastery: 0.8, questionsAttempted: 10, questionsCorrect: 8, nextReviewDate: '2026-04-10', examProfileId: 'p1' },
        { id: 't2', subjectId: 's1', name: 'Calculus', mastery: 0.3, questionsAttempted: 5, questionsCorrect: 1, nextReviewDate: '2026-04-05', examProfileId: 'p1' },
      ],
    }))
    mockDb.flashcardDecks.where.mockReturnValue(makeChain({ toArray: [] }))
    mockDb.flashcards.where.mockReturnValue(makeChain({ toArray: [] }))

    const result = await computeReportData('p1')

    expect(result!.topics).toHaveLength(2)
    expect(result!.topics[0].name).toBe('Calculus')
    expect(result!.topics[0].mastery).toBe(30)
    expect(result!.topics[0].accuracy).toBe(20)
    expect(result!.topics[1].name).toBe('Algebra')
    expect(result!.topics[1].mastery).toBe(80)
  })

  it('computes weak areas with correct reasons', async () => {
    mockDb.examProfiles.get.mockResolvedValue({
      id: 'p1', name: 'Test', examDate: '', examType: 'custom',
      passingThreshold: 50, weeklyTargetHours: 10,
    })
    mockDb.subjects.where.mockReturnValue(makeChain({
      sortBy: [
        { id: 's1', name: 'Math', weight: 60, mastery: 0.5, color: 'red', order: 0, examProfileId: 'p1' },
      ],
    }))
    mockDb.topics.where.mockReturnValue(makeChain({
      toArray: [
        { id: 't1', subjectId: 's1', name: 'Not Practiced', mastery: 0.0, questionsAttempted: 0, questionsCorrect: 0, nextReviewDate: '2026-04-10', examProfileId: 'p1' },
        { id: 't2', subjectId: 's1', name: 'Low Accuracy', mastery: 0.2, questionsAttempted: 10, questionsCorrect: 2, nextReviewDate: '2026-04-10', examProfileId: 'p1' },
        { id: 't3', subjectId: 's1', name: 'Low Mastery', mastery: 0.25, questionsAttempted: 10, questionsCorrect: 7, nextReviewDate: '2026-04-10', examProfileId: 'p1' },
      ],
    }))
    mockDb.flashcardDecks.where.mockReturnValue(makeChain({ toArray: [] }))
    mockDb.flashcards.where.mockReturnValue(makeChain({ toArray: [] }))

    const result = await computeReportData('p1')

    expect(result!.weakAreas.length).toBeLessThanOrEqual(5)
    const reasons = result!.weakAreas.map(w => w.reason)
    expect(reasons).toContain('Not yet practiced')
    expect(reasons.some(r => r.includes('Low accuracy'))).toBe(true)
  })

  it('builds study heatmap with 35 entries', async () => {
    mockDb.examProfiles.get.mockResolvedValue({
      id: 'p1', name: 'Test', examDate: '', examType: 'custom',
      passingThreshold: 50, weeklyTargetHours: 10,
    })
    mockDb.subjects.where.mockReturnValue(makeChain({ sortBy: [] }))
    mockDb.flashcardDecks.where.mockReturnValue(makeChain({ toArray: [] }))
    mockDb.flashcards.where.mockReturnValue(makeChain({ toArray: [] }))

    const result = await computeReportData('p1')

    expect(result!.studyHeatmap).toHaveLength(35)
    for (const entry of result!.studyHeatmap) {
      expect(entry).toHaveProperty('date')
      expect(entry).toHaveProperty('hours')
    }
  })

  it('handles examDate as empty string (no deadline)', async () => {
    mockDb.examProfiles.get.mockResolvedValue({
      id: 'p1', name: 'Test', examDate: '', examType: 'custom',
      passingThreshold: 50, weeklyTargetHours: 10,
    })
    mockDb.subjects.where.mockReturnValue(makeChain({ sortBy: [] }))
    mockDb.flashcardDecks.where.mockReturnValue(makeChain({ toArray: [] }))
    mockDb.flashcards.where.mockReturnValue(makeChain({ toArray: [] }))

    const result = await computeReportData('p1')

    expect(result!.profile.examDate).toBeUndefined()
  })

  it('computes mastery trajectory from snapshots', async () => {
    const today = new Date().toISOString().slice(0, 10)

    mockDb.examProfiles.get.mockResolvedValue({
      id: 'p1', name: 'Test', examDate: '', examType: 'custom',
      passingThreshold: 50, weeklyTargetHours: 10,
    })
    mockDb.subjects.where.mockReturnValue(makeChain({
      sortBy: [
        { id: 's1', name: 'Math', weight: 60, mastery: 0.5, color: 'red', order: 0, examProfileId: 'p1' },
      ],
    }))
    mockDb.topics.where.mockReturnValue(makeChain({
      toArray: [
        { id: 't1', subjectId: 's1', name: 'Algebra', mastery: 0.5, questionsAttempted: 5, questionsCorrect: 3, nextReviewDate: today, examProfileId: 'p1' },
      ],
    }))
    mockDb.masterySnapshots.where.mockReturnValue(makeChain({
      toArray: [
        { topicId: 't1', date: today, mastery: 0.5, examProfileId: 'p1' },
      ],
    }))
    mockDb.flashcardDecks.where.mockReturnValue(makeChain({ toArray: [] }))
    mockDb.flashcards.where.mockReturnValue(makeChain({ toArray: [] }))

    const result = await computeReportData('p1')

    expect(result!.masteryTrajectory.size).toBe(1)
    const trajectory = result!.masteryTrajectory.get('s1')
    expect(trajectory).toBeDefined()
    expect(trajectory![0].mastery).toBe(0.5)
  })

  it('returns subject data with correct fields', async () => {
    mockDb.examProfiles.get.mockResolvedValue({
      id: 'p1', name: 'Test', examDate: '', examType: 'custom',
      passingThreshold: 50, weeklyTargetHours: 10,
    })
    mockDb.subjects.where.mockReturnValue(makeChain({
      sortBy: [
        { id: 's1', name: 'Math', weight: 60, mastery: 0.5, color: 'red', order: 0, examProfileId: 'p1' },
        { id: 's2', name: 'Science', weight: 40, mastery: 0.7, color: 'blue', order: 1, examProfileId: 'p1' },
      ],
    }))
    mockDb.flashcardDecks.where.mockReturnValue(makeChain({ toArray: [] }))
    mockDb.flashcards.where.mockReturnValue(makeChain({ toArray: [] }))

    const result = await computeReportData('p1')

    expect(result!.subjects).toHaveLength(2)
    expect(result!.subjects[0]).toEqual({
      id: 's1', name: 'Math', mastery: 0.5, color: 'red', weight: 60,
    })
  })
})
