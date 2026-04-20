/**
 * State machine for the Note de synthèse coach.
 * Hybrid flow: background job for dossier generation + synchronous grading.
 *
 * Phases: idle → generating → editing → grading → graded
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { useExamProfile } from './useExamProfile'
import { useBackgroundJobs } from '../components/BackgroundJobsProvider'
import { useBackgroundJob } from './useBackgroundJob'
import { triggerDossierGeneration, gradeNoteSynthese } from '../ai/coaching/noteSyntheseCoach'
import {
  createNoteSyntheseSession,
  deleteNoteSyntheseSession,
  listNoteSyntheseSessions,
  loadNoteSyntheseSession,
  saveNoteSyntheseGrading,
  saveNoteSyntheseSubmission,
  snapshotDossier,
  type NoteSyntheseSessionView,
} from '../ai/coaching/noteSyntheseStore'
import { classifyCoachingError, formatCoachingError } from '../ai/coaching/coachingErrors'
import type { NoteSyntheseGrading, NoteSyntheseSubmission, NoteSyntheseTask } from '../ai/coaching/types'

const FALLBACK_PROFILE_ID = 'legal-chat'

export type NoteSynthesePhase = 'idle' | 'generating' | 'editing' | 'grading' | 'graded'

// ─── Draft persistence (localStorage) ─────────────────────────────
const DRAFT_KEY = (id: string) => `studyskit.draft.note-synthese.${id}`

function readDraft(id: string): string {
  try {
    return localStorage.getItem(DRAFT_KEY(id)) ?? ''
  } catch {
    return ''
  }
}

function writeDraft(id: string, text: string): void {
  try {
    if (!text.trim()) return
    localStorage.setItem(DRAFT_KEY(id), text)
  } catch { /* noop */ }
}

function clearDraft(id: string): void {
  try { localStorage.removeItem(DRAFT_KEY(id)) } catch { /* noop */ }
}

