import type { ExamProfile } from '../db/schema'

/**
 * Returns the number of days until the exam, or null if no exam date is set.
 * Research profiles may have an empty examDate.
 */
export function getDaysLeft(profile: ExamProfile): number | null {
  if (!profile.examDate) return null
  return Math.max(0, Math.ceil((new Date(profile.examDate).getTime() - Date.now()) / 86400000))
}
