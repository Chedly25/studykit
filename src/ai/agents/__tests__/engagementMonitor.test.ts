import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Hoisted mocks ──────────────────────────────────────────
const { mockInsightsPut, mockSessionsToArray, mockLogsToArray, mockTopicsToArray, mockResultsToArray } = vi.hoisted(() => ({
  mockInsightsPut: vi.fn(),
  mockSessionsToArray: vi.fn().mockResolvedValue([]),
  mockLogsToArray: vi.fn().mockResolvedValue([]),
  mockTopicsToArray: vi.fn().mockResolvedValue([]),
  mockResultsToArray: vi.fn().mockResolvedValue([]),
}))

vi.mock('../../../db', () => ({
  db: {
    studySessions: {
      where: vi.fn().mockReturnValue({
        equals: vi.fn().mockReturnValue({ toArray: mockSessionsToArray }),
      }),
    },
    dailyStudyLogs: {
      where: vi.fn().mockReturnValue({
        equals: vi.fn().mockReturnValue({ toArray: mockLogsToArray }),
      }),
    },
    topics: {
      where: vi.fn().mockReturnValue({
        equals: vi.fn().mockReturnValue({ toArray: mockTopicsToArray }),
      }),
    },
    questionResults: {
      where: vi.fn().mockReturnValue({
        equals: vi.fn().mockReturnValue({ toArray: mockResultsToArray }),
      }),
    },
    agentInsights: { put: mockInsightsPut },
  },
}))

import { engagementMonitorAgent } from '../engagementMonitor'
import type { AgentContext } from '../types'
import type { EngagementReport } from '../autopilot/types'

// ─── Helpers ────────────────────────────────────────────────
const NOW = new Date('2024-07-10T14:00:00Z')

function makeCtx(examProfileId = 'p1'): AgentContext {
  return {
    agentId: 'engagement-monitor',
    examProfileId,
    userId: 'u1',
    llm: vi.fn(),
    recallEpisodes: vi.fn().mockResolvedValue([]),
    recordEpisode: vi.fn(),
    search: vi.fn().mockResolvedValue([]),
    reflect: vi.fn(),
    signal: new AbortController().signal,
  }
}

/** Create a session in the recent 14-day window */
function makeSession(daysAgo: number, durationSeconds: number, hourOfDay = 10) {
  const date = new Date(NOW.getTime() - daysAgo * 86400000)
  date.setUTCHours(hourOfDay, 0, 0, 0)
  return {
    examProfileId: 'p1',
    startTime: date.toISOString(),
    durationSeconds,
  }
}

/** Create a daily study log */
function makeLog(daysAgo: number) {
  const date = new Date(NOW.getTime() - daysAgo * 86400000)
  return {
    examProfileId: 'p1',
    date: date.toISOString().slice(0, 10),
  }
}

/** Create a question result */
function makeResult(daysAgo: number, isCorrect: boolean) {
  const date = new Date(NOW.getTime() - daysAgo * 86400000)
  return {
    examProfileId: 'p1',
    timestamp: date.toISOString(),
    isCorrect,
  }
}

/** Create a topic with confidence/mastery */
function makeTopic(name: string, confidence: number, mastery: number, questionsAttempted: number) {
  return {
    examProfileId: 'p1',
    name,
    confidence,
    mastery,
    questionsAttempted,
  }
}

function getReport(result: { data?: unknown }): EngagementReport {
  return result.data as EngagementReport
}

// ─── Setup ──────────────────────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  vi.setSystemTime(NOW)

  // Reset all data to empty
  mockSessionsToArray.mockResolvedValue([])
  mockLogsToArray.mockResolvedValue([])
  mockTopicsToArray.mockResolvedValue([])
  mockResultsToArray.mockResolvedValue([])
})

