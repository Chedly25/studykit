import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../db', () => ({
  db: {
    examProfiles: { get: vi.fn() },
    topics: { where: vi.fn().mockReturnValue({ equals: vi.fn().mockReturnValue({ toArray: vi.fn() }) }) },
    subjects: { where: vi.fn().mockReturnValue({ equals: vi.fn().mockReturnValue({ toArray: vi.fn() }) }) },
    dailyStudyLogs: { where: vi.fn().mockReturnValue({ equals: vi.fn().mockReturnValue({ toArray: vi.fn() }) }) },
    masterySnapshots: { where: vi.fn().mockReturnValue({ equals: vi.fn().mockReturnValue({ toArray: vi.fn() }) }) },
    misconceptions: { where: vi.fn().mockReturnValue({ equals: vi.fn().mockReturnValue({ filter: vi.fn().mockReturnValue({ toArray: vi.fn() }) }) }) },
    agentInsights: { put: vi.fn() },
  },
}))

vi.mock('../../../lib/calibration', () => ({
  getMiscalibratedTopicsFromRaw: vi.fn().mockReturnValue([]),
}))

import { diagnosticianAgent } from '../diagnostician'
import { db } from '../../../db'
import type { AgentContext } from '../types'

function makeCtx(overrides: Partial<AgentContext> = {}): AgentContext {
  return {
    agentId: 'diagnostician',
    examProfileId: 'p1',
    userId: 'u1',
    llm: vi.fn(),
    recallEpisodes: vi.fn().mockResolvedValue([]),
    recordEpisode: vi.fn().mockResolvedValue('ep-1'),
    search: vi.fn().mockResolvedValue([]),
    reflect: vi.fn(),
    signal: new AbortController().signal,
    ...overrides,
  } as AgentContext
}

describe('diagnosticianAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.examProfiles.get).mockResolvedValue({
      id: 'p1', name: 'Test', examType: 'custom', examDate: '2026-04-15',
      isActive: true, passingThreshold: 70, weeklyTargetHours: 10, createdAt: '',
    })
    // Default: return empty arrays
    vi.mocked(db.topics.where('examProfileId').equals('p1').toArray).mockResolvedValue([])
    vi.mocked(db.subjects.where('examProfileId').equals('p1').toArray).mockResolvedValue([])
    vi.mocked(db.dailyStudyLogs.where('examProfileId').equals('p1').toArray).mockResolvedValue([])
    vi.mocked(db.masterySnapshots.where('examProfileId').equals('p1').toArray).mockResolvedValue([])
    vi.mocked(db.misconceptions.where('examProfileId').equals('p1').filter(vi.fn()).toArray).mockResolvedValue([])
  })

  it('returns empty report when no topics', async () => {
    const result = await diagnosticianAgent.execute(makeCtx())
    expect(result.success).toBe(true)
    expect(result.summary).toContain('No data')
  })

  it('identifies critical topics with low mastery and high weight', async () => {
    vi.mocked(db.topics.where('examProfileId').equals('p1').toArray).mockResolvedValue([
      { id: 't1', subjectId: 's1', examProfileId: 'p1', name: 'Algebra', mastery: 0.2, confidence: 0.3, questionsAttempted: 10, questionsCorrect: 2, easeFactor: 2.5, interval: 5, repetitions: 2, nextReviewDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10) },
    ] as any)
    vi.mocked(db.subjects.where('examProfileId').equals('p1').toArray).mockResolvedValue([
      { id: 's1', examProfileId: 'p1', name: 'Math', weight: 40, mastery: 0.2, color: '#000', order: 0 },
    ] as any)

    const result = await diagnosticianAgent.execute(makeCtx())
    expect(result.success).toBe(true)
    const report = result.data as any
    expect(report.priorities).toHaveLength(1)
    expect(report.priorities[0].urgency).toBe('critical')
    expect(report.priorities[0].topicName).toBe('Algebra')
  })

  it('writes insight to agentInsights table', async () => {
    vi.mocked(db.topics.where('examProfileId').equals('p1').toArray).mockResolvedValue([
      { id: 't1', subjectId: 's1', examProfileId: 'p1', name: 'Algebra', mastery: 0.5, confidence: 0.5, questionsAttempted: 5, questionsCorrect: 3, easeFactor: 2.5, interval: 5, repetitions: 2, nextReviewDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10) },
    ] as any)
    vi.mocked(db.subjects.where('examProfileId').equals('p1').toArray).mockResolvedValue([
      { id: 's1', examProfileId: 'p1', name: 'Math', weight: 50, mastery: 0.5, color: '#000', order: 0 },
    ] as any)

    await diagnosticianAgent.execute(makeCtx())
    expect(db.agentInsights.put).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'diagnostician:p1', agentId: 'diagnostician' })
    )
  })

  it('has correct agent definition properties', () => {
    expect(diagnosticianAgent.id).toBe('diagnostician')
    expect(diagnosticianAgent.triggers).toContain('app-open')
    expect(diagnosticianAgent.model).toBe('fast')
    expect(diagnosticianAgent.cooldownMs).toBe(3600000)
  })
})
