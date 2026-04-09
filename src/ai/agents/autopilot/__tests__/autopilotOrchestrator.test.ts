import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Hoisted mocks ──────────────────────────────────────────
const mocks = vi.hoisted(() => ({
  isAutopilotEnabled: vi.fn(),
  loadConfig: vi.fn(),
  isPhaseCooledDown: vi.fn(),
  markPhaseRun: vi.fn(),
  canSpendLlm: vi.fn(),
  recordLlmCall: vi.fn(),
  generateMorningBriefing: vi.fn(),
  dbAgentInsightsGet: vi.fn(),
  dbAgentInsightsPut: vi.fn(),
  dbQuestionResultsWhere: vi.fn(),
}))

// ─── Module mocks ───────────────────────────────────────────
vi.mock('../budgetTracker', () => ({
  isAutopilotEnabled: mocks.isAutopilotEnabled,
  loadConfig: mocks.loadConfig,
  isPhaseCooledDown: mocks.isPhaseCooledDown,
  markPhaseRun: mocks.markPhaseRun,
  canSpendLlm: mocks.canSpendLlm,
  recordLlmCall: mocks.recordLlmCall,
}))

vi.mock('../morningBriefing', () => ({
  generateMorningBriefing: mocks.generateMorningBriefing,
}))

vi.mock('../../../../db', () => ({
  db: {
    questionResults: {
      where: (...args: unknown[]) => mocks.dbQuestionResultsWhere(...args),
    },
    agentInsights: {
      get: (...args: unknown[]) => mocks.dbAgentInsightsGet(...args),
      put: (...args: unknown[]) => mocks.dbAgentInsightsPut(...args),
    },
  },
}))

import { runAutopilotSweep } from '../autopilotOrchestrator'
import type { AutopilotConfig } from '../types'

// ─── Helpers ────────────────────────────────────────────────
const PROFILE_ID = 'exam-profile-1'

function makeConfig(overrides: Partial<AutopilotConfig> = {}): AutopilotConfig {
  return {
    enabled: true,
    tier: 'free',
    maxDailyLlmCalls: 8,
    enabledPhases: { scout: true, forge: true, eval: true, plan: true, pulse: true },
    ...overrides,
  }
}

function mockQuestionResultsChain(count: number) {
  mocks.dbQuestionResultsWhere.mockReturnValue({
    equals: vi.fn().mockReturnValue({
      filter: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          count: vi.fn().mockResolvedValue(count),
        }),
      }),
    }),
  })
}

let mockEnqueue: ReturnType<typeof vi.fn>
let mockRunAgent: ReturnType<typeof vi.fn>
let mockLlm: ReturnType<typeof vi.fn>

// ─── Setup ──────────────────────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2024-07-10T09:00:00Z'))

  mockEnqueue = vi.fn().mockResolvedValue('job-1')
  mockRunAgent = vi.fn().mockResolvedValue(undefined)
  mockLlm = vi.fn().mockResolvedValue('{}')

  // Default: autopilot enabled, config loaded, phases cooled down, budget available
  mocks.isAutopilotEnabled.mockResolvedValue(true)
  mocks.loadConfig.mockResolvedValue(makeConfig())
  mocks.isPhaseCooledDown.mockResolvedValue(true)
  mocks.canSpendLlm.mockResolvedValue(true)
  mocks.markPhaseRun.mockResolvedValue(undefined)
  mocks.recordLlmCall.mockResolvedValue(undefined)
  mocks.generateMorningBriefing.mockResolvedValue(null)
  mocks.dbAgentInsightsGet.mockResolvedValue(null)
  mocks.dbAgentInsightsPut.mockResolvedValue(undefined)

  // Default: enough wrong answers for EVAL phase
  mockQuestionResultsChain(5)
})

