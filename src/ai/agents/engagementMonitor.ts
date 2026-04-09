/**
 * Engagement Monitor agent (PULSE) — tracks study rhythm, detects burnout,
 * overconfidence, and optimal study windows.
 * Pure computation — no LLM calls.
 */
import { db } from '../../db'
import type { AgentDefinition, AgentContext, AgentResult } from './types'
import type { EngagementInsight, EngagementReport } from './autopilot/types'

export const engagementMonitorAgent: AgentDefinition = {
  id: 'engagement-monitor',
  name: 'Engagement Monitor',
  description: 'Tracks study rhythm, detects burnout and overconfidence patterns',
  triggers: ['schedule'],
  model: 'fast',
  cooldownMs: 1800000, // 30 min

  async execute(ctx: AgentContext): Promise<AgentResult> {
    const { examProfileId } = ctx
    const insights: EngagementInsight[] = []

    const now = new Date()
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 86400000).toISOString().slice(0, 10)
    const threeDaysAgo = new Date(now.getTime() - 3 * 86400000).toISOString().slice(0, 10)

    const [sessions, logs, topics, questionResults] = await Promise.all([
      db.studySessions.where('examProfileId').equals(examProfileId).toArray(),
      db.dailyStudyLogs.where('examProfileId').equals(examProfileId).toArray(),
      db.topics.where('examProfileId').equals(examProfileId).toArray(),
      db.questionResults.where('examProfileId').equals(examProfileId).toArray(),
    ])

    // Filter to last 14 days
    const recentSessions = sessions.filter(s => s.startTime >= fourteenDaysAgo)
    const recentLogs = logs.filter(l => l.date >= fourteenDaysAgo)
    const recentResults = questionResults.filter(q => q.timestamp >= fourteenDaysAgo)

    // ─── Session Length Analysis ──────────────────────────────
    const sessionMinutes = recentSessions
      .map(s => s.durationSeconds / 60)
      .filter(m => m > 0)

    const avgSessionMinutes = sessionMinutes.length > 0
      ? sessionMinutes.reduce((a, b) => a + b, 0) / sessionMinutes.length
      : 0

    // Trend: compare first half vs second half of 14-day window
    const midpoint = new Date(now.getTime() - 7 * 86400000).toISOString()
    const firstHalf = recentSessions.filter(s => s.startTime < midpoint)
    const secondHalf = recentSessions.filter(s => s.startTime >= midpoint)
    const avgFirst = firstHalf.length > 0
      ? firstHalf.reduce((s, x) => s + x.durationSeconds, 0) / firstHalf.length / 60
      : 0
    const avgSecond = secondHalf.length > 0
      ? secondHalf.reduce((s, x) => s + x.durationSeconds, 0) / secondHalf.length / 60
      : 0

    let sessionTrend: 'increasing' | 'stable' | 'decreasing' = 'stable'
    if (avgFirst > 0 && avgSecond > 0) {
      const change = (avgSecond - avgFirst) / avgFirst
      if (change > 0.2) sessionTrend = 'increasing'
      else if (change < -0.2) sessionTrend = 'decreasing'
    }

    // ─── Error Rate Trend ────────────────────────────────────
    const firstHalfResults = recentResults.filter(r => r.timestamp < midpoint)
    const secondHalfResults = recentResults.filter(r => r.timestamp >= midpoint)
    const errorRateFirst = firstHalfResults.length > 0
      ? firstHalfResults.filter(r => !r.isCorrect).length / firstHalfResults.length
      : 0
    const errorRateSecond = secondHalfResults.length > 0
      ? secondHalfResults.filter(r => !r.isCorrect).length / secondHalfResults.length
      : 0

    // ─── Burnout Detection ───────────────────────────────────
    // Declining session length + increasing errors + decreasing frequency
    const burnoutSignals = [
      sessionTrend === 'decreasing' ? 0.4 : 0,
      errorRateSecond > errorRateFirst + 0.1 ? 0.3 : 0,
      secondHalf.length < firstHalf.length * 0.6 ? 0.3 : 0,
    ]
    const burnoutRisk = Math.min(1, burnoutSignals.reduce((a, b) => a + b, 0))

    if (burnoutRisk >= 0.6) {
      insights.push({
        type: 'burnout-risk',
        urgency: 'urgent',
        title: 'Burnout risk detected',
        message: 'Your study sessions are getting shorter, errors are increasing, and you\'re studying less frequently. Consider a lighter day with just flashcard review.',
        action: { label: 'Light review', route: '/queue' },
      })
    } else if (burnoutRisk >= 0.3) {
      insights.push({
        type: 'break-needed',
        urgency: 'attention',
        title: 'Take it easy today',
        message: 'Signs of fatigue detected — shorter sessions and more errors than usual. A break or lighter session might help.',
      })
    }

    // ─── Overconfidence Detection ─────────────────────────────
    const overconfidentTopics = topics.filter(t =>
      t.questionsAttempted >= 5 && t.confidence - t.mastery > 0.25
    )
    if (overconfidentTopics.length >= 2) {
      const names = overconfidentTopics.slice(0, 3).map(t => t.name).join(', ')
      insights.push({
        type: 'overconfidence',
        urgency: 'attention',
        title: 'Overconfidence detected',
        message: `You rate yourself higher than your actual results in: ${names}. Try a practice exam to calibrate.`,
        action: { label: 'Practice exam', route: '/practice-exam' },
      })
    }

    // ─── Study Gap ───────────────────────────────────────────
    const sortedLogs = [...recentLogs].sort((a, b) => b.date.localeCompare(a.date))
    if (sortedLogs.length > 0) {
      const lastStudy = sortedLogs[0].date
      const daysSince = Math.floor((now.getTime() - new Date(lastStudy + 'T00:00:00Z').getTime()) / 86400000)
      if (daysSince >= 3) {
        insights.push({
          type: 'study-gap',
          urgency: daysSince >= 5 ? 'urgent' : 'attention',
          title: `${daysSince} days without studying`,
          message: 'Your mastery is decaying. Even 10 minutes today will help.',
          action: { label: 'Quick session', route: '/queue' },
        })
      }
    }

    // ─── Momentum Detection ──────────────────────────────────
    const recentDays = recentLogs.filter(l => l.date >= threeDaysAgo)
    if (recentDays.length >= 3 && sessionTrend !== 'decreasing' && burnoutRisk < 0.3) {
      insights.push({
        type: 'momentum',
        urgency: 'info',
        title: 'Great momentum!',
        message: `${recentDays.length} study days in a row. Keep it up!`,
      })
    }

    // ─── Optimal Study Window ────────────────────────────────
    const hourBuckets = new Map<number, { total: number; count: number }>()
    for (const session of recentSessions) {
      const hour = new Date(session.startTime).getHours()
      const bucket = hourBuckets.get(hour) ?? { total: 0, count: 0 }
      bucket.total += session.durationSeconds
      bucket.count++
      hourBuckets.set(hour, bucket)
    }

    const optimalHours: string[] = []
    const sortedBuckets = [...hourBuckets.entries()]
      .filter(([, v]) => v.count >= 2)
      .sort((a, b) => (b[1].total / b[1].count) - (a[1].total / a[1].count))

    for (const [hour] of sortedBuckets.slice(0, 2)) {
      optimalHours.push(`${String(hour).padStart(2, '0')}:00-${String(hour + 1).padStart(2, '0')}:00`)
    }

    if (optimalHours.length > 0) {
      insights.push({
        type: 'optimal-window',
        urgency: 'info',
        title: 'Your best study hours',
        message: `You tend to study longest and most effectively during: ${optimalHours.join(', ')}`,
      })
    }

    // ─── Build Report ────────────────────────────────────────
    const report: EngagementReport = {
      insights,
      burnoutRisk,
      momentum: Math.max(0, 1 - burnoutRisk),
      optimalHours,
      avgSessionMinutes: Math.round(avgSessionMinutes),
      sessionTrend,
      analyzedAt: now.toISOString(),
    }

    // Write to DB
    const isoNow = now.toISOString()
    await db.agentInsights.put({
      id: `engagement-monitor:${examProfileId}`,
      agentId: 'engagement-monitor',
      examProfileId,
      data: JSON.stringify(report),
      summary: `Burnout risk: ${Math.round(burnoutRisk * 100)}%, ${insights.length} insights`,
      createdAt: isoNow,
      updatedAt: isoNow,
    })

    return {
      success: true,
      data: report,
      summary: `${insights.length} engagement insights (burnout risk: ${Math.round(burnoutRisk * 100)}%)`,
      episodes: [],
    }
  },
}
