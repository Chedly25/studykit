/**
 * Macro Roadmap Generator — creates a multi-phase strategic study plan
 * spanning weeks/months until the exam date.
 */
import { db } from '../db'
import { callFastModel } from '../ai/fastClient'
import type { MacroRoadmap, MacroPhase } from '../db/schema'

export async function generateMacroRoadmap(
  examProfileId: string,
  authToken: string,
): Promise<MacroRoadmap> {
  const profile = await db.examProfiles.get(examProfileId)
  if (!profile) throw new Error('No profile found')

  const subjects = await db.subjects
    .where('examProfileId').equals(examProfileId)
    .toArray()

  const topics = await db.topics
    .where('examProfileId').equals(examProfileId)
    .toArray()

  // Calculate prep time
  const today = new Date()
  const todayStr = today.toISOString().slice(0, 10)
  let weeksUntilExam = 0
  let monthsUntilExam = 0
  const hasDeadline = !!profile.examDate

  if (hasDeadline) {
    const examDate = new Date(profile.examDate)
    const msUntil = examDate.getTime() - today.getTime()
    weeksUntilExam = Math.max(1, Math.round(msUntil / (7 * 24 * 60 * 60 * 1000)))
    monthsUntilExam = Math.max(1, Math.round(msUntil / (30 * 24 * 60 * 60 * 1000)))
  }

  // Current mastery per subject
  const subjectMastery = subjects.map(s => {
    const subTopics = topics.filter(t => t.subjectId === s.id)
    const avgMastery = subTopics.length > 0
      ? subTopics.reduce((sum, t) => sum + t.mastery, 0) / subTopics.length
      : 0
    return { name: s.name, weight: s.weight, mastery: Math.round(avgMastery * 100) }
  })

  const deadlineCtx = hasDeadline
    ? `Exam date: ${profile.examDate} (${weeksUntilExam} weeks / ${monthsUntilExam} months away)`
    : 'No fixed deadline — design open-ended phases'

  const raw = await callFastModel(
    `Create a multi-phase strategic study roadmap.

Exam: ${profile.name}
${deadlineCtx}
Weekly study hours: ${profile.weeklyTargetHours}
Subjects and current mastery:
${subjectMastery.map(s => `- ${s.name}: ${s.mastery}% mastery (weight: ${s.weight}%)`).join('\n')}

Generate 3-5 phases. ${hasDeadline ? 'Distribute phases proportionally across the remaining time.' : 'Use relative ordering without specific dates.'}

Return ONLY valid JSON:
{
  "phases": [
    {
      "name": "Phase Name",
      "description": "Brief description of this phase's goal",
      "startDate": "${todayStr}",
      "endDate": "YYYY-MM-DD",
      "targetMastery": 0.5,
      "focusAreas": ["Subject1", "Subject2"],
      "milestones": ["Milestone description"]
    }
  ]
}

Phase templates by timeframe:
- 12+ months: Foundation → Deep Practice → Mock Exams → Revision
- 6-12 months: Intensive Foundation → Practice + Review → Final Sprint
- 3-6 months: Accelerated Coverage → Mock Exams → Revision
- < 3 months: Targeted Gaps → High-Yield Practice → Cram
- No deadline: Foundation → Deepening → Mastery`,
    'You are a study planning strategist. Create realistic, achievable multi-phase roadmaps. Return only valid JSON.',
    authToken,
    { maxTokens: 4096 },
  )

  // Parse phases
  let phases: MacroPhase[] = []
  try {
    const clean = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '')
    const jsonMatch = clean.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as { phases: MacroPhase[] }
      phases = (parsed.phases ?? []).map((p, i) => ({
        name: p.name || `Phase ${i + 1}`,
        description: p.description || '',
        startDate: p.startDate || '',
        endDate: p.endDate || '',
        targetMastery: typeof p.targetMastery === 'number' ? p.targetMastery : 0.5,
        focusAreas: Array.isArray(p.focusAreas) ? p.focusAreas : [],
        milestones: Array.isArray(p.milestones) ? p.milestones : [],
        status: 'upcoming' as const,
      }))
    }
  } catch { /* parse failed */ }

  // Determine active phase based on today's date
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/
  if (hasDeadline && phases.length > 0) {
    for (const phase of phases) {
      const validStart = dateRegex.test(phase.startDate)
      const validEnd = dateRegex.test(phase.endDate)
      if (validStart && validEnd && phase.startDate <= todayStr && phase.endDate >= todayStr) {
        phase.status = 'active'
      } else if (validEnd && phase.endDate < todayStr) {
        phase.status = 'completed'
      }
    }
    // If no phase is active (gap), activate the nearest upcoming
    if (!phases.some(p => p.status === 'active')) {
      const upcoming = phases.find(p => p.status === 'upcoming')
      if (upcoming) upcoming.status = 'active'
    }
  } else if (phases.length > 0) {
    phases[0].status = 'active'
  }

  const now = new Date().toISOString()
  const roadmap: MacroRoadmap = {
    id: examProfileId,
    examProfileId,
    phases: JSON.stringify(phases),
    generatedAt: now,
    updatedAt: now,
  }

  await db.macroRoadmaps.put(roadmap)
  return roadmap
}
