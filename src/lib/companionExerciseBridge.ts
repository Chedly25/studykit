/**
 * Companion Exercise Bridge — lightweight sessionStorage communication
 * between exercise coach pages and the companion widget in Layout.
 *
 * Why sessionStorage? Exercise pages are deep in the route tree (inside Outlet).
 * Using a React Context would require wrapping Outlet and importing the context
 * in every exercise page. sessionStorage is zero-import for exercise pages.
 */

const STORAGE_KEY = 'companion_exercise_context'

export interface ExerciseCompanionContext {
  exerciseType: 'syllogisme' | 'plan' | 'fiche' | 'commentaire' | 'cas-pratique' | 'synthese' | 'grand-oral'
  taskJson: string
  page: string
  timestamp: number
}

/**
 * Call this from any exercise coach page when the task changes.
 * Safe to call frequently — only writes when data actually changes.
 */
export function setCompanionExerciseContext(ctx: ExerciseCompanionContext): void {
  try {
    const existing = sessionStorage.getItem(STORAGE_KEY)
    const existingJson = existing ? JSON.parse(existing) as ExerciseCompanionContext : null
    // Only write if actually changed (prevents unnecessary re-renders)
    if (
      !existingJson ||
      existingJson.exerciseType !== ctx.exerciseType ||
      existingJson.taskJson !== ctx.taskJson ||
      existingJson.page !== ctx.page
    ) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(ctx))
    }
  } catch { /* ignore */ }
}

/**
 * Call this when leaving an exercise page (e.g. in cleanup or on unmount).
 */
export function clearCompanionExerciseContext(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch { /* ignore */ }
}

/**
 * Read current exercise context. Returns null if none active.
 */
export function getCompanionExerciseContext(): ExerciseCompanionContext | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as ExerciseCompanionContext
    // Ignore stale data (> 5 minutes old — page probably crashed/navigated away)
    if (Date.now() - parsed.timestamp > 5 * 60 * 1000) {
      sessionStorage.removeItem(STORAGE_KEY)
      return null
    }
    return parsed
  } catch {
    return null
  }
}
