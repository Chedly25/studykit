/**
 * State machine for the Syllogisme Coach page.
 *
 * Phases: idle → generating → editing → grading → graded
 * - idle: theme/difficulty picker visible, no active session
 * - generating: LLM is producing the scenario
 * - editing: scenario loaded, student filling the 3 textareas
 * - grading: submission sent, LLM producing the rubric
 * - graded: rubric shown
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { useExamProfile } from './useExamProfile'
import {
  generateSyllogismeScenario,
  gradeSyllogismeSubmission,
} from '../ai/coaching/syllogismeCoach'
import {
  createSyllogismeSession,
  deleteSyllogismeSession,
  listSyllogismeSessions,
  loadSyllogismeSession,
  saveSyllogismeGrading,
  saveSyllogismeSubmission,
  type SyllogismeSessionView,
} from '../ai/coaching/syllogismeStore'
import type {
  SyllogismeDifficulty,
  SyllogismeGrading,
  SyllogismeSubmission,
  SyllogismeTask,
} from '../ai/coaching/types'

const FALLBACK_PROFILE_ID = 'legal-chat'

export type SyllogismePhase = 'idle' | 'generating' | 'editing' | 'grading' | 'graded'

export interface SubmissionDraft {
  majeure: string
  mineure: string
  conclusion: string
}

const EMPTY_DRAFT: SubmissionDraft = { majeure: '', mineure: '', conclusion: '' }

export function useSyllogismeCoach() {
  const { getToken } = useAuth()
  const { activeProfile } = useExamProfile()
  const examProfileId = activeProfile?.id ?? FALLBACK_PROFILE_ID

  const [phase, setPhase] = useState<SyllogismePhase>('idle')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [task, setTask] = useState<SyllogismeTask | null>(null)
  const [draft, setDraft] = useState<SubmissionDraft>(EMPTY_DRAFT)
  const [submission, setSubmission] = useState<SyllogismeSubmission | null>(null)
  const [grading, setGrading] = useState<SyllogismeGrading | null>(null)
  const [history, setHistory] = useState<SyllogismeSessionView[]>([])
  const [error, setError] = useState<string | null>(null)

  const abortRef = useRef<AbortController | null>(null)

  const refreshHistory = useCallback(async () => {
    const rows = await listSyllogismeSessions(examProfileId)
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

  const newScenario = useCallback(
    async (themeId: string, difficulty: SyllogismeDifficulty) => {
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

        const avoidScenarios = history
          .slice(0, 3)
          .map(h => h.task.scenario.slice(0, 80))

        const generated = await generateSyllogismeScenario({
          themeId,
          difficulty,
          avoidScenarios,
          authToken: token,
          getToken: async () => getToken(),
          signal: abort.signal,
        })

        const id = await createSyllogismeSession(examProfileId, generated)
        setSessionId(id)
        setTask(generated)
        setPhase('editing')
        await refreshHistory()
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
        setError((err as Error).message || 'Impossible de générer le scénario')
        setPhase('idle')
      }
    },
    [getToken, examProfileId, history, refreshHistory],
  )

  const saveDraft = useCallback((partial: Partial<SubmissionDraft>) => {
    setDraft(prev => ({ ...prev, ...partial }))
  }, [])

  const submit = useCallback(async () => {
    if (!task || !sessionId) return
    abortRef.current?.abort()
    const abort = new AbortController()
    abortRef.current = abort

    const submittedAt = new Date().toISOString()
    const built: SyllogismeSubmission = { ...draft, submittedAt }

    setPhase('grading')
    setError(null)
    setSubmission(built)

    try {
      await saveSyllogismeSubmission(sessionId, built)

      const token = await getToken()
      if (!token) throw new Error('Authentification requise')

      const result = await gradeSyllogismeSubmission({
        task,
        submission: built,
        authToken: token,
        getToken: async () => getToken(),
        signal: abort.signal,
      })

      await saveSyllogismeGrading(sessionId, result)
      setGrading(result)
      setPhase('graded')
      await refreshHistory()
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      setError((err as Error).message || 'Impossible de corriger la copie')
      setPhase('editing')
    }
  }, [task, sessionId, draft, getToken, refreshHistory])

  const loadSession = useCallback(
    async (id: string) => {
      const view = await loadSyllogismeSession(id)
      if (!view) return
      setSessionId(view.id)
      setTask(view.task)
      if (view.submission) {
        setDraft({
          majeure: view.submission.majeure,
          mineure: view.submission.mineure,
          conclusion: view.submission.conclusion,
        })
        setSubmission(view.submission)
      } else {
        setDraft(EMPTY_DRAFT)
        setSubmission(null)
      }
      setGrading(view.grading ?? null)
      setError(null)
      setPhase(view.grading ? 'graded' : view.submission ? 'grading' : 'editing')
    },
    [],
  )

  const removeSession = useCallback(
    async (id: string) => {
      await deleteSyllogismeSession(id)
      if (id === sessionId) reset()
      await refreshHistory()
    },
    [sessionId, reset, refreshHistory],
  )

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
