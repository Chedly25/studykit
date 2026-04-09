import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockPut = vi.fn()
const mockGet = vi.fn()

vi.mock('../../../../db', () => ({
  db: {
    agentInsights: {
      get: (...args: unknown[]) => mockGet(...args),
      put: (...args: unknown[]) => mockPut(...args),
    },
  },
}))

import {
  recordLlmCall,
  getRemainingBudget,
  canSpendLlm,
  isPhaseCooledDown,
  markPhaseRun,
  isAutopilotEnabled,
  loadConfig,
  saveConfig,
} from '../budgetTracker'

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2024-06-15T10:00:00Z'))
})

describe('budget tracking', () => {
  it('records LLM calls and increments counter', async () => {
    mockGet.mockResolvedValue(null)
    await recordLlmCall('p1', 'forge')

    expect(mockPut).toHaveBeenCalled()
    const savedData = JSON.parse(mockPut.mock.calls[0][0].data)
    expect(savedData.callsUsed).toBe(1)
    expect(savedData.callsByPhase.forge).toBe(1)
    expect(savedData.date).toBe('2024-06-15')
  })

  it('resets budget on new day', async () => {
    mockGet.mockResolvedValue({
      data: JSON.stringify({ date: '2024-06-14', callsUsed: 20, callsByPhase: {}, lastRunByPhase: { scout: '2024-06-14T10:00:00Z' } }),
    })
    const budget = await getRemainingBudget('p1')
    // Free tier: 8 limit, 0 used (reset)
    expect(budget.calls).toBe(8)
  })

  it('getRemainingBudget returns correct values for pro tier', async () => {
    mockGet
      .mockResolvedValueOnce({ data: JSON.stringify({ enabled: true, tier: 'pro', maxDailyLlmCalls: 25, enabledPhases: {} }) }) // config
      .mockResolvedValueOnce({ data: JSON.stringify({ date: '2024-06-15', callsUsed: 10, callsByPhase: {}, lastRunByPhase: {} }) }) // budget
    const budget = await getRemainingBudget('p1')
    expect(budget.calls).toBe(15) // 25 - 10
    expect(budget.isLow).toBe(false)
  })

  it('isLow is true when 3 or fewer calls remain', async () => {
    mockGet
      .mockResolvedValueOnce({ data: JSON.stringify({ enabled: true, tier: 'free', maxDailyLlmCalls: 8, enabledPhases: {} }) })
      .mockResolvedValueOnce({ data: JSON.stringify({ date: '2024-06-15', callsUsed: 6, callsByPhase: {}, lastRunByPhase: {} }) })
    const budget = await getRemainingBudget('p1')
    expect(budget.calls).toBe(2)
    expect(budget.isLow).toBe(true)
  })

  it('canSpendLlm returns false when budget exhausted', async () => {
    mockGet
      .mockResolvedValueOnce({ data: JSON.stringify({ enabled: true, tier: 'free', maxDailyLlmCalls: 8, enabledPhases: {} }) })
      .mockResolvedValueOnce({ data: JSON.stringify({ date: '2024-06-15', callsUsed: 7, callsByPhase: {}, lastRunByPhase: {} }) })
    expect(await canSpendLlm('p1', 2)).toBe(false)
  })

  it('canSpendLlm returns true when budget allows', async () => {
    mockGet
      .mockResolvedValueOnce({ data: JSON.stringify({ enabled: true, tier: 'pro', maxDailyLlmCalls: 25, enabledPhases: {} }) })
      .mockResolvedValueOnce({ data: JSON.stringify({ date: '2024-06-15', callsUsed: 5, callsByPhase: {}, lastRunByPhase: {} }) })
    expect(await canSpendLlm('p1', 3)).toBe(true)
  })
})

describe('phase cooldowns', () => {
  it('returns true when phase has never run', async () => {
    mockGet.mockResolvedValue(null)
    expect(await isPhaseCooledDown('p1', 'scout')).toBe(true)
  })

  it('returns false when phase ran recently', async () => {
    mockGet.mockResolvedValue({
      data: JSON.stringify({
        date: '2024-06-15', callsUsed: 0, callsByPhase: {},
        lastRunByPhase: { scout: '2024-06-15T09:30:00Z' }, // 30 min ago, cooldown is 1h
      }),
    })
    expect(await isPhaseCooledDown('p1', 'scout')).toBe(false)
  })

  it('returns true when cooldown elapsed', async () => {
    mockGet.mockResolvedValue({
      data: JSON.stringify({
        date: '2024-06-15', callsUsed: 0, callsByPhase: {},
        lastRunByPhase: { scout: '2024-06-15T08:00:00Z' }, // 2h ago, cooldown is 1h
      }),
    })
    expect(await isPhaseCooledDown('p1', 'scout')).toBe(true)
  })

  it('markPhaseRun updates timestamp', async () => {
    mockGet.mockResolvedValue({ data: JSON.stringify({ date: '2024-06-15', callsUsed: 0, callsByPhase: {}, lastRunByPhase: {} }) })
    await markPhaseRun('p1', 'forge')
    const savedData = JSON.parse(mockPut.mock.calls[0][0].data)
    expect(savedData.lastRunByPhase.forge).toBe('2024-06-15T10:00:00.000Z')
  })
})

describe('config', () => {
  it('isAutopilotEnabled returns false when no config', async () => {
    mockGet.mockResolvedValue(null)
    expect(await isAutopilotEnabled('p1')).toBe(false)
  })

  it('isAutopilotEnabled returns true when enabled', async () => {
    mockGet.mockResolvedValue({ data: JSON.stringify({ enabled: true }) })
    expect(await isAutopilotEnabled('p1')).toBe(true)
  })

  it('saveConfig persists to agentInsights', async () => {
    mockGet.mockResolvedValue(null)
    await saveConfig('p1', { enabled: true, tier: 'pro', maxDailyLlmCalls: 25, enabledPhases: { scout: true, forge: true, eval: true, plan: true, pulse: true } })
    expect(mockPut).toHaveBeenCalled()
    const saved = JSON.parse(mockPut.mock.calls[0][0].data)
    expect(saved.enabled).toBe(true)
    expect(saved.tier).toBe('pro')
  })

  it('loadConfig returns null for missing config', async () => {
    mockGet.mockResolvedValue(null)
    expect(await loadConfig('p1')).toBeNull()
  })
})
