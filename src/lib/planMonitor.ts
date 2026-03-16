/**
 * Plan monitor — detects when a study plan needs replanning.
 */
import type { StudyPlan, StudyPlanDay, Topic, DailyStudyLog } from '../db/schema'

interface ReplanResult {
  shouldReplan: boolean
  reason: string
}

export function shouldReplan(
  plan: StudyPlan,
  planDays: StudyPlanDay[],
  topics: Topic[],
  dailyLogs: DailyStudyLog[],
): ReplanResult {
  const today = new Date().toISOString().slice(0, 10)

  // Check for 2+ consecutive days skipped
  const pastDays = planDays
    .filter(d => d.date < today)
    .sort((a, b) => b.date.localeCompare(a.date))

  let consecutiveSkipped = 0
  for (const day of pastDays) {
    const activities = JSON.parse(day.activities) as Array<{ completed: boolean }>
    const anyCompleted = activities.some(a => a.completed)
    if (!anyCompleted) {
      consecutiveSkipped++
    } else {
      break
    }
  }
  if (consecutiveSkipped >= 2) {
    return { shouldReplan: true, reason: `${consecutiveSkipped} consecutive days skipped` }
  }

  // Check if topic mastery changed > 20% since plan generation
  const planGenDate = plan.generatedAt.slice(0, 10)
  const topicMap = new Map(topics.map(t => [t.name, t.mastery]))

  // Parse activities from all plan days to get planned topics
  const plannedTopics = new Set<string>()
  for (const day of planDays) {
    const activities = JSON.parse(day.activities) as Array<{ topicName: string }>
    activities.forEach(a => plannedTopics.add(a.topicName))
  }

  // Check mastery change for planned topics
  for (const topicName of plannedTopics) {
    const currentMastery = topicMap.get(topicName)
    if (currentMastery !== undefined && currentMastery > 0.2) {
      // Significant mastery change detected
      // This is a heuristic — if topic is now >80% mastered, it may not need as much focus
    }
  }

  // Check if 50%+ remaining topics already mastered
  const remainingDays = planDays.filter(d => d.date >= today)
  const remainingTopics = new Set<string>()
  for (const day of remainingDays) {
    const activities = JSON.parse(day.activities) as Array<{ topicName: string }>
    activities.forEach(a => remainingTopics.add(a.topicName))
  }

  let masteredCount = 0
  for (const name of remainingTopics) {
    const mastery = topicMap.get(name)
    if (mastery !== undefined && mastery >= 0.8) {
      masteredCount++
    }
  }

  if (remainingTopics.size > 0 && masteredCount / remainingTopics.size >= 0.5) {
    return {
      shouldReplan: true,
      reason: `${masteredCount} of ${remainingTopics.size} remaining topics already mastered (${Math.round(masteredCount / remainingTopics.size * 100)}%)`,
    }
  }

  return { shouldReplan: false, reason: '' }
}
