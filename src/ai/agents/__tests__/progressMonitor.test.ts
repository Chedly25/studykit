import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../db', () => ({
  db: {
    examProfiles: { get: vi.fn() },
    topics: { where: vi.fn().mockReturnValue({ equals: vi.fn().mockReturnValue({ toArray: vi.fn() }) }) },
    subjects: { where: vi.fn().mockReturnValue({ equals: vi.fn().mockReturnValue({ toArray: vi.fn() }) }) },
    dailyStudyLogs: { where: vi.fn().mockReturnValue({ equals: vi.fn().mockReturnValue({ toArray: vi.fn() }) }) },
    masterySnapshots: { where: vi.fn().mockReturnValue({ equals: vi.fn().mockReturnValue({ toArray: vi.fn() }) }) },
    agentInsights: { put: vi.fn() },
  },
}))

import { progressMonitorAgent } from '../progressMonitor'
import { db } from '../../../db'
import type { AgentContext } from '../types'
import type { ProgressInsight } from '../progressMonitor'

function makeCtx(): AgentContext {
  return {
    agentId: 'progress-monitor', examProfileId: 'p1', userId: 'u1',
    llm: vi.fn(), recallEpisodes: vi.fn().mockResolvedValue([]),
    recordEpisode: vi.fn().mockResolvedValue('ep-1'),
    search: vi.fn().mockResolvedValue([]), reflect: vi.fn(),
    signal: new AbortController().signal,
  } as AgentContext
}

describe('progressMonitorAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.examProfiles.get).mockResolvedValue({
      id: 'p1', name: 'Test', examType: 'custom', examDate: '',
      isActive: true, passingThreshold: 70, weeklyTargetHours: 10, createdAt: '',
    })
    vi.mocked(db.topics.where('examProfileId').equals('p1').toArray).mockResolvedValue([])
    vi.mocked(db.subjects.where('examProfileId').equals('p1').toArray).mockResolvedValue([])
    vi.mocked(db.dailyStudyLogs.where('examProfileId').equals('p1').toArray).mockResolvedValue([])
    vi.mocked(db.masterySnapshots.where('examProfileId').equals('p1').toArray).mockResolvedValue([])
  })

  it('returns empty when no data', async () => {
    const result = await progressMonitorAgent.execute(makeCtx())
    expect(result.success).toBe(true)
    expect(result.summary).toContain('No data')
  })

  it('detects exam approaching with weak topics', async () => {
    const examDate = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10)
    vi.mocked(db.examProfiles.get).mockResolvedValue({
      id: 'p1', name: 'Test', examType: 'custom', examDate,
      isActive: true, passingThreshold: 70, weeklyTargetHours: 10, createdAt: '',
    })
    vi.mocked(db.topics.where('examProfileId').equals('p1').toArray).mockResolvedValue([
      { id: 't1', subjectId: 's1', examProfileId: 'p1', name: 'Weak Topic', mastery: 0.3, confidence: 0.3, questionsAttempted: 5, questionsCorrect: 2, easeFactor: 2.5, interval: 5, repetitions: 1, nextReviewDate: new Date().toISOString().slice(0, 10) },
    ] as any)

    const result = await progressMonitorAgent.execute(makeCtx())
    const insights = result.data as ProgressInsight[]
    const examInsight = insights.find(i => i.type === 'exam-approaching')
    expect(examInsight).toBeDefined()
    expect(examInsight!.urgency).toBe('urgent')
    expect(examInsight!.surface).toBe('queue')
  })

  it('detects study gap of 3+ days', async () => {
    const oldDate = new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10)
    vi.mocked(db.topics.where('examProfileId').equals('p1').toArray).mockResolvedValue([
      { id: 't1', subjectId: 's1', examProfileId: 'p1', name: 'Topic', mastery: 0.5, confidence: 0.5, questionsAttempted: 5, questionsCorrect: 3, easeFactor: 2.5, interval: 5, repetitions: 2, nextReviewDate: new Date().toISOString().slice(0, 10) },
    ] as any)
    vi.mocked(db.dailyStudyLogs.where('examProfileId').equals('p1').toArray).mockResolvedValue([
      { id: `p1:${oldDate}`, examProfileId: 'p1', date: oldDate, totalSeconds: 3600, subjectBreakdown: [], questionsAnswered: 0, questionsCorrect: 0 },
    ] as any)

    const result = await progressMonitorAgent.execute(makeCtx())
    const insights = result.data as ProgressInsight[]
    const gapInsight = insights.find(i => i.type === 'study-gap')
    expect(gapInsight).toBeDefined()
    expect(gapInsight!.urgency).toBe('attention')
  })

  it('writes insights to agentInsights table', async () => {
    vi.mocked(db.topics.where('examProfileId').equals('p1').toArray).mockResolvedValue([
      { id: 't1', subjectId: 's1', examProfileId: 'p1', name: 'Topic', mastery: 0.5, confidence: 0.5, questionsAttempted: 5, questionsCorrect: 3, easeFactor: 2.5, interval: 5, repetitions: 2, nextReviewDate: new Date().toISOString().slice(0, 10) },
    ] as any)

    await progressMonitorAgent.execute(makeCtx())
    expect(db.agentInsights.put).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'progress-monitor:p1', agentId: 'progress-monitor' })
    )
  })

  it('has correct agent definition', () => {
    expect(progressMonitorAgent.id).toBe('progress-monitor')
    expect(progressMonitorAgent.triggers).toContain('schedule')
    expect(progressMonitorAgent.triggers).toContain('app-open')
  })
})
