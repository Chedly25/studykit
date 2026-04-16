/**
 * Default per-coach timer durations, in seconds.
 * Separated from CoachTimer.tsx to satisfy react-refresh/only-export-components.
 */
export const TIMER_DEFAULTS = {
  syllogisme: 15 * 60,  // 15 min
  plan: 30 * 60,        // 30 min
  fiche: 45 * 60,       // 45 min (also used for commentaire)
} as const
