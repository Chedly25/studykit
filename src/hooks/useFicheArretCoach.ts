/**
 * State machine for the Fiche d'arrêt Trainer.
 * Mirrors useSyllogismeCoach / usePlanCoach:
 * idle → generating → editing → grading → graded.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { useExamProfile } from './useExamProfile'
import { pickFicheDecision, gradeFicheSubmission } from '../ai/coaching/ficheArretCoach'
import {
  createFicheSession,
  deleteFicheSession,
  listFicheSessions,
  loadFicheSession,
  saveFicheGrading,
  saveFicheSubmission,
  type FicheSessionView,
} from '../ai/coaching/ficheArretStore'
import { classifyCoachingError, formatCoachingError } from '../ai/coaching/coachingErrors'
import type { FicheGrading, FicheSubmission, FicheTask } from '../ai/coaching/types'

const FALLBACK_PROFILE_ID = 'legal-chat'

export type FichePhase = 'idle' | 'generating' | 'editing' | 'grading' | 'graded'

export interface FicheDraft {
  faits: string
  procedure: string
  moyens: string
  questionDeDroit: string
  solutionEtPortee: string
}

const EMPTY_DRAFT: FicheDraft = {
  faits: '',
  procedure: '',
  moyens: '',
  questionDeDroit: '',
  solutionEtPortee: '',
}

// ─── Draft persistence (localStorage) ─────────────────────────────
const DRAFT_KEY = (id: string) => `studyskit.draft.fiche.${id}`

function readDraft(id: string): FicheDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY(id))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<FicheDraft>
    return {
      faits: parsed.faits ?? '',
      procedure: parsed.procedure ?? '',
      moyens: parsed.moyens ?? '',
      questionDeDroit: parsed.questionDeDroit ?? '',
      solutionEtPortee: parsed.solutionEtPortee ?? '',
    }
  } catch {
    return null
  }
}

function isEmptyDraft(d: FicheDraft): boolean {
  return !d.faits.trim() && !d.procedure.trim() && !d.moyens.trim()
    && !d.questionDeDroit.trim() && !d.solutionEtPortee.trim()
}

function writeDraft(id: string, draft: FicheDraft): void {
  try {
    if (isEmptyDraft(draft)) return
    localStorage.setItem(DRAFT_KEY(id), JSON.stringify(draft))
  } catch { /* noop */ }
}

function clearDraft(id: string): void {
  try { localStorage.removeItem(DRAFT_KEY(id)) } catch { /* noop */ }
}

export function useFicheArretCoach() {
  const { getToken } = useAuth()
  const { activeProfile } = useExamProfile()
  const examProfileId = activeProfile?.id ?? FALLBACK_PROFILE_ID

  const [phase, setPhase] = useState<FichePhase>('idle')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [task, setTask] = useState<FicheTask | null>(null)
  const [draft, setDraft] = useState<FicheDraft>(EMPTY_DRAFT)
  const [submission, setSubmission] = useState<FicheSubmission | null>(null)
  const [grading, setGrading] = useState<FicheGrading | null>(null)
  const [history, setHistory] = useState<FicheSessionView[]>([])
  const [error, setError] = useState<string | null>(null)

  const abortRef = useRef<AbortController | null>(null)

  const refreshHistory = useCallback(async () => {
    const rows = await listFicheSessions(examProfileId)
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

  const newDecision = useCallback(
    async (chamberId: string) => {
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

        const excludeIds = history.slice(0, 10).map(h => h.task.decision.id)

        const generated = await pickFicheDecision({
          chamberId,
          excludeIds,
          authToken: token,
          signal: abort.signal,
        })

        const id = await createFicheSession(examProfileId, generated)
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

  const saveDraft = useCallback((partial: Partial<FicheDraft>) => {
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
    const built: FicheSubmission = { ...draft, submittedAt }

    setPhase('grading')
    setError(null)
    setSubmission(built)

    try {
      await saveFicheSubmission(sessionId, built)

      const token = await getToken()
      if (!token) throw new Error('Authentification requise')

      const result = await gradeFicheSubmission({
        task,
        submission: built,
        authToken: token,
        getToken: async () => getToken(),
        signal: abort.signal,
      })

      await saveFicheGrading(sessionId, result)
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
    const view = await loadFicheSession(id)
    if (!view) return
    setSessionId(view.id)
    setTask(view.task)
    if (view.submission) {
      setDraft({
        faits: view.submission.faits,
        procedure: view.submission.procedure,
        moyens: view.submission.moyens,
        questionDeDroit: view.submission.questionDeDroit,
        solutionEtPortee: view.submission.solutionEtPortee,
      })
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
    await deleteFicheSession(id)
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
    newDecision,
    saveDraft,
    submit,
    loadSession,
    removeSession,
    reset,
    cancel,
  }
}
