import { describe, it, expect } from 'vitest'

import {
  DEFAULT_AUTOPILOT_CONFIG,
  PHASE_COOLDOWNS,
  AUTOPILOT_BUDGET_PRO,
  AUTOPILOT_BUDGET_FREE,
  EMPTY_BUDGET,
} from '../types'

describe('DEFAULT_AUTOPILOT_CONFIG', () => {
  it('is disabled by default', () => {
    expect(DEFAULT_AUTOPILOT_CONFIG.enabled).toBe(false)
  })

  it('defaults to free tier', () => {
    expect(DEFAULT_AUTOPILOT_CONFIG.tier).toBe('free')
  })

  it('has 8 max daily LLM calls', () => {
    expect(DEFAULT_AUTOPILOT_CONFIG.maxDailyLlmCalls).toBe(8)
  })

  it('enables all 5 phases by default', () => {
    expect(DEFAULT_AUTOPILOT_CONFIG.enabledPhases).toEqual({
      scout: true,
      forge: true,
      eval: true,
      plan: true,
      pulse: true,
    })
  })
})

describe('PHASE_COOLDOWNS', () => {
  it('has all expected phases', () => {
    expect(PHASE_COOLDOWNS).toHaveProperty('scout')
    expect(PHASE_COOLDOWNS).toHaveProperty('forge')
    expect(PHASE_COOLDOWNS).toHaveProperty('eval')
    expect(PHASE_COOLDOWNS).toHaveProperty('plan')
    expect(PHASE_COOLDOWNS).toHaveProperty('pulse')
    expect(PHASE_COOLDOWNS).toHaveProperty('briefing')
  })

  it('scout cooldown is 1 hour', () => {
    expect(PHASE_COOLDOWNS.scout).toBe(60 * 60 * 1000)
  })

  it('forge cooldown is 2 hours', () => {
    expect(PHASE_COOLDOWNS.forge).toBe(2 * 60 * 60 * 1000)
  })

  it('eval cooldown is 1 hour', () => {
    expect(PHASE_COOLDOWNS.eval).toBe(60 * 60 * 1000)
  })

  it('plan cooldown is 6 hours', () => {
    expect(PHASE_COOLDOWNS.plan).toBe(6 * 60 * 60 * 1000)
  })

  it('pulse cooldown is 30 minutes', () => {
    expect(PHASE_COOLDOWNS.pulse).toBe(30 * 60 * 1000)
  })

  it('briefing cooldown is 24 hours', () => {
    expect(PHASE_COOLDOWNS.briefing).toBe(24 * 60 * 60 * 1000)
  })

  it('all cooldown values are positive numbers', () => {
    for (const [phase, ms] of Object.entries(PHASE_COOLDOWNS)) {
      expect(ms, `${phase} should be a positive number`).toBeGreaterThan(0)
    }
  })
})

describe('AUTOPILOT_BUDGET_PRO', () => {
  it('is 25', () => {
    expect(AUTOPILOT_BUDGET_PRO).toBe(25)
  })
})

describe('AUTOPILOT_BUDGET_FREE', () => {
  it('is 8', () => {
    expect(AUTOPILOT_BUDGET_FREE).toBe(8)
  })
})

describe('EMPTY_BUDGET', () => {
  it('has correct structure', () => {
    expect(EMPTY_BUDGET).toEqual({
      date: '',
      callsUsed: 0,
      callsByPhase: {},
      lastRunByPhase: {},
    })
  })

  it('starts with 0 calls used', () => {
    expect(EMPTY_BUDGET.callsUsed).toBe(0)
  })

  it('has empty date', () => {
    expect(EMPTY_BUDGET.date).toBe('')
  })

  it('has no phase data', () => {
    expect(Object.keys(EMPTY_BUDGET.callsByPhase)).toHaveLength(0)
    expect(Object.keys(EMPTY_BUDGET.lastRunByPhase)).toHaveLength(0)
  })
})

describe('budget tier comparison', () => {
  it('pro budget is larger than free budget', () => {
    expect(AUTOPILOT_BUDGET_PRO).toBeGreaterThan(AUTOPILOT_BUDGET_FREE)
  })

  it('free budget matches default config maxDailyLlmCalls', () => {
    expect(AUTOPILOT_BUDGET_FREE).toBe(DEFAULT_AUTOPILOT_CONFIG.maxDailyLlmCalls)
  })
})