export function useNoteSyntheseCoach() {
  const { getToken } = useAuth()
  const { activeProfile } = useExamProfile()
  const examProfileId = activeProfile?.id ?? FALLBACK_PROFILE_ID
  const { enqueue, cancel: cancelJob } = useBackgroundJobs()

  const [phase, setPhase] = useState<NoteSynthesePhase>('idle')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [genJobId, setGenJobId] = useState<string | null>(null)
  const [practiceExamSessionId, setPracticeExamSessionId] = useState<string | null>(null)
  const [task, setTask] = useState<NoteSyntheseTask | null>(null)
  const [draftText, setDraftText] = useState('')
  const [submission, setSubmission] = useState<NoteSyntheseSubmission | null>(null)
  const [grading, setGrading] = useState<NoteSyntheseGrading | null>(null)
  const [history, setHistory] = useState<NoteSyntheseSessionView[]>([])
  const [error, setError] = useState<string | null>(null)

  const abortRef = useRef<AbortController | null>(null)
  const snapshotDoneRef = useRef(false)

  // Background job tracking for dossier generation
  const genJob = useBackgroundJob(genJobId)

  const refreshHistory = useCallback(async () => {
    const rows = await listNoteSyntheseSessions(examProfileId)
    setHistory(rows)
  }, [examProfileId])

  useEffect(() => {
    refreshHistory()
  }, [refreshHistory])

  // ─── Transition: generation complete → editing ─────────────────
  useEffect(() => {
    if (
      genJob.isCompleted &&
      phase === 'generating' &&
      sessionId &&
      practiceExamSessionId &&
      !snapshotDoneRef.current
    ) {
      snapshotDoneRef.current = true
      ;(async () => {
        try {
          const snapshotTask = await snapshotDossier(sessionId, practiceExamSessionId)
          setTask(snapshotTask)
          setPhase('editing')
          await refreshHistory()
        } catch (err) {
          setError(formatCoachingError(classifyCoachingError(err)))
          setPhase('idle')
        }
      })()
    }
  }, [genJob.isCompleted, phase, sessionId, practiceExamSessionId, refreshHistory])

  // ─── Transition: generation failed ─────────────────────────────
  useEffect(() => {
    if (genJob.isFailed && phase === 'generating') {
      setError(genJob.error ?? 'La génération du dossier a échoué.')
      setPhase('idle')
    }
  }, [genJob.isFailed, phase, genJob.error])

  const reset = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    if (sessionId) clearDraft(sessionId)
    setPhase('idle')
    setSessionId(null)
    setGenJobId(null)
    setPracticeExamSessionId(null)
    setTask(null)
    setDraftText('')
    setSubmission(null)
    setGrading(null)
    setError(null)
    snapshotDoneRef.current = false
  }, [sessionId])

  const newDossier = useCallback(
    async (sourcesEnabled = true) => {
      setPhase('generating')
      setError(null)
      setTask(null)
      setDraftText('')
      setSubmission(null)
      setGrading(null)
      snapshotDoneRef.current = false

      try {
        const { practiceExamSessionId: pesId, genJobId: jId } = await triggerDossierGeneration({
          examProfileId,
          sourcesEnabled,
          enqueue,
        })

        const coachingId = await createNoteSyntheseSession(examProfileId, pesId, jId)

        setSessionId(coachingId)
        setPracticeExamSessionId(pesId)
        setGenJobId(jId)
        await refreshHistory()
      } catch (err) {
        setError(formatCoachingError(classifyCoachingError(err)))
        setPhase('idle')
      }
    },
    [examProfileId, enqueue, refreshHistory],
  )

  const saveDraft = useCallback((text: string) => {
    setDraftText(text)
    if (sessionId) writeDraft(sessionId, text)
  }, [sessionId])

  const submit = useCallback(async () => {
    if (!task || !sessionId) return
    abortRef.current?.abort()
    const abort = new AbortController()
    abortRef.current = abort

    const built: NoteSyntheseSubmission = {
      text: draftText,
      submittedAt: new Date().toISOString(),
    }

    setPhase('grading')
    setError(null)
    setSubmission(built)

    try {
      await saveNoteSyntheseSubmission(sessionId, built)

      const token = await getToken()
      if (!token) throw new Error('Authentification requise')

      const result = await gradeNoteSynthese({
        task,
        submission: built,
        authToken: token,
        getToken: async () => getToken(),
        signal: abort.signal,
      })

      await saveNoteSyntheseGrading(sessionId, result)
      clearDraft(sessionId)
      setGrading(result)
      setPhase('graded')
      await refreshHistory()
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      setError(formatCoachingError(classifyCoachingError(err)))
      setPhase('editing')
    }
  }, [task, sessionId, draftText, getToken, refreshHistory])

  const loadSession = useCallback(async (id: string) => {
    const view = await loadNoteSyntheseSession(id)
    if (!view) return

    setSessionId(view.id)
    setError(null)
    snapshotDoneRef.current = false

    if (view.generating) {
      // Session is still generating — restore background job tracking
      setPracticeExamSessionId(view.generating.practiceExamSessionId)
      setGenJobId(view.generating.genJobId)
      setTask(null)
      setDraftText('')
      setSubmission(null)
      setGrading(null)
      setPhase('generating')
    } else if (view.task) {
      setTask(view.task)
      setPracticeExamSessionId(view.task.practiceExamSessionId)
      setGenJobId(null)

      if (view.submission) {
        setDraftText(view.submission.text)
        setSubmission(view.submission)
      } else {
        const saved = readDraft(view.id)
        setDraftText(saved)
        setSubmission(null)
      }

      setGrading(view.grading ?? null)
      setPhase(view.grading ? 'graded' : 'editing')
    }
  }, [])

  const removeSession = useCallback(async (id: string) => {
    await deleteNoteSyntheseSession(id)
    clearDraft(id)
    if (id === sessionId) reset()
    await refreshHistory()
  }, [sessionId, reset, refreshHistory])

  const cancel = useCallback(() => {
    abortRef.current?.abort()
    if (genJobId) cancelJob(genJobId)
  }, [genJobId, cancelJob])

  return {
    phase,
    task,
    draftText,
    submission,
    grading,
    history,
    error,
    sessionId,
    // Generation progress
    generationProgress: genJob.job ? {
      currentStepName: genJob.currentStepName,
      completedSteps: genJob.job.completedStepCount,
      totalSteps: genJob.job.totalSteps,
      progress: genJob.progress,
    } : null,
    generationError: genJob.error,
    // Actions
    newDossier,
    saveDraft,
    submit,
    loadSession,
    removeSession,
    reset,
    cancel,
  }
}
