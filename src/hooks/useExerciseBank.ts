import { useCallback } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { Exercise, ExerciseAttempt } from '../db/schema'

interface ExerciseStats {
  total: number
  attempted: number
  completed: number
  avgScore: number
}

export function useExerciseBank(examProfileId: string | undefined) {
  const exercises = useLiveQuery(
    async () => {
      if (!examProfileId) return []
      const all = await db.exercises.where('examProfileId').equals(examProfileId).toArray()
      return all.filter(e => !e.hidden)
    },
    [examProfileId],
    [],
  )

  const examSources = useLiveQuery(
    () => examProfileId
      ? db.examSources.where('examProfileId').equals(examProfileId).toArray()
      : [],
    [examProfileId],
    [],
  )

  const getExercisesByTopic = useCallback((topicId: string): Exercise[] => {
    return exercises.filter(ex => {
      try {
        const ids: string[] = JSON.parse(ex.topicIds)
        return ids.includes(topicId)
      } catch { return false }
    })
  }, [exercises])

  const getExerciseStatsForTopic = useCallback((topicId: string): ExerciseStats => {
    const topicExercises = getExercisesByTopic(topicId)
    const attempted = topicExercises.filter(e => e.status !== 'not_attempted')
    const completed = topicExercises.filter(e => e.status === 'completed')
    const scores = attempted.filter(e => e.lastAttemptScore != null).map(e => e.lastAttemptScore!)
    return {
      total: topicExercises.length,
      attempted: attempted.length,
      completed: completed.length,
      avgScore: scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0,
    }
  }, [getExercisesByTopic])

  const getExerciseStatsByTopic = useCallback((): Map<string, ExerciseStats> => {
    // Single-pass aggregation to avoid O(N²)
    const accum = new Map<string, { total: number; attempted: number; completed: number; scores: number[] }>()
    for (const ex of exercises) {
      try {
        const ids: string[] = JSON.parse(ex.topicIds)
        for (const topicId of ids) {
          let entry = accum.get(topicId)
          if (!entry) { entry = { total: 0, attempted: 0, completed: 0, scores: [] }; accum.set(topicId, entry) }
          entry.total++
          if (ex.status !== 'not_attempted') entry.attempted++
          if (ex.status === 'completed') entry.completed++
          if (ex.lastAttemptScore != null) entry.scores.push(ex.lastAttemptScore)
        }
      } catch { /* skip */ }
    }
    const result = new Map<string, ExerciseStats>()
    for (const [topicId, entry] of accum) {
      result.set(topicId, {
        total: entry.total,
        attempted: entry.attempted,
        completed: entry.completed,
        avgScore: entry.scores.length > 0 ? entry.scores.reduce((a, b) => a + b, 0) / entry.scores.length : 0,
      })
    }
    return result
  }, [exercises])

  const recordAttempt = useCallback(async (exerciseId: string, score: number, feedback?: string) => {
    if (!examProfileId) return

    const attempt: ExerciseAttempt = {
      id: crypto.randomUUID(),
      exerciseId,
      examProfileId,
      score,
      feedback,
      createdAt: new Date().toISOString(),
    }
    await db.exerciseAttempts.put(attempt)

    // Update exercise status and score
    const exercise = await db.exercises.get(exerciseId)
    if (exercise) {
      await db.exercises.update(exerciseId, {
        status: score >= 0.7 ? 'completed' : 'attempted',
        lastAttemptScore: score,
        attemptCount: exercise.attemptCount + 1,
      })
    }
  }, [examProfileId])

  const getFilteredExercises = useCallback((filters: {
    examSourceId?: string
    topicId?: string
    difficulty?: number
    status?: string
  }): Exercise[] => {
    return exercises.filter(ex => {
      if (filters.examSourceId && ex.examSourceId !== filters.examSourceId) return false
      if (filters.difficulty && ex.difficulty !== filters.difficulty) return false
      if (filters.status && ex.status !== filters.status) return false
      if (filters.topicId) {
        try {
          const ids: string[] = JSON.parse(ex.topicIds)
          if (!ids.includes(filters.topicId)) return false
        } catch { return false }
      }
      return true
    })
  }, [exercises])

  return {
    exercises,
    examSources,
    getExercisesByTopic,
    getExerciseStatsForTopic,
    getExerciseStatsByTopic,
    getFilteredExercises,
    recordAttempt,
  }
}
