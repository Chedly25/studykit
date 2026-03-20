/**
 * Cram Mode — activated when exam is ≤ 7 days away or manually toggled.
 * Overrides normal SRS intervals and prioritizes weakest topics.
 */

/**
 * Check if cram mode should be active.
 */
export function isCramModeActive(examDate: string, manualOverride?: boolean): boolean {
  if (manualOverride) return true
  if (!examDate) return false

  const daysUntilExam = Math.ceil(
    (new Date(examDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000)
  )

  return daysUntilExam <= 7 && daysUntilExam > 0
}

/**
 * Cap SM-2 interval during cram mode.
 */
export function cramCapInterval(interval: number): number {
  return Math.min(interval, 2)
}
