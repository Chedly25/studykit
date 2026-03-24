/**
 * Diagnostician agent — analyzes student performance data to identify
 * knowledge gaps, error patterns, calibration issues, and mastery decay.
 * Pure computation — no LLM calls needed.
 */
import { db } from '../../db'
import { decayedMastery, computeReadiness, computeStreak } from '../../lib/knowledgeGraph'
import { getMiscalibratedTopicsFromRaw } from '../../lib/calibration'
import type { AgentDefinition, AgentContext, AgentResult } from './types'

export interface DiagnosticPriority {
  topicId: string
  topicName: string
  urgency: 'critical' | 'high' | 'medium' | 'low'
  reason: string
  suggestedAction: 'review' | 'practice' | 'relearn' | 'assess'
}

export interface DiagnosticPattern {
  type: 'error-cluster' | 'mastery-decay' | 'calibration-gap' | 'study-gap' | 'improvement'
  description: string
  topicIds: string[]
}

export interface DiagnosticReport {
  timestamp: string
  priorities: DiagnosticPriority[]
  patterns: DiagnosticPattern[]
  readiness: { score: number; trend: 'improving' | 'stable' | 'declining'; riskAreas: string[] }
  narrative?: string
  narrativeGeneratedAt?: string
}

export const diagnosticianAgent: AgentDefinition = {
  id: 'diagnostician',
  name: 'Diagnostician',
  description: 'Analyzes student performance to identify knowledge gaps and patterns',
  triggers: ['app-open', 'manual'],
  model: 'fast',
  cooldownMs: 3600000, // 1 hour

  async execute(ctx: AgentContext): Promise<AgentResult> {
    const { examProfileId } = ctx

    // Load all data from IndexedDB
    const [profile, topics, subjects, logs, snapshots, _misconceptions] = await Promise.all([
      db.examProfiles.get(examProfileId),
      db.topics.where('examProfileId').equals(examProfileId).toArray(),
      db.subjects.where('examProfileId').equals(examProfileId).toArray(),
      db.dailyStudyLogs.where('examProfileId').equals(examProfileId).toArray(),
      db.masterySnapshots.where('examProfileId').equals(examProfileId).toArray(),
      db.misconceptions.where('examProfileId').equals(examProfileId).filter(m => !m.resolvedAt).toArray(),
    ])

    if (!profile || topics.length === 0) {
      return { success: true, summary: 'No data to analyze', episodes: [] }
    }

    // Skip detailed diagnosis for brand-new users with zero study activity
    const totalAttempts = topics.reduce((sum, t) => sum + t.questionsAttempted, 0)
    if (totalAttempts === 0 && logs.length === 0) {
      return { success: true, summary: 'New user — no study data yet', episodes: [] }
    }

    const priorities: DiagnosticPriority[] = []
    const patterns: DiagnosticPattern[] = []
    const episodes: AgentResult['episodes'] = []

    // Build subject weight map
    const subjectWeights = new Map(subjects.map(s => [s.id, s.weight]))

    // 1. Identify weak topics with urgency
    for (const topic of topics) {
      const decayed = decayedMastery(topic)
      const subjectWeight = subjectWeights.get(topic.subjectId) ?? 0
      const decay = topic.mastery - decayed

      let urgency: DiagnosticPriority['urgency'] = 'low'
      let reason = ''
      let action: DiagnosticPriority['suggestedAction'] = 'review'

      if (topic.mastery < 0.3 && subjectWeight > 20) {
        urgency = 'critical'
        reason = `Mastery at ${Math.round(topic.mastery * 100)}% on a ${subjectWeight}%-weight topic`
        action = 'relearn'
      } else if (decay > 0.15) {
        urgency = 'high'
        reason = `Mastery decayed ${Math.round(decay * 100)}% (${Math.round(topic.mastery * 100)}% → ${Math.round(decayed * 100)}%)`
        action = 'review'
      } else if (topic.mastery < 0.5) {
        urgency = 'medium'
        reason = `Mastery below 50% at ${Math.round(topic.mastery * 100)}%`
        action = 'practice'
      }

      if (urgency !== 'low') {
        priorities.push({ topicId: topic.id, topicName: topic.name, urgency, reason, suggestedAction: action })
      }

      // Detect mastery decay pattern
      if (decay > 0.1) {
        patterns.push({
          type: 'mastery-decay',
          description: `${topic.name} decayed ${Math.round(decay * 100)}% — needs review`,
          topicIds: [topic.id],
        })
      }
    }

    // 2. Calibration gaps
    const miscalibrated = getMiscalibratedTopicsFromRaw(topics, subjects, 0.2)
    for (const cal of miscalibrated.slice(0, 3)) {
      patterns.push({
        type: 'calibration-gap',
        description: cal.isOverconfident
          ? `Overconfident on ${cal.topicName}: ${Math.round(cal.confidence * 100)}% confidence vs ${Math.round(cal.mastery * 100)}% actual`
          : `Underconfident on ${cal.topicName}: ${Math.round(cal.confidence * 100)}% confidence vs ${Math.round(cal.mastery * 100)}% actual`,
        topicIds: [topics.find(t => t.name === cal.topicName)?.id ?? ''],
      })
    }

    // 3. Study rhythm
    const { streak } = computeStreak(logs)
    if (streak === 0 && logs.length > 0) {
      patterns.push({ type: 'study-gap', description: 'Study streak broken — no recent study activity', topicIds: [] })
    }

    // 4. Mastery trend (compare with 7 days ago)
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)
    let improvingCount = 0
    let decliningCount = 0
    for (const topic of topics) {
      const oldSnapshot = snapshots.find(s => s.topicId === topic.id && s.date <= weekAgo)
      if (oldSnapshot) {
        if (topic.mastery > oldSnapshot.mastery + 0.05) improvingCount++
        if (topic.mastery < oldSnapshot.mastery - 0.05) decliningCount++
      }
    }
    const trend = improvingCount > decliningCount ? 'improving' : decliningCount > improvingCount ? 'declining' : 'stable'

    // 5. Readiness score
    const readinessScore = computeReadiness({ subjects, passingThreshold: profile.passingThreshold })

    // 6. Improvement detections
    const weakBeforeStrong = topics.filter(t => {
      const old = snapshots.find(s => s.topicId === t.id && s.date <= weekAgo)
      return old && old.mastery < 0.5 && t.mastery >= 0.7
    })
    for (const t of weakBeforeStrong) {
      patterns.push({ type: 'improvement', description: `${t.name} improved significantly this week`, topicIds: [t.id] })
      episodes.push({
        userId: ctx.userId, examProfileId, topicId: t.id, topicName: t.name,
        type: 'mastery-change', description: `${t.name} mastery improved significantly`,
        context: '{}', effectiveness: 0.5, tags: '["improvement"]',
      })
    }

    // Sort priorities by urgency
    const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 }
    priorities.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency])

    const report: DiagnosticReport = {
      timestamp: new Date().toISOString(),
      priorities: priorities.slice(0, 10),
      patterns,
      readiness: {
        score: readinessScore,
        trend,
        riskAreas: priorities.filter(p => p.urgency === 'critical').map(p => p.topicName),
      },
    }

    // Generate advisor narrative (once per day max)
    let shouldGenerateNarrative = true
    try {
      const existingInsight = await db.agentInsights.get(`diagnostician:${examProfileId}`)
      if (existingInsight) {
        const existing = JSON.parse(existingInsight.data) as DiagnosticReport
        if (existing.narrativeGeneratedAt) {
          const hoursSince = (Date.now() - new Date(existing.narrativeGeneratedAt).getTime()) / (1000 * 60 * 60)
          if (hoursSince < 24 && existing.narrative) {
            // Carry forward the existing narrative
            report.narrative = existing.narrative
            report.narrativeGeneratedAt = existing.narrativeGeneratedAt
            shouldGenerateNarrative = false
          }
        }
      }
    } catch { /* non-critical */ }

    if (shouldGenerateNarrative && priorities.length > 0 && !ctx.signal.aborted) {
      try {
        const topPriorities = priorities.slice(0, 5).map(p => `${p.topicName} (${p.urgency}: ${p.reason})`).join('; ')
        const patternSummary = patterns.map(p => p.description).join('; ')
        const narrativePrompt = `Readiness: ${readinessScore}%. Trend: ${trend}. Risk areas: ${report.readiness.riskAreas.join(', ') || 'none'}.\nPriorities: ${topPriorities}.\nPatterns: ${patternSummary || 'none detected'}.\n\nWrite a 2-3 sentence advisor note for the student. Be specific about topic names. Be honest about trajectory. End with one actionable focus for the coming days.`

        report.narrative = await ctx.llm(
          narrativePrompt,
          'You are a study advisor writing a brief assessment for your student. Be warm but honest. No emojis. No greetings.',
        )
        report.narrativeGeneratedAt = new Date().toISOString()
      } catch { /* non-fatal — narrative is optional */ }
    }

    // Write insight
    const now = new Date().toISOString()
    await db.agentInsights.put({
      id: `diagnostician:${examProfileId}`,
      agentId: 'diagnostician',
      examProfileId,
      data: JSON.stringify(report),
      summary: `${priorities.filter(p => p.urgency === 'critical').length} critical, ${priorities.filter(p => p.urgency === 'high').length} high priority. Readiness: ${readinessScore}%. Trend: ${trend}.`,
      createdAt: now,
      updatedAt: now,
    })

    // Update episode effectiveness based on mastery outcomes
    try {
      const { updateEpisodeEffectivenessFromOutcomes } = await import('../memory/effectivenessUpdater')
      await updateEpisodeEffectivenessFromOutcomes(ctx.userId, examProfileId)
    } catch { /* non-fatal */ }

    return {
      success: true,
      data: report,
      summary: `Diagnosed ${priorities.length} priority areas. Readiness: ${readinessScore}%. Trend: ${trend}.`,
      episodes,
    }
  },
}
