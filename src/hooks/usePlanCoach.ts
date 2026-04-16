/**
 * State machine for the Plan Détaillé Coach.
 * Mirrors useSyllogismeCoach: idle → generating → editing → grading → graded.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { useExamProfile } from './useExamProfile'
import { generatePlanQuestion, gradePlanSubmission } from '../ai/coaching/planCoach'
import {
  createPlanSession,
  deletePlanSession,
  listPlanSessions,
  loadPlanSession,
  savePlanGrading,
  savePlanSubmission,
  type PlanSessionView,
} from '../ai/coaching/planStore'
import type { PlanGrading, PlanSubmission, PlanTask } from '../ai/coaching/types'

const FALLBACK_PROFILE_ID = 'legal-chat'

export type PlanPhase = 'idle' | 'generating' | 'editing' | 'grading' | 'graded'

export interface PlanDraft {
  problematique: string
  I: { title: string; IA: string; IB: string }
  II: { title: string; IIA: string; IIB: string }
}

const EMPTY_DRAFT: PlanDraft = {
  problematique: '',
  I: { title: '', IA: '', IB: '' },
  II: { title: '', IIA: '', IIB: '' },
}

export function usePlanCoach() {
  const { getToken } = useAuth()
  const { activeProfile } = useExamProfile()
  const examProfileId = activeProfile?.id ?? FALLBACK_PROFILE_ID

  const [phase, setPhase] = useState<PlanPhase>('idle')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [task, setTask] = useState<PlanTask | null>(null)
  const [draft, setDraft] = useState<PlanDraft>(EMPTY_DRAFT)
  const [submission, setSubmission] = useState<PlanSubmission | null>(null)
  const [grading, setGrading] = useState<PlanGrading | null>(null)
  const [history, setHistory] = useState<PlanSessionView[]>([])
  const [error, setError] = useState<string | null>(null)

  const abortRef = useRef<AbortController | null>(null)

  const refreshHistory = useCallback(async () => {
    const rows = await listPlanSessions(examProfileId)
    setHistory(rows)
  }, [examProfileId])

  useEffect(() => {
    refreshHistory()
  }, [refreshHistory])

  const reset = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setPhase('idle')
    setSessionId(null)
    setTask(null)
    setDraft(EMPTY_DRAFT)
    setSubmission(null)
    setGrading(null)
    setError(null)
  }, [])

  const newQuestion = useCallback(
    async (themeId: string) => {
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

        const avoidQuestions = history.slice(0, 3).map(h => h.task.question.slice(0, 80))

        const generated = await generatePlanQuestion({
          themeId,
          avoidQuestions,
          authToken: token,
          getToken: async () => getToken(),
          signal: abort.signal,
        })

        const id = await createPlanSession(examProfileId, generated)
        setSessionId(id)
        setTask(generated)
        setPhase('editing')
        await refreshHistory()
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
        setError((err as Error).message || 'Impossible de générer le sujet')
        setPhase('idle')
      }
    },
    [getToken, examProfileId, history, refreshHistory],
  )

  const saveDraft = useCallback((partial: Partial<PlanDraft>) => {
    setDraft(prev => {
      const next = { ...prev, ...partial }
      if (partial.I) next.I = { ...prev.I, ...partial.I }
      if (partial.II) next.II = { ...prev.II, ...partial.II }
      return next
    })
  }, [])

  const submit = useCallback(async () => {
    if (!task || !sessionId) return
    abortRef.current?.abort()
    const abort = new AbortController()
    abortRef.current = abort

    const submittedAt = new Date().toISOString()
    const built: PlanSubmission = { ...draft, submittedAt }

    setPhase('grading')
    setError(null)
    setSubmission(built)

    try {
      await savePlanSubmission(sessionId, built)

      const token = await getToken()
      if (!token) throw new Error('Authentification requise')

      const result = await gradePlanSubmission({
        task,
        submission: built,
        authToken: token,
        getToken: async () => getToken(),
        signal: abort.signal,
      })

      await savePlanGrading(sessionId, result)
      setGrading(result)
      setPhase('graded')
      await refreshHistory()
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      setError((err as Error).message || 'Impossible de corriger le plan')
      setPhase('editing')
    }
  }, [task, sessionId, draft, getToken, refreshHistory])

  const loadSession = useCallback(async (id: string) => {
    const view = await loadPlanSession(id)
    if (!view) return
    setSessionId(view.id)
    setTask(view.task)
    if (view.submission) {
      setDraft({
        problematique: view.submission.problematique,
        I: { ...view.submission.I },
        II: { ...view.submission.II },
      })
      setSubmission(view.submission)
    } else {
      setDraft(EMPTY_DRAFT)
      setSubmission(null)
    }
    setGrading(view.grading ?? null)
    setError(null)
    setPhase(view.grading ? 'graded' : view.submission ? 'grading' : 'editing')
  }, [])

  const removeSession = useCallback(async (id: string) => {
    await deletePlanSession(id)
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
    newQuestion,
    saveDraft,
    submit,
    loadSession,
    removeSession,
    reset,
    cancel,
  }
}
