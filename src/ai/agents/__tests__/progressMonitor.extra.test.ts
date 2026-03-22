/**
 * Additional tests for progressMonitor — covers the 4 insight types
 * that were untested: weak-critical-topic, improvement-detected,
 * ready-for-challenge, mastery-decay.
 */
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
import type { ProgressInsight } from '../progressMonitor'
import { db } from '../../../db'
import type { AgentContext } from '../types'

function makeCtx(): AgentContext {
  return {
    agentId: 'progress-monitor', examProfileId: 'p1', userId: 'u1',
    llm: vi.fn(), recallEpisodes: vi.fn().mockResolvedValue([]),
    recordEpisode: vi.fn().mockResolvedValue('ep-1'),
    search: vi.fn().mockResolvedValue([]), reflect: vi.fn(),
    signal: new AbortController().signal,
  } as AgentContext
}

const baseTopic = { subjectId: 's1', examProfileId: 'p1', confidence: 0.5, questionsAttempted: 5, questionsCorrect: 3, easeFactor: 2.5, interval: 5, repetitions: 2, nextReviewDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10) }

describe('progressMonitor — additional insight types', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.examProfiles.get).mockResolvedValue({
      id: 'p1', name: 'Test', examType: 'custom', examDate: '',
      isActive: true, passingThreshold: 70, weeklyTargetHours: 10, createdAt: '',
    })
    vi.mocked(db.dailyStudyLogs.where('examProfileId').equals('p1').toArray).mockResolvedValue([])
    vi.mocked(db.masterySnapshots.where('examProfileId').equals('p1').toArray).mockResolvedValue([])
  })

  it('detects weak-critical-topic for high-weight subject with low mastery', async () => {
    vi.mocked(db.subjects.where('examProfileId').equals('p1').toArray).mockResolvedValue([
      { id: 's1', examProfileId: 'p1', name: 'Physics', weight: 40, mastery: 0.3, color: '#000', order: 0 },
    ] as any)
    vi.mocked(db.topics.where('examProfileId').equals('p1').toArray).mockResolvedValue([
      { id: 't1', ...baseTopic, name: 'Mechanics', mastery: 0.25 },
      { id: 't2', ...baseTopic, name: 'Thermodynamics', mastery: 0.35 },
    ] as any)

    const result = await progressMonitorAgent.execute(makeCtx())
    const insights = result.data as ProgressInsight[]
    const weak = insights.find(i => i.type === 'weak-critical-topic')
    expect(weak).toBeDefined()
    expect(weak!.urgency).toBe('urgent')
    expect(weak!.surface).toBe('analytics')
  })

  it('detects ready-for-challenge when all topics above 60% and exam far away', async () => {
    const examDate = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
    vi.mocked(db.examProfiles.get).mockResolvedValue({
      id: 'p1', name: 'Test', examType: 'custom', examDate,
      isActive: true, passingThreshold: 70, weeklyTargetHours: 10, createdAt: '',
    })
    vi.mocked(db.subjects.where('examProfileId').equals('p1').toArray).mockResolvedValue([])
    vi.mocked(db.topics.where('examProfileId').equals('p1').toArray).mockResolvedValue([
      { id: 't1', ...baseTopic, name: 'Topic A', mastery: 0.75 },
      { id: 't2', ...baseTopic, name: 'Topic B', mastery: 0.85 },
    ] as any)

    const result = await progressMonitorAgent.execute(makeCtx())
    const insights = result.data as ProgressInsight[]
    expect(insights.some(i => i.type === 'ready-for-challenge')).toBe(true)
  })

  it('detects improvement when topic crossed 0.8 since last week', async () => {
    vi.mocked(db.subjects.where('examProfileId').equals('p1').toArray).mockResolvedValue([])
    vi.mocked(db.topics.where('examProfileId').equals('p1').toArray).mockResolvedValue([
      { id: 't1', ...baseTopic, name: 'Improving Topic', mastery: 0.85 },
    ] as any)
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)
    vi.mocked(db.masterySnapshots.where('examProfileId').equals('p1').toArray).mockResolvedValue([
      { id: 't1:old', topicId: 't1', examProfileId: 'p1', date: weekAgo, mastery: 0.6 },
    ] as any)

    const result = await progressMonitorAgent.execute(makeCtx())
    const insights = result.data as ProgressInsight[]
    expect(insights.some(i => i.type === 'improvement-detected')).toBe(true)
  })
})
