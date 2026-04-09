/**
 * Morning Briefing Generator — creates a daily summary of what
 * the autopilot did and what the student should focus on.
 *
 * Single LLM call. Idempotent (won't regenerate if today's briefing exists).
 */
import { db } from '../../../db'
import type { MorningBriefing } from './types'

const BRIEFING_KEY_PREFIX = 'autopilot-briefing:'

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Generate the morning briefing for today. No-ops if already generated.
 */
export async function generateMorningBriefing(
  examProfileId: string,
  llm: (prompt: string, system?: string) => Promise<string>,
): Promise<MorningBriefing | null> {
  const key = `${BRIEFING_KEY_PREFIX}${examProfileId}`

  // Idempotency: check if today's briefing already exists
  const existing = await db.agentInsights.get(key)
  if (existing?.data) {
    try {
      const parsed = JSON.parse(existing.data) as MorningBriefing
      if (parsed.date === today()) return parsed
    } catch { /* regenerate */ }
  }

  // Gather data from agent insights
  const [diagnosticianRow, _progressRow, engagementRow, activityRow, profile] = await Promise.all([
    db.agentInsights.get(`diagnostician:${examProfileId}`),
    db.agentInsights.get(`progress-monitor:${examProfileId}`),
    db.agentInsights.get(`engagement-monitor:${examProfileId}`),
    db.agentInsights.get(`swarm-activity-log:${examProfileId}`),
    db.examProfiles.get(examProfileId),
  ])

  // Build compact data summary for the LLM
  let diagnosticSummary = 'No diagnostic data available.'
  let readinessScore = 0
  if (diagnosticianRow?.data) {
    try {
      const diag = JSON.parse(diagnosticianRow.data)
      readinessScore = diag.readiness?.score ?? 0
      const priorities = (diag.priorities ?? []).slice(0, 5)
      diagnosticSummary = priorities.length > 0
        ? priorities.map((p: { topic: string; urgency: string; reason: string }) =>
          `- ${p.topic} (${p.urgency}): ${p.reason}`).join('\n')
        : 'No urgent priorities.'
    } catch { /* skip */ }
  }

  let engagementStatus = 'No engagement data.'
  if (engagementRow?.data) {
    try {
      const eng = JSON.parse(engagementRow.data)
      engagementStatus = `Burnout risk: ${Math.round(eng.burnoutRisk * 100)}%, avg session: ${eng.avgSessionMinutes}min, trend: ${eng.sessionTrend}`
    } catch { /* skip */ }
  }

  let recentActivity = 'No recent activity.'
  if (activityRow?.data) {
    try {
      const entries = JSON.parse(activityRow.data) as Array<{ action: string; summary: string }>
      recentActivity = entries.slice(-5).map(e => `- ${e.action}: ${e.summary}`).join('\n')
    } catch { /* skip */ }
  }

  const daysUntilExam = profile?.examDate
    ? Math.max(0, Math.floor((new Date(profile.examDate).getTime() - Date.now()) / 86400000))
    : null

  const prompt = `Tu es un coach d'études IA. Génère un briefing matinal concis en français pour un étudiant de prépa.

Données :
- Score de préparation : ${readinessScore}%
- Jours avant l'examen : ${daysUntilExam ?? 'non défini'}
- Priorités :
${diagnosticSummary}
- Engagement : ${engagementStatus}
- Activité récente du système :
${recentActivity}

Réponds en JSON strict avec cette structure :
{
  "focusRecommendation": "1-2 phrases sur quoi se concentrer aujourd'hui",
  "overnightSummary": "1 phrase résumant ce que le système a fait",
  "readinessTrend": "improving" | "stable" | "declining",
  "topActions": [{"action": "description courte", "priority": "critical|high|normal", "route": "/queue"}]
}

Maximum 3 actions. Sois encourageant mais honnête.`

  try {
    const raw = await llm(prompt)
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null

    const parsed = JSON.parse(jsonMatch[0]) as {
      focusRecommendation: string
      overnightSummary: string
      readinessTrend: 'improving' | 'stable' | 'declining'
      topActions: Array<{ action: string; priority: 'critical' | 'high' | 'normal'; route: string }>
    }

    const briefing: MorningBriefing = {
      date: today(),
      readinessScore,
      readinessTrend: parsed.readinessTrend,
      topActions: parsed.topActions ?? [],
      overnightSummary: parsed.overnightSummary ?? '',
      contentGenerated: { conceptCards: 0, flashcards: 0, exercises: 0 },
      focusRecommendation: parsed.focusRecommendation ?? '',
      engagementStatus,
      daysUntilExam,
      generatedAt: new Date().toISOString(),
      dismissed: false,
    }

    // Save to DB
    const now = new Date().toISOString()
    await db.agentInsights.put({
      id: key,
      agentId: 'autopilot',
      examProfileId,
      data: JSON.stringify(briefing),
      summary: `Morning briefing: ${briefing.focusRecommendation.slice(0, 80)}`,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    })

    return briefing
  } catch {
    return null
  }
}
