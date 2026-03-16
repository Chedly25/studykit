import { db } from '../../db'
import { generateStudyPlan } from '../studyPlanGenerator'

export async function generateStudyPlanTool(
  examProfileId: string,
  authToken: string,
  daysAhead?: number,
): Promise<string> {
  try {
    const { plan, days } = await generateStudyPlan(examProfileId, authToken, daysAhead ?? 7)
    return JSON.stringify({
      success: true,
      planId: plan.id,
      totalDays: plan.totalDays,
      days: days.map(d => ({
        date: d.date,
        activities: JSON.parse(d.activities),
      })),
    }, null, 2)
  } catch (err) {
    return JSON.stringify({
      error: err instanceof Error ? err.message : 'Failed to generate study plan',
    })
  }
}

export async function adjustStudyPlanTool(
  examProfileId: string,
  authToken: string,
  reason: string,
): Promise<string> {
  try {
    const plan = await db.studyPlans
      .where('examProfileId').equals(examProfileId)
      .filter(p => p.isActive)
      .first()

    if (!plan) return JSON.stringify({ error: 'No active study plan to adjust' })

    const today = new Date().toISOString().slice(0, 10)
    const days = await db.studyPlanDays.where('planId').equals(plan.id).sortBy('date')
    const remainingDays = days.filter(d => d.date >= today).length

    // Regenerate with remaining days
    const { plan: newPlan, days: newDays } = await generateStudyPlan(examProfileId, authToken, remainingDays || 7)

    return JSON.stringify({
      success: true,
      reason,
      previousPlanId: plan.id,
      newPlanId: newPlan.id,
      daysReplanned: newDays.length,
      newDays: newDays.map(d => ({
        date: d.date,
        activities: JSON.parse(d.activities),
      })),
    }, null, 2)
  } catch (err) {
    return JSON.stringify({
      error: err instanceof Error ? err.message : 'Failed to adjust study plan',
    })
  }
}

export async function getStudyPlanTool(examProfileId: string): Promise<string> {
  const plan = await db.studyPlans
    .where('examProfileId').equals(examProfileId)
    .filter(p => p.isActive)
    .first()

  if (!plan) {
    return JSON.stringify({ hasPlan: false, message: 'No active study plan. Use generateStudyPlan to create one.' })
  }

  const today = new Date().toISOString().slice(0, 10)
  const days = await db.studyPlanDays.where('planId').equals(plan.id).sortBy('date')
  const upcoming = days.filter(d => d.date >= today).slice(0, 5)

  return JSON.stringify({
    hasPlan: true,
    generatedAt: plan.generatedAt,
    totalDays: plan.totalDays,
    todaysPlan: days.find(d => d.date === today) ? {
      date: today,
      activities: JSON.parse(days.find(d => d.date === today)!.activities),
      isCompleted: days.find(d => d.date === today)!.isCompleted,
    } : null,
    upcoming: upcoming.map(d => ({
      date: d.date,
      activities: JSON.parse(d.activities),
      isCompleted: d.isCompleted,
    })),
  }, null, 2)
}
