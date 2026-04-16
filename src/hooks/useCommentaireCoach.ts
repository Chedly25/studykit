/**
 * State machine for the Commentaire d'arrêt coach.
 * Mirrors the other coaches: idle → generating → editing → grading → graded.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { useExamProfile } from './useExamProfile'
import { pickCommentaireDecision, gradeCommentaireSubmission } from '../ai/coaching/commentaireCoach'
import {
  createCommentaireSession,
  deleteCommentaireSession,
  listCommentaireSessions,
  loadCommentaireSession,
  saveCommentaireGrading,
  saveCommentaireSubmission,
  type CommentaireSessionView,
} from '../ai/coaching/commentaireStore'
import { classifyCoachingError, formatCoachingError } from '../ai/coaching/coachingErrors'
import type { CommentaireGrading, CommentaireSubmission, CommentaireTask } from '../ai/coaching/types'

const FALLBACK_PROFILE_ID = 'legal-chat'

export type CommentairePhase = 'idle' | 'generating' | 'editing' | 'grading' | 'graded'

export interface CommentaireDraft {
  introduction: string
  I: { title: string; IA: string; IB: string }
  II: { title: string; IIA: string; IIB: string }
}

const EMPTY_DRAFT: CommentaireDraft = {
  introduction: '',
  I: { title: '', IA: '', IB: '' },
  II: { title: '', IIA: '', IIB: '' },
}

// ─── Draft persistence (localStorage) ─────────────────────────────
const DRAFT_KEY = (id: string) => `studyskit.draft.commentaire.${id}`

function readDraft(id: string): CommentaireDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY(id))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<CommentaireDraft>
    return {
      introduction: parsed.introduction ?? '',
      I: {
        title: parsed.I?.title ?? '',
        IA: parsed.I?.IA ?? '',
        IB: parsed.I?.IB ?? '',
      },
      II: {
        title: parsed.II?.title ?? '',
        IIA: parsed.II?.IIA ?? '',
        IIB: parsed.II?.IIB ?? '',
      },
    }
  } catch {
    return null
  }
}

function isEmptyDraft(d: CommentaireDraft): boolean {
  return !d.introduction.trim()
    && !d.I.title.trim() && !d.I.IA.trim() && !d.I.IB.trim()
    && !d.II.title.trim() && !d.II.IIA.trim() && !d.II.IIB.trim()
}

function writeDraft(id: string, draft: CommentaireDraft): void {
  try {
    if (isEmptyDraft(draft)) return
    localStorage.setItem(DRAFT_KEY(id), JSON.stringify(draft))
  } catch { /* noop */ }
}

function clearDraft(id: string): void {
  try { localStorage.removeItem(DRAFT_KEY(id)) } catch { /* noop */ }
}

export function useCommentaireCoach() {
  const { getToken } = useAuth()
  const { activeProfile } = useExamProfile()
  const examProfileId = activeProfile?.id ?? FALLBACK_PROFILE_ID

  const [phase, setPhase] = useState<CommentairePhase>('idle')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [task, setTask] = useState<CommentaireTask | null>(null)
  const [draft, setDraft] = useState<CommentaireDraft>(EMPTY_DRAFT)
  const [submission, setSubmission] = useState<CommentaireSubmission | null>(null)
  const [grading, setGrading] = useState<CommentaireGrading | null>(null)
  const [history, setHistory] = useState<CommentaireSessionView[]>([])
  const [error, setError] = useState<string | null>(null)

  const abortRef = useRef<AbortController | null>(null)

  const refreshHistory = useCallback(async () => {
    const rows = await listCommentaireSessions(examProfileId)
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

        const generated = await pickCommentaireDecision({
          chamberId,
          excludeIds,
          authToken: token,
          signal: abort.signal,
        })

        const id = await createCommentaireSession(examProfileId, generated)
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

  const saveDraft = useCallback((partial: Partial<CommentaireDraft>) => {
    setDraft(prev => {
      const next = { ...prev, ...partial }
      if (partial.I) next.I = { ...prev.I, ...partial.I }
      if (partial.II) next.II = { ...prev.II, ...partial.II }
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
    const built: CommentaireSubmission = { ...draft, submittedAt }

    setPhase('grading')
    setError(null)
    setSubmission(built)

    try {
      await saveCommentaireSubmission(sessionId, built)

      const token = await getToken()
      if (!token) throw new Error('Authentification requise')

      const result = await gradeCommentaireSubmission({
        task,
        submission: built,
        authToken: token,
        getToken: async () => getToken(),
        signal: abort.signal,
      })

      await saveCommentaireGrading(sessionId, result)
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
    const view = await loadCommentaireSession(id)
    if (!view) return
    setSessionId(view.id)
    setTask(view.task)
    if (view.submission) {
      setDraft({
        introduction: view.submission.introduction,
        I: { ...view.submission.I },
        II: { ...view.submission.II },
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
    await deleteCommentaireSession(id)
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
