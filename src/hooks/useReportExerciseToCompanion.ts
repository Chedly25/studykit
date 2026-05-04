/**
 * useReportExerciseToCompanion — reports the current exercise task
 * to the companion widget via sessionStorage.
 *
 * Usage: call at the top level of any exercise coach page.
 */

import { useEffect } from 'react'
import { setCompanionExerciseContext, clearCompanionExerciseContext } from '../lib/companionExerciseBridge'

export function useReportExerciseToCompanion(
  exerciseType: 'syllogisme' | 'plan' | 'fiche' | 'commentaire' | 'cas-pratique' | 'synthese' | 'grand-oral',
  page: string,
  task: unknown,
): void {
  useEffect(() => {
    if (task) {
      setCompanionExerciseContext({
        exerciseType,
        taskJson: JSON.stringify(task),
        page,
        timestamp: Date.now(),
      })
    } else {
      clearCompanionExerciseContext()
    }
    return () => {
      clearCompanionExerciseContext()
    }
  }, [exerciseType, page, task])
}
