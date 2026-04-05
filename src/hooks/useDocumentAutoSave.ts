/**
 * Auto-saves document exam answers to Dexie on debounced change.
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import { db } from '../db'

export function useDocumentAutoSave(
  sessionId: string | undefined,
  answers: Record<number, string>,
  debounceMs = 500,
): { isSaving: boolean; lastSaved: Date | null } {
  const [isSaving, setIsSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const answersRef = useRef(answers)
  answersRef.current = answers

  const flush = useCallback(async () => {
    if (!sessionId) return
    setIsSaving(true)
    try {
      await db.practiceExamSessions.update(sessionId, {
        documentAnswers: JSON.stringify(answersRef.current),
      })
      setLastSaved(new Date())
    } catch { /* non-critical */ }
    finally { setIsSaving(false) }
  }, [sessionId])

  useEffect(() => {
    if (!sessionId) return
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(flush, debounceMs)
    return () => clearTimeout(timerRef.current)
  }, [answers, sessionId, debounceMs, flush])

  // Flush on unmount
  useEffect(() => {
    return () => { flush() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { isSaving, lastSaved }
}
