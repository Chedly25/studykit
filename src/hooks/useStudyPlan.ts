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

  // Count missed days (past + not completed)
  const missedDayCount = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    return planDays.filter(d => d.date < today && !d.isCompleted).length
  }, [planDays])

  // Reschedule uncompleted activities from one day to another
  const rescheduleDay = useCallback(async (fromDate: string, toDate: string) => {
    if (!activePlan) return
    const fromDayId = `${activePlan.id}:${fromDate}`
    const toDayId = `${activePlan.id}:${toDate}`

    const fromDay = await db.studyPlanDays.get(fromDayId)
    if (!fromDay) return

    const fromActivities: StudyActivity[] = JSON.parse(fromDay.activities)
    const uncompleted = fromActivities.filter(a => !a.completed)
    if (uncompleted.length === 0) return

    const toDay = await db.studyPlanDays.get(toDayId)
    if (toDay) {
      const toActivities: StudyActivity[] = JSON.parse(toDay.activities)
      toActivities.push(...uncompleted.map(a => ({ ...a, completed: false })))
      await db.studyPlanDays.update(toDayId, { activities: JSON.stringify(toActivities) })
    } else {
      await db.studyPlanDays.put({
        id: toDayId,
        planId: activePlan.id,
        examProfileId: activePlan.examProfileId,
        date: toDate,
        activities: JSON.stringify(uncompleted.map(a => ({ ...a, completed: false }))),
        isCompleted: false,
      })
    }

    const completed = fromActivities.filter(a => a.completed)
    await db.studyPlanDays.update(fromDayId, {
      activities: JSON.stringify(completed),
      isCompleted: true,
    })
  }, [activePlan])

  // Catch up: reschedule all missed activities to today and tomorrow
  const catchUp = useCallback(async () => {
    if (!activePlan) return
    const today = new Date().toISOString().slice(0, 10)
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
    const missedDays = planDays.filter(d => d.date < today && !d.isCompleted)
    if (missedDays.length === 0) return

    const allMissed: StudyActivity[] = []
    for (const day of missedDays) {
      const activities: StudyActivity[] = JSON.parse(day.activities)
      allMissed.push(...activities.filter(a => !a.completed))
    }

    const half = Math.ceil(allMissed.length / 2)
    const todayBatch = allMissed.slice(0, half)
    const tomorrowBatch = allMissed.slice(half)

    // Helper to append activities to a day
    const appendToDay = async (date: string, batch: StudyActivity[]) => {
      if (batch.length === 0) return
      const dayId = `${activePlan.id}:${date}`
      const existing = await db.studyPlanDays.get(dayId)
      if (existing) {
        const acts: StudyActivity[] = JSON.parse(existing.activities)
        acts.push(...batch.map(a => ({ ...a, completed: false })))
        await db.studyPlanDays.update(dayId, { activities: JSON.stringify(acts), isCompleted: false })
      } else {
        await db.studyPlanDays.put({
          id: dayId,
          planId: activePlan.id,
          examProfileId: activePlan.examProfileId,
          date,
          activities: JSON.stringify(batch.map(a => ({ ...a, completed: false }))),
          isCompleted: false,
        })
      }
    }

    await appendToDay(today, todayBatch)
    await appendToDay(tomorrow, tomorrowBatch)

    // Mark all missed days as handled
    for (const day of missedDays) {
      const completed: StudyActivity[] = JSON.parse(day.activities)
      await db.studyPlanDays.update(day.id, {
        activities: JSON.stringify(completed.filter(a => a.completed)),
        isCompleted: true,
      })
    }
  }, [activePlan, planDays])

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
    missedDayCount,
    rescheduleDay,
    catchUp,
  }
}