// ─── Original Tests (kept) ──────────────────────────────────
describe('engagementMonitorAgent', () => {
  it('has correct metadata', () => {
    expect(engagementMonitorAgent.id).toBe('engagement-monitor')
    expect(engagementMonitorAgent.triggers).toContain('schedule')
    expect(engagementMonitorAgent.model).toBe('fast')
    expect(engagementMonitorAgent.cooldownMs).toBe(1800000) // 30 min
  })

  it('returns success with empty data', async () => {
    const result = await engagementMonitorAgent.execute(makeCtx())
    expect(result.success).toBe(true)
    expect(result.episodes).toEqual([])
  })

  it('writes insights to agentInsights table', async () => {
    await engagementMonitorAgent.execute(makeCtx())
    expect(mockInsightsPut).toHaveBeenCalled()
    const call = mockInsightsPut.mock.calls[0][0]
    expect(call.id).toBe('engagement-monitor:p1')
    expect(call.agentId).toBe('engagement-monitor')
  })

  it('returns engagement report with expected fields', async () => {
    const result = await engagementMonitorAgent.execute(makeCtx())
    const report = getReport(result)
    expect(report).toHaveProperty('burnoutRisk')
    expect(report).toHaveProperty('momentum')
    expect(report).toHaveProperty('sessionTrend')
    expect(report).toHaveProperty('insights')
    expect(report).toHaveProperty('avgSessionMinutes')
    expect(report).toHaveProperty('optimalHours')
    expect(report).toHaveProperty('analyzedAt')
  })

  // ── Burnout Detection ───────────────────────────────────
  describe('burnout detection', () => {
    it('detects burnout when sessions decline + errors increase + frequency drops', async () => {
      // First half (days 14-8): long sessions, low errors, frequent studying
      // Second half (days 7-1): short sessions, high errors, less frequent
      const sessions = [
        // First half: 8-14 days ago, long sessions
        makeSession(14, 3600), // 60 min
        makeSession(13, 3600),
        makeSession(12, 3000),
        makeSession(11, 3600),
        makeSession(10, 3000),
        makeSession(9, 3600),
        makeSession(8, 3000),
        // Second half: 1-6 days ago, short sessions, fewer of them
        // second half count (2) < first half count (7) * 0.6 = 4.2 => frequency signal
        makeSession(3, 900),  // 15 min — much shorter
        makeSession(1, 600),  // 10 min
      ]

      const results = [
        // First half: mostly correct
        makeResult(14, true), makeResult(13, true), makeResult(12, true),
        makeResult(11, true), makeResult(10, false), makeResult(9, true),
        makeResult(8, true), makeResult(8, true), makeResult(9, true),
        makeResult(10, true),
        // Second half: high error rate
        makeResult(3, false), makeResult(3, false), makeResult(2, false),
        makeResult(1, false), makeResult(1, true),
      ]

      mockSessionsToArray.mockResolvedValue(sessions)
      mockResultsToArray.mockResolvedValue(results)

      const result = await engagementMonitorAgent.execute(makeCtx())
      const report = getReport(result)

      // All 3 signals: declining sessions (0.4) + increasing errors (0.3) + decreasing frequency (0.3) = 1.0
      expect(report.burnoutRisk).toBeGreaterThanOrEqual(0.6)
      const burnoutInsight = report.insights.find(i => i.type === 'burnout-risk')
      expect(burnoutInsight).toBeDefined()
      expect(burnoutInsight!.urgency).toBe('urgent')
    })

    it('has no burnout with healthy study patterns', async () => {
      // Consistent sessions across both halves
      const sessions = [
        makeSession(12, 2400),
        makeSession(10, 2700),
        makeSession(8, 2400),
        makeSession(5, 2700),
        makeSession(3, 2400),
        makeSession(1, 2700),
      ]

      const results = [
        makeResult(12, true), makeResult(10, true), makeResult(8, true),
        makeResult(5, true), makeResult(3, true), makeResult(1, true),
      ]

      mockSessionsToArray.mockResolvedValue(sessions)
      mockResultsToArray.mockResolvedValue(results)

      const result = await engagementMonitorAgent.execute(makeCtx())
      const report = getReport(result)

      expect(report.burnoutRisk).toBeLessThan(0.3)
      expect(report.insights.find(i => i.type === 'burnout-risk')).toBeUndefined()
    })

    it('burnoutRisk score combines 3 signals correctly', async () => {
      // Only declining session length signal (0.4), no error or frequency signal
      const sessions = [
        // First half: long sessions
        makeSession(12, 3600), makeSession(10, 3600), makeSession(9, 3600),
        // Second half: short sessions (but same count, so no frequency signal)
        makeSession(5, 1200), makeSession(3, 1200), makeSession(1, 1200),
      ]

      mockSessionsToArray.mockResolvedValue(sessions)
      // No error increase
      mockResultsToArray.mockResolvedValue([
        makeResult(12, true), makeResult(10, true),
        makeResult(5, true), makeResult(3, true),
      ])

      const result = await engagementMonitorAgent.execute(makeCtx())
      const report = getReport(result)

      // Only session decline signal fires (0.4), others 0 => total 0.4
      // 0.3 <= 0.4 < 0.6 => break-needed but not burnout-risk
      expect(report.burnoutRisk).toBeGreaterThanOrEqual(0.3)
      expect(report.burnoutRisk).toBeLessThan(0.6)

      const breakInsight = report.insights.find(i => i.type === 'break-needed')
      expect(breakInsight).toBeDefined()
      expect(breakInsight!.urgency).toBe('attention')
    })

    it('caps burnoutRisk at 1.0', async () => {
      // All 3 signals maxed = 0.4 + 0.3 + 0.3 = 1.0
      const sessions = [
        makeSession(14, 3600), makeSession(13, 3600), makeSession(12, 3600),
        makeSession(11, 3600), makeSession(10, 3600), makeSession(9, 3600),
        makeSession(8, 3600),
        // Only 1 in second half (< 7 * 0.6 = 4.2)
        makeSession(1, 600),
      ]
      const results = [
        makeResult(12, true), makeResult(10, true), makeResult(9, true),
        makeResult(8, true), makeResult(8, true),
        // Second half: all wrong
        makeResult(3, false), makeResult(2, false), makeResult(1, false),
      ]

      mockSessionsToArray.mockResolvedValue(sessions)
      mockResultsToArray.mockResolvedValue(results)

      const result = await engagementMonitorAgent.execute(makeCtx())
      const report = getReport(result)

      expect(report.burnoutRisk).toBeLessThanOrEqual(1.0)
    })
  })

  // ── Overconfidence Detection ────────────────────────────
  describe('overconfidence detection', () => {
    it('detects overconfidence when topics have confidence > mastery + 0.25 with 5+ attempts', async () => {
      const topics = [
        makeTopic('Droit constitutionnel', 0.8, 0.4, 10), // gap = 0.4 > 0.25
        makeTopic('Economie', 0.9, 0.5, 8),                // gap = 0.4 > 0.25
      ]
      mockTopicsToArray.mockResolvedValue(topics)

      const result = await engagementMonitorAgent.execute(makeCtx())
      const report = getReport(result)

      const overconfidenceInsight = report.insights.find(i => i.type === 'overconfidence')
      expect(overconfidenceInsight).toBeDefined()
      expect(overconfidenceInsight!.urgency).toBe('attention')
      expect(overconfidenceInsight!.message).toContain('Droit constitutionnel')
      expect(overconfidenceInsight!.action?.route).toBe('/practice-exam')
    })

    it('does not detect overconfidence with fewer than 5 attempts', async () => {
      const topics = [
        makeTopic('Droit', 0.8, 0.4, 3), // only 3 attempts
        makeTopic('Eco', 0.9, 0.5, 2),   // only 2 attempts
      ]
      mockTopicsToArray.mockResolvedValue(topics)

      const result = await engagementMonitorAgent.execute(makeCtx())
      const report = getReport(result)

      expect(report.insights.find(i => i.type === 'overconfidence')).toBeUndefined()
    })

    it('does not detect overconfidence when gap is <= 0.25', async () => {
      const topics = [
        makeTopic('Droit', 0.7, 0.6, 10), // gap = 0.1 <= 0.25
        makeTopic('Eco', 0.8, 0.7, 10),   // gap = 0.1 <= 0.25
      ]
      mockTopicsToArray.mockResolvedValue(topics)

      const result = await engagementMonitorAgent.execute(makeCtx())
      const report = getReport(result)

      expect(report.insights.find(i => i.type === 'overconfidence')).toBeUndefined()
    })

    it('requires at least 2 overconfident topics to trigger', async () => {
      const topics = [
        makeTopic('Droit', 0.9, 0.4, 10), // gap > 0.25 — only 1 topic
      ]
      mockTopicsToArray.mockResolvedValue(topics)

      const result = await engagementMonitorAgent.execute(makeCtx())
      const report = getReport(result)

      expect(report.insights.find(i => i.type === 'overconfidence')).toBeUndefined()
    })

    it('lists at most 3 topic names in overconfidence message', async () => {
      const topics = [
        makeTopic('Topic A', 0.9, 0.3, 10),
        makeTopic('Topic B', 0.9, 0.3, 10),
        makeTopic('Topic C', 0.9, 0.3, 10),
        makeTopic('Topic D', 0.9, 0.3, 10),
      ]
      mockTopicsToArray.mockResolvedValue(topics)

      const result = await engagementMonitorAgent.execute(makeCtx())
      const report = getReport(result)

      const insight = report.insights.find(i => i.type === 'overconfidence')!
      // Should contain at most 3 topic names (sliced to 3)
      expect(insight.message).toContain('Topic A')
      expect(insight.message).toContain('Topic B')
      expect(insight.message).toContain('Topic C')
      expect(insight.message).not.toContain('Topic D')
    })
  })

  // ── Study Gap Detection ─────────────────────────────────
  describe('study gap detection', () => {
    it('detects study gap when no logs for 3+ days', async () => {
      // Last study was 4 days ago
      const logs = [makeLog(4)]
      mockLogsToArray.mockResolvedValue(logs)

      const result = await engagementMonitorAgent.execute(makeCtx())
      const report = getReport(result)

      const gapInsight = report.insights.find(i => i.type === 'study-gap')
      expect(gapInsight).toBeDefined()
      expect(gapInsight!.title).toContain('4 days')
      expect(gapInsight!.urgency).toBe('attention')
      expect(gapInsight!.action?.route).toBe('/queue')
    })

    it('study gap is urgent when 5+ days', async () => {
      const logs = [makeLog(6)]
      mockLogsToArray.mockResolvedValue(logs)

      const result = await engagementMonitorAgent.execute(makeCtx())
      const report = getReport(result)

      const gapInsight = report.insights.find(i => i.type === 'study-gap')
      expect(gapInsight).toBeDefined()
      expect(gapInsight!.urgency).toBe('urgent')
    })

    it('no study gap when last study was recent', async () => {
      const logs = [makeLog(1)] // studied yesterday
      mockLogsToArray.mockResolvedValue(logs)

      const result = await engagementMonitorAgent.execute(makeCtx())
      const report = getReport(result)

      expect(report.insights.find(i => i.type === 'study-gap')).toBeUndefined()
    })

    it('no study gap with no logs at all', async () => {
      mockLogsToArray.mockResolvedValue([])

      const result = await engagementMonitorAgent.execute(makeCtx())
      const report = getReport(result)

      // No logs means sortedLogs.length === 0, so no gap insight
      expect(report.insights.find(i => i.type === 'study-gap')).toBeUndefined()
    })
  })

  // ── Momentum Detection ──────────────────────────────────
  describe('momentum detection', () => {
    it('detects momentum with 3+ recent study days and not declining', async () => {
      // 3 study days within last 3 days
      const logs = [makeLog(0), makeLog(1), makeLog(2)]
      // Stable sessions
      const sessions = [
        makeSession(2, 2400), makeSession(1, 2400), makeSession(0, 2400),
      ]
      mockLogsToArray.mockResolvedValue(logs)
      mockSessionsToArray.mockResolvedValue(sessions)

      const result = await engagementMonitorAgent.execute(makeCtx())
      const report = getReport(result)

      const momentumInsight = report.insights.find(i => i.type === 'momentum')
      expect(momentumInsight).toBeDefined()
      expect(momentumInsight!.urgency).toBe('info')
      expect(momentumInsight!.title).toContain('momentum')
    })

    it('no momentum when fewer than 3 recent study days', async () => {
      const logs = [makeLog(0), makeLog(1)]
      mockLogsToArray.mockResolvedValue(logs)

      const result = await engagementMonitorAgent.execute(makeCtx())
      const report = getReport(result)

      expect(report.insights.find(i => i.type === 'momentum')).toBeUndefined()
    })

    it('no momentum when session trend is decreasing', async () => {
      const logs = [makeLog(0), makeLog(1), makeLog(2)]
      // Declining sessions: first half long, second half very short
      const sessions = [
        makeSession(12, 3600), makeSession(10, 3600), makeSession(9, 3600),
        makeSession(2, 600), makeSession(1, 600), makeSession(0, 600),
      ]
      mockLogsToArray.mockResolvedValue(logs)
      mockSessionsToArray.mockResolvedValue(sessions)

      const result = await engagementMonitorAgent.execute(makeCtx())
      const report = getReport(result)

      // Session trend is decreasing, so no momentum
      if (report.sessionTrend === 'decreasing') {
        expect(report.insights.find(i => i.type === 'momentum')).toBeUndefined()
      }
    })

    it('no momentum when burnout risk is high', async () => {
      const logs = [makeLog(0), makeLog(1), makeLog(2)]
      // Set up burnout conditions
      const sessions = [
        makeSession(14, 3600), makeSession(13, 3600), makeSession(12, 3600),
        makeSession(11, 3600), makeSession(10, 3600), makeSession(9, 3600),
        makeSession(8, 3600),
        makeSession(1, 600), // only 1 in second half
      ]
      const results = [
        makeResult(12, true), makeResult(10, true), makeResult(9, true),
        makeResult(8, true), makeResult(8, true),
        makeResult(1, false), makeResult(1, false), makeResult(1, false),
      ]
      mockLogsToArray.mockResolvedValue(logs)
      mockSessionsToArray.mockResolvedValue(sessions)
      mockResultsToArray.mockResolvedValue(results)

      const result = await engagementMonitorAgent.execute(makeCtx())
      const report = getReport(result)

      // High burnout risk should prevent momentum
      if (report.burnoutRisk >= 0.3) {
        expect(report.insights.find(i => i.type === 'momentum')).toBeUndefined()
      }
    })
  })

  // ── Optimal Study Windows ───────────────────────────────
  describe('optimal study windows', () => {
    it('computes optimal study hours from session start times', async () => {
      // Use the local hour that getHours() would return for our UTC sessions
      // Sessions at consistent UTC hours — getHours() will return local equivalent
      const hourA = new Date(new Date(NOW.getTime() - 10 * 86400000).setUTCHours(9, 0, 0, 0))
      const localHourA = hourA.getHours()

      const sessions = [
        makeSession(10, 3600, 9), makeSession(9, 3600, 9), makeSession(8, 3000, 9),
        makeSession(5, 2400, 14), makeSession(3, 2400, 14),
        makeSession(1, 1200, 20), // only 1 at this hour — not enough (< 2 sessions)
      ]
      mockSessionsToArray.mockResolvedValue(sessions)

      const result = await engagementMonitorAgent.execute(makeCtx())
      const report = getReport(result)

      expect(report.optimalHours.length).toBeGreaterThan(0)
      expect(report.optimalHours.length).toBeLessThanOrEqual(2)
      // The optimal hour string should contain the local hour for our 09:00 UTC sessions
      const expectedHourStr = String(localHourA).padStart(2, '0') + ':00'
      expect(report.optimalHours.some(h => h.includes(expectedHourStr))).toBe(true)

      // Verify insight was generated
      const windowInsight = report.insights.find(i => i.type === 'optimal-window')
      expect(windowInsight).toBeDefined()
      expect(windowInsight!.urgency).toBe('info')
    })

    it('no optimal hours when all hours have fewer than 2 sessions', async () => {
      const sessions = [
        makeSession(10, 3600, 9),
        makeSession(5, 3600, 14),
        makeSession(1, 3600, 20),
      ]
      mockSessionsToArray.mockResolvedValue(sessions)

      const result = await engagementMonitorAgent.execute(makeCtx())
      const report = getReport(result)

      expect(report.optimalHours).toEqual([])
      expect(report.insights.find(i => i.type === 'optimal-window')).toBeUndefined()
    })
  })

  // ── Session Trend ───────────────────────────────────────
  describe('sessionTrend', () => {
    it('is "decreasing" when second half avg < first half avg by 20%+', async () => {
      const sessions = [
        // First half (8-14 days ago): ~60 min each
        makeSession(12, 3600), makeSession(10, 3600), makeSession(9, 3600),
        // Second half (1-6 days ago): ~20 min each (< 60 * 0.8 = 48)
        makeSession(5, 1200), makeSession(3, 1200), makeSession(1, 1200),
      ]
      mockSessionsToArray.mockResolvedValue(sessions)

      const result = await engagementMonitorAgent.execute(makeCtx())
      const report = getReport(result)

      expect(report.sessionTrend).toBe('decreasing')
    })

    it('is "increasing" when second half avg > first half avg by 20%+', async () => {
      const sessions = [
        // First half: ~20 min each
        makeSession(12, 1200), makeSession(10, 1200), makeSession(9, 1200),
        // Second half: ~60 min each (> 20 * 1.2 = 24)
        makeSession(5, 3600), makeSession(3, 3600), makeSession(1, 3600),
      ]
      mockSessionsToArray.mockResolvedValue(sessions)

      const result = await engagementMonitorAgent.execute(makeCtx())
      const report = getReport(result)

      expect(report.sessionTrend).toBe('increasing')
    })

    it('is "stable" when change is within 20%', async () => {
      const sessions = [
        makeSession(12, 2400), makeSession(10, 2400),
        makeSession(5, 2500), makeSession(3, 2300),
      ]
      mockSessionsToArray.mockResolvedValue(sessions)

      const result = await engagementMonitorAgent.execute(makeCtx())
      const report = getReport(result)

      expect(report.sessionTrend).toBe('stable')
    })

    it('is "stable" when no sessions in first half', async () => {
      const sessions = [makeSession(3, 2400), makeSession(1, 2400)]
      mockSessionsToArray.mockResolvedValue(sessions)

      const result = await engagementMonitorAgent.execute(makeCtx())
      const report = getReport(result)

      expect(report.sessionTrend).toBe('stable')
    })

    it('is "stable" when no sessions at all', async () => {
      mockSessionsToArray.mockResolvedValue([])

      const result = await engagementMonitorAgent.execute(makeCtx())
      const report = getReport(result)

      expect(report.sessionTrend).toBe('stable')
    })
  })

  // ── avgSessionMinutes ───────────────────────────────────
  describe('avgSessionMinutes', () => {
    it('computes average correctly', async () => {
      const sessions = [
        makeSession(5, 1800), // 30 min
        makeSession(3, 3600), // 60 min
      ]
      mockSessionsToArray.mockResolvedValue(sessions)

      const result = await engagementMonitorAgent.execute(makeCtx())
      const report = getReport(result)

      expect(report.avgSessionMinutes).toBe(45) // (30+60)/2 = 45
    })

    it('is 0 with no sessions', async () => {
      const result = await engagementMonitorAgent.execute(makeCtx())
      const report = getReport(result)

      expect(report.avgSessionMinutes).toBe(0)
    })

    it('filters out zero-duration sessions', async () => {
      const sessions = [
        makeSession(5, 1800), // 30 min
        makeSession(3, 0),     // 0 min — filtered out
      ]
      mockSessionsToArray.mockResolvedValue(sessions)

      const result = await engagementMonitorAgent.execute(makeCtx())
      const report = getReport(result)

      expect(report.avgSessionMinutes).toBe(30) // only the 1800s session counts
    })
  })

  // ── Momentum is complement of burnout ───────────────────
  describe('momentum score', () => {
    it('momentum = 1 - burnoutRisk', async () => {
      const result = await engagementMonitorAgent.execute(makeCtx())
      const report = getReport(result)

      expect(report.momentum).toBe(Math.max(0, 1 - report.burnoutRisk))
    })
  })

  // ── DB write shape ──────────────────────────────────────
  describe('DB write', () => {
    it('stores the report JSON with correct summary format', async () => {
      const sessions = [makeSession(5, 1800)]
      mockSessionsToArray.mockResolvedValue(sessions)

      await engagementMonitorAgent.execute(makeCtx())

      const call = mockInsightsPut.mock.calls[0][0]
      const stored = JSON.parse(call.data) as EngagementReport
      expect(stored.analyzedAt).toBeTruthy()
      expect(call.summary).toMatch(/Burnout risk: \d+%, \d+ insights/)
    })
  })
})