// ─── Tests ──────────────────────────────────────────────────
describe('runAutopilotSweep', () => {
  // ── Guard: autopilot disabled ─────────────────────────────
  it('skips all phases when autopilot is disabled', async () => {
    mocks.isAutopilotEnabled.mockResolvedValue(false)

    const result = await runAutopilotSweep(PROFILE_ID, mockEnqueue, mockRunAgent, mockLlm)

    expect(result.phasesRun).toEqual([])
    expect(result.phasesSkipped).toEqual([])
    expect(result.errors).toEqual([])
    expect(result.briefingGenerated).toBe(false)
    expect(mockRunAgent).not.toHaveBeenCalled()
  })

  it('skips all phases when config is null', async () => {
    mocks.loadConfig.mockResolvedValue(null)

    const result = await runAutopilotSweep(PROFILE_ID, mockEnqueue, mockRunAgent, mockLlm)

    expect(result.phasesRun).toEqual([])
    expect(mockRunAgent).not.toHaveBeenCalled()
  })

  // ── Phase 1: SCOUT ─────────────────────────────────────────
  it('runs SCOUT phase (diagnostician + progress-monitor) when cooled down', async () => {
    const result = await runAutopilotSweep(PROFILE_ID, mockEnqueue, mockRunAgent, mockLlm)

    expect(result.phasesRun).toContain('scout')
    expect(mockRunAgent).toHaveBeenCalledWith('diagnostician', PROFILE_ID)
    expect(mockRunAgent).toHaveBeenCalledWith('progress-monitor', PROFILE_ID)
    expect(mocks.markPhaseRun).toHaveBeenCalledWith(PROFILE_ID, 'scout')
  })

  it('skips SCOUT when cooldown not elapsed', async () => {
    mocks.isPhaseCooledDown.mockImplementation(
      async (_id: string, phase: string) => phase !== 'scout',
    )

    const result = await runAutopilotSweep(PROFILE_ID, mockEnqueue, mockRunAgent, mockLlm)

    expect(result.phasesSkipped).toContain('scout (cooldown)')
    expect(result.phasesRun).not.toContain('scout')
    expect(mockRunAgent).not.toHaveBeenCalledWith('diagnostician', PROFILE_ID)
  })

  // ── Phase 2: EVAL ──────────────────────────────────────────
  it('runs EVAL only when 5+ wrong answers AND budget allows', async () => {
    mockQuestionResultsChain(5)

    const result = await runAutopilotSweep(PROFILE_ID, mockEnqueue, mockRunAgent, mockLlm)

    expect(result.phasesRun).toContain('eval')
    expect(mockRunAgent).toHaveBeenCalledWith('misconception-hunter', PROFILE_ID)
    expect(mocks.recordLlmCall).toHaveBeenCalledWith(PROFILE_ID, 'eval')
    expect(mocks.markPhaseRun).toHaveBeenCalledWith(PROFILE_ID, 'eval')
  })

  it('skips EVAL when fewer than 5 wrong answers', async () => {
    mockQuestionResultsChain(3)

    const result = await runAutopilotSweep(PROFILE_ID, mockEnqueue, mockRunAgent, mockLlm)

    expect(result.phasesSkipped).toContain('eval (insufficient data or budget)')
    expect(mockRunAgent).not.toHaveBeenCalledWith('misconception-hunter', PROFILE_ID)
  })

  it('skips EVAL when budget exhausted', async () => {
    mocks.canSpendLlm.mockImplementation(async (_id: string, _n: number) => {
      // budget exhausted for all LLM-consuming phases
      return false
    })

    const result = await runAutopilotSweep(PROFILE_ID, mockEnqueue, mockRunAgent, mockLlm)

    expect(result.phasesSkipped).toContain('eval (insufficient data or budget)')
    expect(mockRunAgent).not.toHaveBeenCalledWith('misconception-hunter', PROFILE_ID)
  })

  it('skips EVAL when cooldown not elapsed', async () => {
    mocks.isPhaseCooledDown.mockImplementation(
      async (_id: string, phase: string) => phase !== 'eval',
    )

    const result = await runAutopilotSweep(PROFILE_ID, mockEnqueue, mockRunAgent, mockLlm)

    expect(result.phasesSkipped).toContain('eval (cooldown)')
  })

  // ── Phase 3: PLAN ──────────────────────────────────────────
  it('runs PLAN when cooled down and budget allows', async () => {
    const result = await runAutopilotSweep(PROFILE_ID, mockEnqueue, mockRunAgent, mockLlm)

    expect(result.phasesRun).toContain('plan')
    expect(mockRunAgent).toHaveBeenCalledWith('strategist', PROFILE_ID)
    expect(mocks.recordLlmCall).toHaveBeenCalledWith(PROFILE_ID, 'plan')
    expect(mocks.markPhaseRun).toHaveBeenCalledWith(PROFILE_ID, 'plan')
  })

  it('skips PLAN when budget exhausted', async () => {
    mocks.canSpendLlm.mockResolvedValue(false)

    const result = await runAutopilotSweep(PROFILE_ID, mockEnqueue, mockRunAgent, mockLlm)

    expect(result.phasesSkipped).toContain('plan (budget)')
    expect(mockRunAgent).not.toHaveBeenCalledWith('strategist', PROFILE_ID)
  })

  it('skips PLAN when cooldown not elapsed', async () => {
    mocks.isPhaseCooledDown.mockImplementation(
      async (_id: string, phase: string) => phase !== 'plan',
    )

    const result = await runAutopilotSweep(PROFILE_ID, mockEnqueue, mockRunAgent, mockLlm)

    expect(result.phasesSkipped).toContain('plan (cooldown)')
  })

  // ── Phase 4: FORGE ─────────────────────────────────────────
  it('runs FORGE and sets forge-mode hint in agentInsights', async () => {
    const result = await runAutopilotSweep(PROFILE_ID, mockEnqueue, mockRunAgent, mockLlm)

    expect(result.phasesRun).toContain('forge')
    expect(mockRunAgent).toHaveBeenCalledWith('content-architect', PROFILE_ID)
    expect(mocks.markPhaseRun).toHaveBeenCalledWith(PROFILE_ID, 'forge')

    // Check that forge-mode hint was written to agentInsights
    const forgePutCall = mocks.dbAgentInsightsPut.mock.calls.find(
      (call: unknown[]) => (call[0] as Record<string, unknown>).id === `autopilot-forge-mode:${PROFILE_ID}`,
    )
    expect(forgePutCall).toBeDefined()
    const forgeData = JSON.parse((forgePutCall![0] as Record<string, string>).data)
    expect(forgeData.expandedTopicLimit).toBe(2) // free tier
    expect(forgeData).toHaveProperty('calledAt')
  })

  it('FORGE uses expanded topic limit of 5 for pro tier', async () => {
    mocks.loadConfig.mockResolvedValue(makeConfig({ tier: 'pro' }))

    await runAutopilotSweep(PROFILE_ID, mockEnqueue, mockRunAgent, mockLlm)

    const forgePutCall = mocks.dbAgentInsightsPut.mock.calls.find(
      (call: unknown[]) => (call[0] as Record<string, unknown>).id === `autopilot-forge-mode:${PROFILE_ID}`,
    )
    expect(forgePutCall).toBeDefined()
    const forgeData = JSON.parse((forgePutCall![0] as Record<string, string>).data)
    expect(forgeData.expandedTopicLimit).toBe(5)
  })

  it('FORGE records estimated LLM calls (2 for free, 6 for pro)', async () => {
    await runAutopilotSweep(PROFILE_ID, mockEnqueue, mockRunAgent, mockLlm)

    // free tier: 2 estimated calls
    const forgeCalls = mocks.recordLlmCall.mock.calls.filter(
      (call: unknown[]) => call[1] === 'forge',
    )
    expect(forgeCalls.length).toBe(2)
  })

  it('FORGE records 6 LLM calls for pro tier', async () => {
    mocks.loadConfig.mockResolvedValue(makeConfig({ tier: 'pro' }))

    await runAutopilotSweep(PROFILE_ID, mockEnqueue, mockRunAgent, mockLlm)

    const forgeCalls = mocks.recordLlmCall.mock.calls.filter(
      (call: unknown[]) => call[1] === 'forge',
    )
    expect(forgeCalls.length).toBe(6)
  })

  it('skips FORGE when budget is insufficient for 2 LLM calls', async () => {
    mocks.canSpendLlm.mockImplementation(async (_id: string, n: number) => n < 2)

    const result = await runAutopilotSweep(PROFILE_ID, mockEnqueue, mockRunAgent, mockLlm)

    expect(result.phasesSkipped).toContain('forge (budget)')
  })

  // ── Phase 5: PULSE ─────────────────────────────────────────
  it('runs PULSE (engagement-monitor)', async () => {
    const result = await runAutopilotSweep(PROFILE_ID, mockEnqueue, mockRunAgent, mockLlm)

    expect(result.phasesRun).toContain('pulse')
    expect(mockRunAgent).toHaveBeenCalledWith('engagement-monitor', PROFILE_ID)
    expect(mocks.markPhaseRun).toHaveBeenCalledWith(PROFILE_ID, 'pulse')
  })

  it('skips PULSE when cooldown not elapsed', async () => {
    mocks.isPhaseCooledDown.mockImplementation(
      async (_id: string, phase: string) => phase !== 'pulse',
    )

    const result = await runAutopilotSweep(PROFILE_ID, mockEnqueue, mockRunAgent, mockLlm)

    expect(result.phasesSkipped).toContain('pulse (cooldown)')
  })

  // ── Morning Briefing ───────────────────────────────────────
  it('generates morning briefing on first sweep of day', async () => {
    mocks.generateMorningBriefing.mockResolvedValue({ date: '2024-07-10' })

    const result = await runAutopilotSweep(PROFILE_ID, mockEnqueue, mockRunAgent, mockLlm)

    expect(result.briefingGenerated).toBe(true)
    expect(mocks.generateMorningBriefing).toHaveBeenCalledWith(PROFILE_ID, mockLlm)
    expect(mocks.recordLlmCall).toHaveBeenCalledWith(PROFILE_ID, 'briefing')
    expect(mocks.markPhaseRun).toHaveBeenCalledWith(PROFILE_ID, 'briefing')
  })

  it('skips briefing when cooldown not elapsed (already generated today)', async () => {
    mocks.isPhaseCooledDown.mockImplementation(
      async (_id: string, phase: string) => phase !== 'briefing',
    )

    const result = await runAutopilotSweep(PROFILE_ID, mockEnqueue, mockRunAgent, mockLlm)

    expect(result.briefingGenerated).toBe(false)
    expect(mocks.generateMorningBriefing).not.toHaveBeenCalled()
  })

  it('skips briefing when no llm function provided', async () => {
    const result = await runAutopilotSweep(PROFILE_ID, mockEnqueue, mockRunAgent)

    expect(result.briefingGenerated).toBe(false)
    expect(mocks.generateMorningBriefing).not.toHaveBeenCalled()
  })

  it('skips briefing when budget exhausted', async () => {
    mocks.canSpendLlm.mockResolvedValue(false)

    const result = await runAutopilotSweep(PROFILE_ID, mockEnqueue, mockRunAgent, mockLlm)

    expect(result.briefingGenerated).toBe(false)
  })

  // ── Activity Logging ───────────────────────────────────────
  it('logs sweep to activity log', async () => {
    await runAutopilotSweep(PROFILE_ID, mockEnqueue, mockRunAgent, mockLlm)

    const logPutCall = mocks.dbAgentInsightsPut.mock.calls.find(
      (call: unknown[]) => (call[0] as Record<string, unknown>).id === `swarm-activity-log:${PROFILE_ID}`,
    )
    expect(logPutCall).toBeDefined()
    const entries = JSON.parse((logPutCall![0] as Record<string, string>).data)
    expect(entries).toBeInstanceOf(Array)
    expect(entries.length).toBeGreaterThan(0)
    expect(entries[0].action).toBe('autopilot-sweep')
    expect(entries[0].summary).toContain('Ran:')
  })

  it('appends to existing activity log', async () => {
    mocks.dbAgentInsightsGet.mockImplementation(async (key: string) => {
      if (key === `swarm-activity-log:${PROFILE_ID}`) {
        return {
          data: JSON.stringify([{ action: 'old-action', summary: 'old', timestamp: '2024-07-09T10:00:00Z' }]),
          createdAt: '2024-07-09T10:00:00Z',
        }
      }
      return null
    })

    await runAutopilotSweep(PROFILE_ID, mockEnqueue, mockRunAgent, mockLlm)

    const logPutCall = mocks.dbAgentInsightsPut.mock.calls.find(
      (call: unknown[]) => (call[0] as Record<string, unknown>).id === `swarm-activity-log:${PROFILE_ID}`,
    )
    const entries = JSON.parse((logPutCall![0] as Record<string, string>).data)
    expect(entries.length).toBe(2)
    expect(entries[0].action).toBe('old-action')
    expect(entries[1].action).toBe('autopilot-sweep')
  })

  it('trims activity log to 20 entries', async () => {
    const oldEntries = Array.from({ length: 20 }, (_, i) => ({
      action: `action-${i}`,
      summary: `summary-${i}`,
      timestamp: '2024-07-09T10:00:00Z',
    }))
    mocks.dbAgentInsightsGet.mockImplementation(async (key: string) => {
      if (key === `swarm-activity-log:${PROFILE_ID}`) {
        return { data: JSON.stringify(oldEntries), createdAt: '2024-07-01T00:00:00Z' }
      }
      return null
    })

    await runAutopilotSweep(PROFILE_ID, mockEnqueue, mockRunAgent, mockLlm)

    const logPutCall = mocks.dbAgentInsightsPut.mock.calls.find(
      (call: unknown[]) => (call[0] as Record<string, unknown>).id === `swarm-activity-log:${PROFILE_ID}`,
    )
    const entries = JSON.parse((logPutCall![0] as Record<string, string>).data)
    expect(entries.length).toBe(20) // trimmed to last 20
    expect(entries[entries.length - 1].action).toBe('autopilot-sweep')
  })

  // ── Partial Failure Resilience ─────────────────────────────
  it('partial failure in one phase does not kill others', async () => {
    mockRunAgent.mockImplementation(async (agentId: string) => {
      if (agentId === 'diagnostician') throw new Error('diagnostician failed')
    })

    const result = await runAutopilotSweep(PROFILE_ID, mockEnqueue, mockRunAgent, mockLlm)

    // Scout should have errored
    expect(result.errors).toContain('scout: diagnostician failed')
    expect(result.phasesRun).not.toContain('scout')

    // Other phases should still run
    expect(result.phasesRun).toContain('eval')
    expect(result.phasesRun).toContain('plan')
    expect(result.phasesRun).toContain('forge')
    expect(result.phasesRun).toContain('pulse')
  })

  it('EVAL failure does not affect subsequent phases', async () => {
    mockRunAgent.mockImplementation(async (agentId: string) => {
      if (agentId === 'misconception-hunter') throw new Error('eval crashed')
    })

    const result = await runAutopilotSweep(PROFILE_ID, mockEnqueue, mockRunAgent, mockLlm)

    expect(result.errors).toContain('eval: eval crashed')
    expect(result.phasesRun).toContain('scout')
    expect(result.phasesRun).toContain('plan')
    expect(result.phasesRun).toContain('forge')
    expect(result.phasesRun).toContain('pulse')
  })

  it('briefing failure is captured in errors', async () => {
    mocks.generateMorningBriefing.mockRejectedValue(new Error('LLM down'))

    const result = await runAutopilotSweep(PROFILE_ID, mockEnqueue, mockRunAgent, mockLlm)

    expect(result.errors).toContain('briefing: LLM down')
    expect(result.briefingGenerated).toBe(false)
  })

  // ── Records LLM calls ─────────────────────────────────────
  it('records LLM calls for each LLM-consuming phase', async () => {
    await runAutopilotSweep(PROFILE_ID, mockEnqueue, mockRunAgent, mockLlm)

    // eval: 1 call, plan: 1 call, forge: 2 calls (free tier), briefing: 1 call
    expect(mocks.recordLlmCall).toHaveBeenCalledWith(PROFILE_ID, 'eval')
    expect(mocks.recordLlmCall).toHaveBeenCalledWith(PROFILE_ID, 'plan')
    expect(mocks.recordLlmCall).toHaveBeenCalledWith(PROFILE_ID, 'forge')
    expect(mocks.recordLlmCall).toHaveBeenCalledWith(PROFILE_ID, 'briefing')
  })

  // ── Disabled phases in config ──────────────────────────────
  it('respects disabled phases in config', async () => {
    mocks.loadConfig.mockResolvedValue(
      makeConfig({ enabledPhases: { scout: false, forge: false, eval: true, plan: true, pulse: false } }),
    )

    const result = await runAutopilotSweep(PROFILE_ID, mockEnqueue, mockRunAgent, mockLlm)

    expect(result.phasesRun).not.toContain('scout')
    expect(result.phasesRun).not.toContain('forge')
    expect(result.phasesRun).not.toContain('pulse')
    expect(result.phasesRun).toContain('eval')
    expect(result.phasesRun).toContain('plan')
  })

  it('runs all 5 phases when everything is enabled and cooled down', async () => {
    const result = await runAutopilotSweep(PROFILE_ID, mockEnqueue, mockRunAgent, mockLlm)

    expect(result.phasesRun).toEqual(
      expect.arrayContaining(['scout', 'eval', 'plan', 'forge', 'pulse']),
    )
    expect(result.phasesSkipped).toEqual([])
    expect(result.errors).toEqual([])
  })
})
