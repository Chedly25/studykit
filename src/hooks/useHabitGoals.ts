import { useCallback } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { HabitGoal, HabitLog, HabitFrequency } from '../db/schema'

export function useHabitGoals(examProfileId: string | undefined) {
  const goals = useLiveQuery(
    () => examProfileId
      ? db.habitGoals.where('examProfileId').equals(examProfileId).toArray()
      : Promise.resolve([] as HabitGoal[]),
    [examProfileId]
  ) ?? []

  const logs = useLiveQuery(
    () => examProfileId
      ? db.habitLogs.where('examProfileId').equals(examProfileId).toArray()
      : Promise.resolve([] as HabitLog[]),
    [examProfileId]
  ) ?? []

  const addGoal = useCallback(async (
    title: string,
    targetValue: number,
    unit: string,
    frequency: HabitFrequency,
  ) => {
    if (!examProfileId) return
    await db.habitGoals.put({
      id: crypto.randomUUID(),
      examProfileId,
      title,
      targetValue,
      unit,
      frequency,
      currentStreak: 0,
      createdAt: new Date().toISOString(),
    })
  }, [examProfileId])

  const deleteGoal = useCallback(async (id: string) => {
    await db.habitLogs.where('goalId').equals(id).delete()
    await db.habitGoals.delete(id)
  }, [])

  const logProgress = useCallback(async (goalId: string, value: number) => {
    if (!examProfileId) return
    const today = new Date().toISOString().slice(0, 10)
    const existing = logs.find(l => l.goalId === goalId && l.date === today)

    if (existing) {
      await db.habitLogs.update(existing.id, { value })
    } else {
      await db.habitLogs.put({
        id: crypto.randomUUID(),
        goalId,
        examProfileId,
        date: today,
        value,
      })
    }

    // Recalculate streak
    const goal = goals.find(g => g.id === goalId)
    if (!goal) return

    const allLogs = await db.habitLogs
      .where('goalId').equals(goalId)
      .toArray()

    const logDates = new Set(
      allLogs
        .filter(l => l.value >= goal.targetValue)
        .map(l => l.date)
    )

    let streak = 0
    const d = new Date()
    // Include today if logged
    while (true) {
      const dateStr = d.toISOString().slice(0, 10)
      if (logDates.has(dateStr)) {
        streak++
        d.setDate(d.getDate() - 1)
      } else {
        break
      }
    }

    await db.habitGoals.update(goalId, { currentStreak: streak })
  }, [examProfileId, logs, goals])

  const getTodayProgress = useCallback((goalId: string): number => {
    const today = new Date().toISOString().slice(0, 10)
    const log = logs.find(l => l.goalId === goalId && l.date === today)
    return log?.value ?? 0
  }, [logs])

  return {
    goals,
    logs,
    addGoal,
    deleteGoal,
    logProgress,
    getTodayProgress,
  }
}
