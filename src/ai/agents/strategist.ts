/**
 * Strategist agent — monitors study plan health, detects divergence
 * between planned and actual activity, suggests adjustments.
 */
import { db } from '../../db'
import { dispatchSwarmEvent } from './eventBus'
import { isAutopilotEnabled } from './autopilot/budgetTracker'
import type { AgentDefinition, AgentContext, AgentResult } from './types'
import type { DiagnosticReport } from './diagnostician'

export const strategistAgent: AgentDefinition = {
  id: 'strategist',
  name: 'Strategist',
  description: 'Monitors study plan health and suggests adjustments',
  triggers: ['app-open', 'manual'],
  model: 'fast',
  cooldownMs: 86400000, // 24 hours

  async execute(ctx: AgentContext): Promise<AgentResult> {
    const { examProfileId } = ctx

    // Load active plan
    const plans = await db.studyPlans
      .where('examProfileId')
      .equals(examProfileId)
      .filter(p => p.isActive)
      .toArray()

    const activePlan = plans[0]
    if (!activePlan) {
      return { success: true, summary: 'No active study plan', episodes: [] }
    }

    // Load plan days for the last 7 days
    const today = new Date().toISOString().slice(0, 10)
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)

    const planDays = await db.studyPlanDays
      .where('planId')
      .equals(activePlan.id)
      .filter(d => d.date >= weekAgo && d.date <= today)
      .toArray()

    if (planDays.length === 0) {
      return { success: true, summary: 'No plan days in last week', episodes: [] }
    }

    // Compare planned vs actual
    let totalPlanned = 0
    let totalCompleted = 0
    const topicsInPlan = new Set<string>()

    for (const day of planDays) {
      try {
        const activities = JSON.parse(day.activities) as Array<{ topicName: string; completed: boolean }>
        for (const act of activities) {
          totalPlanned++
          topicsInPlan.add(act.topicName)
          if (act.completed) totalCompleted++
        }
      } catch { continue }
    }

    const divergence = totalPlanned > 0 ? (totalPlanned - totalCompleted) / totalPlanned : 0

    // Load diagnostician report for critical priorities
    const diagnosticInsight = await db.agentInsights.get(`diagnostician:${examProfileId}`)
    let criticalPriorities: string[] = []
    if (diagnosticInsight) {
      try {
        const report = JSON.parse(diagnosticInsight.data) as DiagnosticReport
        criticalPriorities = report.priorities
          .filter(p => p.urgency === 'critical' && !topicsInPlan.has(p.topicName))
          .map(p => p.topicName)
      } catch { /* ignore */ }
    }

    // Only suggest replan if significant divergence or uncovered critical topics
    if (divergence <= 0.3 && criticalPriorities.length === 0) {
      // Plan is on track
      const now = new Date().toISOString()
      await db.agentInsights.put({
        id: `strategist:${examProfileId}`,
        agentId: 'strategist',
        examProfileId,
        data: JSON.stringify({ suggestion: null, planOnTrack: true }),
        summary: `Plan on track: ${totalCompleted}/${totalPlanned} activities completed`,
        createdAt: now,
        updatedAt: now,
      })
      return { success: true, summary: 'Plan on track', episodes: [] }
    }

    // Load macro roadmap phase context
    let macroPhaseContext = ''
    try {
      const roadmap = await db.macroRoadmaps.get(examProfileId)
      if (roadmap) {
        const phases = JSON.parse(roadmap.phases) as Array<{ name: string; status: string; targetMastery: number; focusAreas: string[] }>
        const activePhase = phases.find(p => p.status === 'active')
        if (activePhase) {
          macroPhaseContext = `\n- Current macro phase: "${activePhase.name}" (target: ${Math.round(activePhase.targetMastery * 100)}% mastery, focus: ${activePhase.focusAreas.join(', ')})`
        }
      }
    } catch { /* ignore */ }

    // Generate suggestion via LLM
    try {
      const raw = await ctx.llm(
        `Study plan status for the last 7 days:
- Planned activities: ${totalPlanned}
- Completed: ${totalCompleted} (${Math.round((1 - divergence) * 100)}% completion)
- Topics in plan: ${[...topicsInPlan].join(', ')}
${criticalPriorities.length > 0 ? `- Critical topics NOT in plan: ${criticalPriorities.join(', ')}` : ''}${macroPhaseContext}

Suggest ONE specific, actionable adjustment to the study plan in 1-2 sentences. Be concrete.

Return JSON: { "suggestion": "..." }
Only JSON.`,
        'You are a study planning advisor. Return only valid JSON.',
      )

      const match = raw.match(/\{[\s\S]*\}/)
      const suggestion = match
        ? (JSON.parse(match[0]) as { suggestion?: string }).suggestion ?? 'Consider adjusting your study plan.'
        : 'Consider adjusting your study plan to stay on track.'

      const now = new Date().toISOString()
      await db.agentInsights.put({
        id: `strategist:${examProfileId}`,
        agentId: 'strategist',
        examProfileId,
        data: JSON.stringify({ suggestion, divergence, criticalPriorities }),
        summary: suggestion,
        createdAt: now,
        updatedAt: now,
      })

      // Auto-replan if divergence is very high and autopilot is enabled
      if (divergence > 0.4 && await isAutopilotEnabled(examProfileId)) {
        try {
          const profile = await db.examProfiles.get(examProfileId)
          await db.backgroundJobs.add({
            id: crypto.randomUUID(),
            type: 'study-plan',
            examProfileId,
            config: JSON.stringify({ examProfileId, examName: profile?.name ?? 'Exam' }),
            status: 'queued',
            totalSteps: 1,
            completedStepCount: 0,
            currentStepName: 'Generating study plan',
            completedStepIds: '[]',
            stepResults: '{}',
            createdAt: new Date().toISOString(),
          })
          dispatchSwarmEvent({ type: 'plan-stale', examProfileId, divergence: Math.round(divergence * 100) })
        } catch { /* non-critical — plan will regenerate on next manual trigger */ }
      }

      return {
        success: true,
        data: { suggestion, divergence },
        summary: `Plan divergence: ${Math.round(divergence * 100)}%. ${suggestion}`,
        episodes: [],
      }
    } catch {
      return { success: false, summary: 'Strategist analysis failed', episodes: [] }
    }
  },
}
