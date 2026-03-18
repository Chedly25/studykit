/**
 * Pure functions for manipulating PlanDraftData.
 * Used by the canvas agent loop to execute tool calls.
 */
import type { PlanDraftData, PlanDraftActivity } from '../../hooks/useWizardDraft'

function findDayIndex(plan: PlanDraftData, dayLabel: string): number {
  const label = dayLabel.toLowerCase()
  return plan.days.findIndex(d => d.dayLabel.toLowerCase() === label)
}

export function addActivity(
  plan: PlanDraftData,
  input: { day: string; topicName: string; activityType: string; durationMinutes: number },
): { plan: PlanDraftData; result: string } {
  const dayIndex = findDayIndex(plan, input.day)
  if (dayIndex === -1) return { plan, result: JSON.stringify({ error: `Day "${input.day}" not found` }) }

  const activity: PlanDraftActivity = {
    id: crypto.randomUUID(),
    topicName: input.topicName,
    activityType: input.activityType,
    durationMinutes: Math.min(120, Math.max(15, input.durationMinutes)),
  }

  const days = [...plan.days]
  days[dayIndex] = {
    ...days[dayIndex],
    activities: [...days[dayIndex].activities, activity],
  }

  return {
    plan: { ...plan, days },
    result: JSON.stringify({ success: true, added: `${input.topicName} (${input.activityType}, ${input.durationMinutes}min) to ${input.day}` }),
  }
}

export function removeActivity(
  plan: PlanDraftData,
  input: { day: string; activityIndex: number },
): { plan: PlanDraftData; result: string } {
  const dayIndex = findDayIndex(plan, input.day)
  if (dayIndex === -1) return { plan, result: JSON.stringify({ error: `Day "${input.day}" not found` }) }

  const activities = plan.days[dayIndex].activities
  if (input.activityIndex < 0 || input.activityIndex >= activities.length) {
    return { plan, result: JSON.stringify({ error: `Activity index ${input.activityIndex} out of range (${activities.length} activities)` }) }
  }

  const removed = activities[input.activityIndex]
  const days = [...plan.days]
  days[dayIndex] = {
    ...days[dayIndex],
    activities: activities.filter((_, i) => i !== input.activityIndex),
  }

  return {
    plan: { ...plan, days },
    result: JSON.stringify({ success: true, removed: `${removed.topicName} (${removed.activityType}) from ${input.day}` }),
  }
}

export function moveActivity(
  plan: PlanDraftData,
  input: { fromDay: string; fromIndex: number; toDay: string },
): { plan: PlanDraftData; result: string } {
  const fromDayIndex = findDayIndex(plan, input.fromDay)
  const toDayIndex = findDayIndex(plan, input.toDay)

  if (fromDayIndex === -1) return { plan, result: JSON.stringify({ error: `Day "${input.fromDay}" not found` }) }
  if (toDayIndex === -1) return { plan, result: JSON.stringify({ error: `Day "${input.toDay}" not found` }) }

  const fromActivities = plan.days[fromDayIndex].activities
  if (input.fromIndex < 0 || input.fromIndex >= fromActivities.length) {
    return { plan, result: JSON.stringify({ error: `Activity index ${input.fromIndex} out of range` }) }
  }

  const activity = fromActivities[input.fromIndex]
  const days = [...plan.days]
  days[fromDayIndex] = {
    ...days[fromDayIndex],
    activities: fromActivities.filter((_, i) => i !== input.fromIndex),
  }
  days[toDayIndex] = {
    ...days[toDayIndex],
    activities: [...days[toDayIndex].activities, activity],
  }

  return {
    plan: { ...plan, days },
    result: JSON.stringify({ success: true, moved: `${activity.topicName} from ${input.fromDay} to ${input.toDay}` }),
  }
}

export function replaceActivity(
  plan: PlanDraftData,
  input: { day: string; activityIndex: number; topicName: string; activityType: string; durationMinutes: number },
): { plan: PlanDraftData; result: string } {
  const dayIndex = findDayIndex(plan, input.day)
  if (dayIndex === -1) return { plan, result: JSON.stringify({ error: `Day "${input.day}" not found` }) }

  const activities = plan.days[dayIndex].activities
  if (input.activityIndex < 0 || input.activityIndex >= activities.length) {
    return { plan, result: JSON.stringify({ error: `Activity index ${input.activityIndex} out of range` }) }
  }

  const old = activities[input.activityIndex]
  const days = [...plan.days]
  const newActivities = [...activities]
  newActivities[input.activityIndex] = {
    ...activities[input.activityIndex],
    topicName: input.topicName,
    activityType: input.activityType,
    durationMinutes: Math.min(120, Math.max(15, input.durationMinutes)),
  }
  days[dayIndex] = { ...days[dayIndex], activities: newActivities }

  return {
    plan: { ...plan, days },
    result: JSON.stringify({ success: true, replaced: `${old.topicName} → ${input.topicName} (${input.activityType}) on ${input.day}` }),
  }
}

export function clearDay(
  plan: PlanDraftData,
  input: { day: string },
): { plan: PlanDraftData; result: string } {
  const dayIndex = findDayIndex(plan, input.day)
  if (dayIndex === -1) return { plan, result: JSON.stringify({ error: `Day "${input.day}" not found` }) }

  const count = plan.days[dayIndex].activities.length
  const days = [...plan.days]
  days[dayIndex] = { ...days[dayIndex], activities: [] }

  return {
    plan: { ...plan, days },
    result: JSON.stringify({ success: true, cleared: `${input.day} (${count} activities removed)` }),
  }
}

export function serializePlanForPrompt(plan: PlanDraftData): string {
  return plan.days.map(day => {
    const activities = day.activities.length === 0
      ? '  (empty)'
      : day.activities.map((a, i) =>
          `  ${i}. ${a.topicName} — ${a.activityType} (${a.durationMinutes}min)`
        ).join('\n')
    const totalMin = day.activities.reduce((sum, a) => sum + a.durationMinutes, 0)
    return `${day.dayLabel} (${day.date})${totalMin > 0 ? ` [${totalMin}min total]` : ''}:\n${activities}`
  }).join('\n\n')
}
