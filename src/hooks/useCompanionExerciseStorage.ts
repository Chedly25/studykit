/**
 * useCompanionExerciseStorage — reads the current exercise context
 * from sessionStorage and re-reads when the tab storage changes.
 */

import { useState, useEffect, useCallback } from 'react'
import { getCompanionExerciseContext, type ExerciseCompanionContext } from '../../lib/companionExerciseBridge'

export function useCompanionExerciseStorage(): ExerciseCompanionContext | null {
  const [ctx, setCtx] = useState<ExerciseCompanionContext | null>(() => getCompanionExerciseContext())

  const refresh = useCallback(() => {
    setCtx(getCompanionExerciseContext())
  }, [])

  useEffect(() => {
    // Listen for storage events from other tabs (not needed for same-tab,
    // but good for completeness)
    const handler = (e: StorageEvent) => {
      if (e.key === 'companion_exercise_context') {
        refresh()
      }
    }
    window.addEventListener('storage', handler)

    // Poll every 500ms for same-tab changes (exercise pages write to
    // sessionStorage but don't dispatch storage events in the same tab)
    const interval = setInterval(refresh, 500)

    return () => {
      window.removeEventListener('storage', handler)
      clearInterval(interval)
    }
  }, [refresh])

  return ctx
}
