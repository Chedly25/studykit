/**
 * State machine for the Cas pratique coach.
 * Mirrors the other coaches: idle → generating → editing → grading → graded.
 * Single prose textarea for submission. Generation fans out a grounding pool
 * via searchLegalCodes + Opus + verification pass.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { useExamProfile } from './useExamProfile'
import { generateCasPratiqueScenario, gradeCasPratiqueSubmission } from '../ai/coaching/casPratiqueCoach'
import {
  createCasPratiqueSession,
  deleteCasPratiqueSession,
  listCasPratiqueSessions,
  loadCasPratiqueSession,
  saveCasPratiqueGrading,
  saveCasPratiqueSubmission,
  type CasPratiqueSessionView,
} from '../ai/coaching/casPratiqueStore'
import { classifyCoachingError, formatCoachingError } from '../ai/coaching/coachingErrors'
import type { CasPratiqueSpecialty } from '../ai/prompts/casPratiquePrompts'
import type { CasPratiqueGrading, CasPratiqueSubmission, CasPratiqueTask } from '../ai/coaching/types'

const FALLBACK_PROFILE_ID = 'legal-chat'

export type CasPratiquePhase = 'idle' | 'generating' | 'editing' | 'grading' | 'graded'

export interface CasPratiqueDraft {
  answer: string
}

const EMPTY_DRAFT: CasPratiqueDraft = { answer: '' }

// ─── Draft persistence (localStorage) ─────────────────────────────
const DRAFT_KEY = (id: string) => `studyskit.draft.cas-pratique.${id}`

function readDraft(id: string): CasPratiqueDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY(id))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<CasPratiqueDraft>
    return { answer: parsed.answer ?? '' }
  } catch {
    return null
  }
}

function isEmptyDraft(d: CasPratiqueDraft): boolean {
  return !d.answer.trim()
}

function writeDraft(id: string, draft: CasPratiqueDraft): void {
  try {
    if (isEmptyDraft(draft)) return
    localStorage.setItem(DRAFT_KEY(id), JSON.stringify(draft))
  } catch { /* noop */ }
}

function clearDraft(id: string): void {
  try { localStorage.removeItem(DRAFT_KEY(id)) } catch { /* noop */ }
}

export function useCasPratiqueCoach() {
  const { getToken } = useAuth()
  const { activeProfile } = useExamProfile()
  const examProfileId = activeProfile?.id ?? FALLBACK_PROFILE_ID

  const [phase, setPhase] = useState<CasPratiquePhase>('idle')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [task, setTask] = useState<CasPratiqueTask | null>(null)
  const [draft, setDraft] = useState<CasPratiqueDraft>(EMPTY_DRAFT)
  const [submission, setSubmission] = useState<CasPratiqueSubmission | null>(null)
  const [grading, setGrading] = useState<CasPratiqueGrading | null>(null)
  const [history, setHistory] = useState<CasPratiqueSessionView[]>([])
  const [error, setError] = useState<string | null>(null)

  const abortRef = useRef<AbortController | null>(null)

  const refreshHistory = useCallback(async () => {
    const rows = await listCasPratiqueSessions(examProfileId)
    setHistory(rows)
  }, [examProfileId])

  useEffect(() => {
    refreshHistory()
  }, [refreshHistory])

  const reset = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    if (sessionId) clearDraft(sessionId)
    setPhase('idle')
    setSessionId(null)
    setTask(null)
    setDraft(EMPTY_DRAFT)
    setSubmission(null)
    setGrading(null)
    setError(null)
  }, [sessionId])

  const newScenario = useCallback(
    async (specialty: CasPratiqueSpecialty, duration: number) => {
      abortRef.current?.abort()
      const abort = new AbortController()
      abortRef.current = abort

      setPhase('generating')
      setError(null)
      setTask(null)
      setDraft(EMPTY_DRAFT)
      setSubmission(null)
      setGrading(null)

      try {
        const token = await getToken()
        if (!token) throw new Error('Authentification requise')

        // Collect recent scenario openings to discourage repetition
        const avoidThemes = history.slice(0, 3)
          .map(h => h.task.scenario.slice(0, 100))
          .filter(Boolean)

        const generated = await generateCasPratiqueScenario({
          specialty,
          duration,
          avoidThemes,
          authToken: token,
          getToken: async () => getToken(),
          signal: abort.signal,
        })

        const id = await createCasPratiqueSession(examProfileId, generated)
        setSessionId(id)
        setTask(generated)
        setPhase('editing')
        await refreshHistory()
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
        setError(formatCoachingError(classifyCoachingError(err)))
        setPhase('idle')
      }
    },
    [getToken, examProfileId, history, refreshHistory],
  )

  const saveDraft = useCallback((partial: Partial<CasPratiqueDraft>) => {
    setDraft(prev => {
      const next = { ...prev, ...partial }
      if (sessionId) writeDraft(sessionId, next)
      return next
    })
  }, [sessionId])

  const submit = useCallback(async () => {
    if (!task || !sessionId) return
    abortRef.current?.abort()
    const abort = new AbortController()
    abortRef.current = abort

    const submittedAt = new Date().toISOString()
    const built: CasPratiqueSubmission = { answer: draft.answer, submittedAt }

    setPhase('grading')
    setError(null)
    setSubmission(built)

    try {
      await saveCasPratiqueSubmission(sessionId, built)

      const token = await getToken()
      if (!token) throw new Error('Authentification requise')

      const result = await gradeCasPratiqueSubmission({
        task,
        submission: built,
        authToken: token,
        getToken: async () => getToken(),
        signal: abort.signal,
      })

      await saveCasPratiqueGrading(sessionId, result)
      clearDraft(sessionId)
      setGrading(result)
      setPhase('graded')
      await refreshHistory()
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      setError(formatCoachingError(classifyCoachingError(err)))
      setPhase('editing')
    }
  }, [task, sessionId, draft, getToken, refreshHistory])

  const loadSession = useCallback(async (id: string) => {
    const view = await loadCasPratiqueSession(id)
    if (!view) return
    setSessionId(view.id)
    setTask(view.task)
    if (view.submission) {
      setDraft({ answer: view.submission.answer })
      setSubmission(view.submission)
    } else {
      const savedDraft = readDraft(view.id)
      setDraft(savedDraft ?? EMPTY_DRAFT)
      setSubmission(null)
    }
    setGrading(view.grading ?? null)
    setError(null)
    setPhase(view.grading ? 'graded' : view.submission ? 'grading' : 'editing')
  }, [])

  const removeSession = useCallback(async (id: string) => {
    await deleteCasPratiqueSession(id)
    clearDraft(id)
    if (id === sessionId) reset()
    await refreshHistory()
  }, [sessionId, reset, refreshHistory])

  const cancel = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  return {
    phase,
    task,
    draft,
    submission,
    grading,
    history,
    error,
    sessionId,
    newScenario,
    saveDraft,
    submit,
    loadSession,
    removeSession,
    reset,
    cancel,
  }
}
