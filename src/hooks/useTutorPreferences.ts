import { useCallback } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { TutorPreferences } from '../db/schema'

const DEFAULTS: Omit<TutorPreferences, 'id' | 'examProfileId'> = {
  teachingStyle: 'detailed',
  explanationApproach: 'step-by-step',
  feedbackTone: 'encouraging',
  languageLevel: 'beginner-friendly',
}

export function useTutorPreferences(examProfileId: string | undefined) {
  const preferences = useLiveQuery(
    () => examProfileId
      ? db.tutorPreferences.where('examProfileId').equals(examProfileId).first()
      : undefined,
    [examProfileId]
  )

  const effectivePreferences: TutorPreferences | undefined = examProfileId
    ? preferences ?? { id: examProfileId, examProfileId, ...DEFAULTS }
    : undefined

  const updatePreferences = useCallback(async (
    updates: Partial<Omit<TutorPreferences, 'id' | 'examProfileId'>>
  ) => {
    if (!examProfileId) return
    const existing = await db.tutorPreferences.get(examProfileId)
    if (existing) {
      await db.tutorPreferences.update(examProfileId, updates)
    } else {
      await db.tutorPreferences.put({
        id: examProfileId,
        examProfileId,
        ...DEFAULTS,
        ...updates,
      })
    }
  }, [examProfileId])

  const resetToDefaults = useCallback(async () => {
    if (!examProfileId) return
    await db.tutorPreferences.put({
      id: examProfileId,
      examProfileId,
      ...DEFAULTS,
    })
  }, [examProfileId])

  return { preferences: effectivePreferences, updatePreferences, resetToDefaults }
}
