/**
 * Autopilot Orchestrator — the central coordinator that runs proactive sweeps.
 *
 * Each sweep executes 5 phases in order: SCOUT → EVAL → PLAN → FORGE → PULSE.
 * Phases respect individual cooldowns and budget limits.
 * Generates a morning briefing on the first sweep of each day.
 *
 * All phases are wrapped in try/catch — partial failures don't kill other phases.
 */
import { db } from '../../../db'
import {
  isAutopilotEnabled,
  loadConfig,
  isPhaseCooledDown,
  markPhaseRun,
  canSpendLlm,
  recordLlmCall,
} from './budgetTracker'
import { generateMorningBriefing } from './morningBriefing'

type EnqueueFn = (type: string, examProfileId: string, config: Record<string, unknown>, totalSteps: number) => Promise<string>
type RunAgentFn = (agentId: string, examProfileId: string) => Promise<void>

interface SweepResult {
  phasesRun: string[]
  phasesSkipped: string[]
  errors: string[]
  briefingGenerated: boolean
}

/**
 * Run a full autopilot sweep. Called from the swarm orchestrator
 * when an 'autopilot-sweep' event is dispatched.
 */
export async function runAutopilotSweep(
  examProfileId: string,
  enqueue: EnqueueFn,
  runAgent: RunAgentFn,
  llm?: (prompt: string, system?: string) => Promise<string>,
): Promise<SweepResult> {
  const result: SweepResult = {
    phasesRun: [],
    phasesSkipped: [],
    errors: [],
    briefingGenerated: false,
  }

  // Guard: autopilot must be enabled
  if (!await isAutopilotEnabled(examProfileId)) {
    return result
  }

  const config = await loadConfig(examProfileId)
  if (!config) return result

  // ─── Phase 1: SCOUT ──────────────────────────────────────
  if (config.enabledPhases.scout) {
    try {
      if (await isPhaseCooledDown(examProfileId, 'scout')) {
        // Diagnostician + Progress Monitor are pure computation (0-1 LLM calls)
        await runAgent('diagnostician', examProfileId)
        await runAgent('progress-monitor', examProfileId)
        await markPhaseRun(examProfileId, 'scout')
        result.phasesRun.push('scout')
      } else {
        result.phasesSkipped.push('scout (cooldown)')
      }
    } catch (err) {
      result.errors.push(`scout: ${err instanceof Error ? err.message : 'unknown error'}`)
    }
  }

  // ─── Phase 2: EVAL ───────────────────────────────────────
  if (config.enabledPhases.eval) {
    try {
      if (await isPhaseCooledDown(examProfileId, 'eval')) {
        // Check if there are enough new wrong answers to justify a run
        const recentWrong = await db.questionResults
          .where('examProfileId').equals(examProfileId)
          .filter(r => !r.isCorrect)
          .limit(5)
          .count()

        if (recentWrong >= 5 && await canSpendLlm(examProfileId, 1)) {
          await runAgent('misconception-hunter', examProfileId)
          await recordLlmCall(examProfileId, 'eval')
          await markPhaseRun(examProfileId, 'eval')
          result.phasesRun.push('eval')
        } else {
          result.phasesSkipped.push('eval (insufficient data or budget)')
        }
      } else {
        result.phasesSkipped.push('eval (cooldown)')
      }
    } catch (err) {
      result.errors.push(`eval: ${err instanceof Error ? err.message : 'unknown error'}`)
    }
  }

  // ─── Phase 3: PLAN ───────────────────────────────────────
  if (config.enabledPhases.plan) {
    try {
      if (await isPhaseCooledDown(examProfileId, 'plan')) {
        if (await canSpendLlm(examProfileId, 1)) {
          await runAgent('strategist', examProfileId)
          await recordLlmCall(examProfileId, 'plan')
          await markPhaseRun(examProfileId, 'plan')
          result.phasesRun.push('plan')
        } else {
          result.phasesSkipped.push('plan (budget)')
        }
      } else {
        result.phasesSkipped.push('plan (cooldown)')
      }
    } catch (err) {
      result.errors.push(`plan: ${err instanceof Error ? err.message : 'unknown error'}`)
    }
  }

  // ─── Phase 4: FORGE ──────────────────────────────────────
  if (config.enabledPhases.forge) {
    try {
      if (await isPhaseCooledDown(examProfileId, 'forge')) {
        // Content architect uses 2 LLM calls per topic (generate + reflect)
        // Estimate: at least 2 calls for 1 topic
        if (await canSpendLlm(examProfileId, 2)) {
          // Store a hint that content architect should use expanded limits
          const now = new Date().toISOString()
          await db.agentInsights.put({
            id: `autopilot-forge-mode:${examProfileId}`,
            agentId: 'autopilot',
            examProfileId,
            data: JSON.stringify({ expandedTopicLimit: config.tier === 'pro' ? 5 : 2, calledAt: now }),
            summary: 'FORGE mode active',
            createdAt: now,
            updatedAt: now,
          })

          await runAgent('content-architect', examProfileId)
          // Content architect makes multiple LLM calls — record estimated usage
          const estimatedCalls = config.tier === 'pro' ? 6 : 2
          for (let i = 0; i < estimatedCalls; i++) {
            await recordLlmCall(examProfileId, 'forge')
          }
          await markPhaseRun(examProfileId, 'forge')
          result.phasesRun.push('forge')
        } else {
          result.phasesSkipped.push('forge (budget)')
        }
      } else {
        result.phasesSkipped.push('forge (cooldown)')
      }
    } catch (err) {
      result.errors.push(`forge: ${err instanceof Error ? err.message : 'unknown error'}`)
    }
  }

  // ─── Phase 5: PULSE ──────────────────────────────────────
  if (config.enabledPhases.pulse) {
    try {
      if (await isPhaseCooledDown(examProfileId, 'pulse')) {
        await runAgent('engagement-monitor', examProfileId)
        await markPhaseRun(examProfileId, 'pulse')
        result.phasesRun.push('pulse')
      } else {
        result.phasesSkipped.push('pulse (cooldown)')
      }
    } catch (err) {
      result.errors.push(`pulse: ${err instanceof Error ? err.message : 'unknown error'}`)
    }
  }

  // ─── Morning Briefing ────────────────────────────────────
  try {
    if (await isPhaseCooledDown(examProfileId, 'briefing') && llm) {
      if (await canSpendLlm(examProfileId, 1)) {
        await generateMorningBriefing(examProfileId, llm)
        await recordLlmCall(examProfileId, 'briefing')
        await markPhaseRun(examProfileId, 'briefing')
        result.briefingGenerated = true
      }
    }
  } catch (err) {
    result.errors.push(`briefing: ${err instanceof Error ? err.message : 'unknown error'}`)
  }

  // ─── Log sweep to activity log ───────────────────────────
  try {
    const now = new Date().toISOString()
    const key = `swarm-activity-log:${examProfileId}`
    const existing = await db.agentInsights.get(key)
    let entries: Array<{ action: string; summary: string; timestamp: string }> = []
    if (existing?.data) {
      try { entries = JSON.parse(existing.data) } catch { entries = [] }
    }
    entries.push({
      action: 'autopilot-sweep',
      summary: `Ran: ${result.phasesRun.join(', ') || 'none'}. Skipped: ${result.phasesSkipped.join(', ') || 'none'}.${result.errors.length > 0 ? ` Errors: ${result.errors.length}` : ''}`,
      timestamp: now,
    })
    if (entries.length > 20) entries = entries.slice(-20)
    await db.agentInsights.put({
      id: key,
      agentId: 'swarm-orchestrator',
      examProfileId,
      data: JSON.stringify(entries),
      summary: `${entries.length} recent swarm actions`,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    })
  } catch { /* non-critical */ }

  return result
}
