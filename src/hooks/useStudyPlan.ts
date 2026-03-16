import { useState, useCallback, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { StudyPlanDay } from '../db/schema'
import { generateStudyPlan } from '../ai/studyPlanGenerator'

interface StudyActivity {
  topicName: string
  activityType: string
  durationMinutes: number
  completed: boolean
}

export function useStudyPlan(examProfileId: string | undefined) {
  const [isGenerating, setIsGenerating] = useState(false)

  const activePlan = useLiveQuery(
    () => examProfileId
      ? db.studyPlans
          .where('examProfileId').equals(examProfileId)
          .filter(p => p.isActive)
          .first()
      : undefined,
    [examProfileId]
  )

  const planDays = useLiveQuery(
    () => activePlan
      ? db.studyPlanDays.where('planId').equals(activePlan.id).sortBy('date')
      : Promise.resolve([] as StudyPlanDay[]),
    [activePlan?.id]
  ) ?? []

  const today = new Date().toISOString().slice(0, 10)
  const todaysPlan = planDays.find(d => d.date === today) ?? null

  const generatePlan = useCallback(async (authToken: string) => {
    if (!examProfileId) return
    setIsGenerating(true)
    try {
      await generateStudyPlan(examProfileId, authToken)
    } finally {
      setIsGenerating(false)
    }
  }, [examProfileId])

  const markActivityCompleted = useCallback(async (dayId: string, activityIndex: number) => {
    const day = await db.studyPlanDays.get(dayId)
    if (!day) return

    const activities: StudyActivity[] = JSON.parse(day.activities)
    if (activityIndex >= 0 && activityIndex < activities.length) {
      activities[activityIndex].completed = !activities[activityIndex].completed
    }

    const allCompleted = activities.every(a => a.completed)
    await db.studyPlanDays.update(dayId, {
      activities: JSON.stringify(activities),
      isCompleted: allCompleted,
    })
  }, [])

  const replanPlan = useCallback(async (authToken: string, _reason: string) => {
    if (!examProfileId || !activePlan) return
    setIsGenerating(true)
    try {
      const today = new Date().toISOString().slice(0, 10)
      const remainingDays = planDays.filter(d => d.date >= today).length
      await generateStudyPlan(examProfileId, authToken, remainingDays || 7)
    } finally {
      setIsGenerating(false)
    }
  }, [examProfileId, activePlan, planDays])

  // Check if replan is suggested
  const replanSuggestion = useMemo(() => {
    if (!activePlan || planDays.length === 0) return null

    // Need topics and daily logs for the check — fetch synchronously from what we have
    // We do a simple check: just look at skipped days
    const today = new Date().toISOString().slice(0, 10)
    const pastDays = planDays.filter(d => d.date < today)
    let consecutiveSkipped = 0
    const sorted = [...pastDays].sort((a, b) => b.date.localeCompare(a.date))
    for (const day of sorted) {
      const activities = JSON.parse(day.activities) as Array<{ completed: boolean }>
      if (!activities.some(a => a.completed)) {
        consecutiveSkipped++
      } else {
        break
      }
    }
    if (consecutiveSkipped >= 2) {
      return `${consecutiveSkipped} consecutive days skipped`
    }
    return null
  }, [activePlan, planDays])

  const deactivatePlan = useCallback(async () => {
    if (!activePlan) return
    await db.studyPlans.update(activePlan.id, { isActive: false })
  }, [activePlan])

  return {
    activePlan,
    planDays,
    todaysPlan,
    isGenerating,
    generatePlan,
    markActivityCompleted,
    deactivatePlan,
    replanPlan,
    replanSuggestion,
  }
}
