/**
 * Autopilot LLM Budget Tracker — prevents autopilot from consuming
 * too many daily LLM calls, leaving room for chat and manual operations.
 *
 * Stores budget state in the agentInsights table (no schema migration needed).
 * Resets daily by comparing the stored date against today.
 */
import { db } from '../../../db'
import type { AutopilotBudget, AutopilotConfig } from './types'
import {
  EMPTY_BUDGET,
  AUTOPILOT_BUDGET_PRO,
  AUTOPILOT_BUDGET_FREE,
  PHASE_COOLDOWNS,
} from './types'

const BUDGET_KEY_PREFIX = 'autopilot-budget:'
const CONFIG_KEY_PREFIX = 'autopilot-config:'

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

// ─── Budget Read/Write ──────────────────────────────────────

async function loadBudget(examProfileId: string): Promise<AutopilotBudget> {
  const row = await db.agentInsights.get(`${BUDGET_KEY_PREFIX}${examProfileId}`)
  if (!row?.data) return { ...EMPTY_BUDGET, date: today() }
  try {
    const budget = JSON.parse(row.data) as AutopilotBudget
    // Reset if it's a new day
    if (budget.date !== today()) {
      return { ...EMPTY_BUDGET, date: today(), lastRunByPhase: budget.lastRunByPhase }
    }
    return budget
  } catch {
    return { ...EMPTY_BUDGET, date: today() }
  }
}

async function saveBudget(examProfileId: string, budget: AutopilotBudget): Promise<void> {
  const key = `${BUDGET_KEY_PREFIX}${examProfileId}`
  const now = new Date().toISOString()
  const existing = await db.agentInsights.get(key)
  await db.agentInsights.put({
    id: key,
    agentId: 'autopilot',
    examProfileId,
    data: JSON.stringify(budget),
    summary: `${budget.callsUsed} LLM calls used today (${budget.date})`,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  })
}

// ─── Config Read/Write ──────────────────────────────────────

export async function loadConfig(examProfileId: string): Promise<AutopilotConfig | null> {
  const row = await db.agentInsights.get(`${CONFIG_KEY_PREFIX}${examProfileId}`)
  if (!row?.data) return null
  try {
    return JSON.parse(row.data) as AutopilotConfig
  } catch {
    return null
  }
}

export async function saveConfig(examProfileId: string, config: AutopilotConfig): Promise<void> {
  const key = `${CONFIG_KEY_PREFIX}${examProfileId}`
  const now = new Date().toISOString()
  const existing = await db.agentInsights.get(key)
  await db.agentInsights.put({
    id: key,
    agentId: 'autopilot',
    examProfileId,
    data: JSON.stringify(config),
    summary: config.enabled ? 'Autopilot enabled' : 'Autopilot disabled',
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  })
}

// ─── Budget Operations ──────────────────────────────────────

/**
 * Record an LLM call made by the autopilot.
 */
export async function recordLlmCall(examProfileId: string, phase: string): Promise<void> {
  const budget = await loadBudget(examProfileId)
  budget.callsUsed++
  budget.callsByPhase[phase] = (budget.callsByPhase[phase] ?? 0) + 1
  await saveBudget(examProfileId, budget)
}

/**
 * Check how many LLM calls remain in today's autopilot budget.
 */
export async function getRemainingBudget(examProfileId: string): Promise<{ calls: number; isLow: boolean }> {
  const config = await loadConfig(examProfileId)
  const limit = config?.tier === 'pro' ? AUTOPILOT_BUDGET_PRO : AUTOPILOT_BUDGET_FREE
  const budget = await loadBudget(examProfileId)
  const remaining = Math.max(0, limit - budget.callsUsed)
  return { calls: remaining, isLow: remaining <= 3 }
}

/**
 * Check whether the autopilot can spend N more LLM calls today.
 */
export async function canSpendLlm(examProfileId: string, estimatedCalls: number): Promise<boolean> {
  const { calls } = await getRemainingBudget(examProfileId)
  return calls >= estimatedCalls
}

// ─── Phase Cooldown Checks ──────────────────────────────────

/**
 * Check if a phase's cooldown has elapsed since its last run.
 */
export async function isPhaseCooledDown(examProfileId: string, phase: string): Promise<boolean> {
  const budget = await loadBudget(examProfileId)
  const lastRun = budget.lastRunByPhase[phase]
  if (!lastRun) return true

  const cooldown = PHASE_COOLDOWNS[phase]
  if (!cooldown) return true

  return Date.now() - new Date(lastRun).getTime() >= cooldown
}

/**
 * Mark a phase as having just run (updates its cooldown timestamp).
 */
export async function markPhaseRun(examProfileId: string, phase: string): Promise<void> {
  const budget = await loadBudget(examProfileId)
  budget.lastRunByPhase[phase] = new Date().toISOString()
  await saveBudget(examProfileId, budget)
}

/**
 * Check if autopilot is enabled for this profile.
 */
export async function isAutopilotEnabled(examProfileId: string): Promise<boolean> {
  const config = await loadConfig(examProfileId)
  return config?.enabled ?? false
}
