import { useState, useCallback } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { StudyPlan, StudyPlanDay } from '../db/schema'
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
  }
}
