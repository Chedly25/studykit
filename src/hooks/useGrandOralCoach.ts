/**
 * State machine for the Grand Oral coach.
 * Orchestrates: pick sujet → ground via Claude → mint OpenAI realtime token →
 * WebRTC live session (see useGrandOralWebRTC) → grade → persist.
 *
 * Phases: idle → grounding → ready → connecting → live → grading → graded
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { useExamProfile } from './useExamProfile'
import {
  buildJuryToolHandler,
  gradeGrandOralSession,
  loadGrandOralTask,
  pickGrandOralSujet,
  startGrandOralSession,
  type GrandOralSessionToken,
  type PickSujetOptions,
} from '../ai/coaching/grandOralCoach'
import {
  createGrandOralSession,
  deleteGrandOralSession,
  listGrandOralSessions,
  loadGrandOralSession,
  saveGrandOralGrading,
  saveGrandOralSubmission,
  type GrandOralSessionView,
} from '../ai/coaching/grandOralStore'
import type {
  GrandOralGrading,
  GrandOralSubmission,
  GrandOralTask,
} from '../ai/coaching/types'
import type { GrandOralTranscriptTurn } from './useGrandOralWebRTC'

const FALLBACK_PROFILE_ID = 'legal-chat'

export type GrandOralPhase = 'idle' | 'grounding' | 'ready' | 'connecting' | 'live' | 'grading' | 'graded'

function formatTranscript(turns: GrandOralTranscriptTurn[]): string {
  return turns
    .map(t => `[${t.role === 'student' ? 'Candidat' : 'Jury'}] ${t.text}`)
    .join('\n\n')
}

function exposeTranscript(turns: GrandOralTranscriptTurn[], exposeCutoffSec: number): string {
  return turns
    .filter(t => t.role === 'student' && t.startedAt / 1000 <= exposeCutoffSec)
    .map(t => t.text)
    .join('\n\n')
}

export function useGrandOralCoach() {
  const { getToken } = useAuth()
  const { activeProfile } = useExamProfile()
  const examProfileId = activeProfile?.id ?? FALLBACK_PROFILE_ID

  const [phase, setPhase] = useState<GrandOralPhase>('idle')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [task, setTask] = useState<GrandOralTask | null>(null)
  const [sessionToken, setSessionToken] = useState<GrandOralSessionToken | null>(null)
  const [grading, setGrading] = useState<GrandOralGrading | null>(null)
  const [history, setHistory] = useState<GrandOralSessionView[]>([])
  const [error, setError] = useState<string | null>(null)

  const abortRef = useRef<AbortController | null>(null)

  const refreshHistory = useCallback(async () => {
    const rows = await listGrandOralSessions(examProfileId)
    setHistory(rows)
  }, [examProfileId])

  useEffect(() => {
    void refreshHistory()
  }, [refreshHistory])

  const reset = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setPhase('idle')
    setSessionId(null)
    setTask(null)
    setSessionToken(null)
    setGrading(null)
    setError(null)
  }, [])

  const getAuthToken = useCallback(async (): Promise<string> => {
    const t = await getToken()
    if (!t) throw new Error('Authentication token unavailable — please sign in again')
    return t
  }, [getToken])

  // ─── Ground a sujet (pick + Claude grounding) ─────────────────
  const startNew = useCallback(
    async (filter: PickSujetOptions = {}) => {
      setError(null)
      setPhase('grounding')
      abortRef.current?.abort()
      abortRef.current = new AbortController()
      try {
        const excludeIds = history.filter(h => h.grading).slice(0, 10).map(h => h.task.sujet.id)
        const sujet = pickGrandOralSujet({ ...filter, excludeIds })
        const authToken = await getAuthToken()
        const grounded = await loadGrandOralTask({
          sujet,
          authToken,
          getToken,
          signal: abortRef.current.signal,
        })
        const id = await createGrandOralSession(examProfileId, grounded)
        setSessionId(id)
        setTask(grounded)
        setPhase('ready')
      } catch (e) {
        const msg = String((e as Error).message ?? e)
        setError(msg)
        setPhase('idle')
      }
    },
    [history, examProfileId, getAuthToken, getToken],
  )

  // ─── Mint the OpenAI Realtime ephemeral token ─────────────────
  const connectSession = useCallback(async () => {
    if (!task || phase !== 'ready') return
    setPhase('connecting')
    setError(null)
    try {
      const authToken = await getAuthToken()
      const token = await startGrandOralSession(task, { authToken })
      setSessionToken(token)
      setPhase('live')
    } catch (e) {
      setError(String((e as Error).message ?? e))
      setPhase('ready')
    }
  }, [task, phase, getAuthToken])

  // Tool handler re-derives whenever task changes. UI plumbs this into the WebRTC hook.
  const toolHandler = useCallback(
    async (args: Parameters<ReturnType<typeof buildJuryToolHandler>>[0]) => {
      if (!task) throw new Error('No active task')
      const authToken = await getAuthToken()
      const h = buildJuryToolHandler(task, { authToken, getToken })
      return h(args)
    },
    [task, getAuthToken, getToken],
  )

  // ─── Submit transcript → grade ────────────────────────────────
  const submitAndGrade = useCallback(
    async (turns: GrandOralTranscriptTurn[], metrics: {
      durationSec: number
      interruptionCount: number
      avgLatencySec: number
      juryQuestions: string[]
    }) => {
      if (!task || !sessionId) return
      setPhase('grading')
      setError(null)
      abortRef.current?.abort()
      abortRef.current = new AbortController()
      const EXPOSE_CUTOFF_SEC = 15 * 60
      const exposeDurSec = Math.min(metrics.durationSec, EXPOSE_CUTOFF_SEC)
      const submission: GrandOralSubmission = {
        fullTranscript: formatTranscript(turns),
        exposeTranscript: exposeTranscript(turns, EXPOSE_CUTOFF_SEC),
        durationSec: metrics.durationSec,
        exposeDurationSec: exposeDurSec,
        interruptionCount: metrics.interruptionCount,
        avgLatencySec: metrics.avgLatencySec,
        juryQuestions: metrics.juryQuestions,
        submittedAt: new Date().toISOString(),
      }
      try {
        await saveGrandOralSubmission(sessionId, submission)
        const authToken = await getAuthToken()
        const g = await gradeGrandOralSession({
          task,
          submission,
          authToken,
          getToken,
          signal: abortRef.current.signal,
        })
        await saveGrandOralGrading(sessionId, g)
        setGrading(g)
        setPhase('graded')
        await refreshHistory()
      } catch (e) {
        setError(String((e as Error).message ?? e))
        setPhase('ready') // fallback so user can retry
      }
    },
    [task, sessionId, getAuthToken, getToken, refreshHistory],
  )

  const loadSession = useCallback(
    async (id: string) => {
      const row = await loadGrandOralSession(id)
      if (!row) return
      setSessionId(row.id)
      setTask(row.task)
      setGrading(row.grading ?? null)
      setPhase(row.grading ? 'graded' : 'ready')
    },
    [],
  )

  const removeSession = useCallback(
    async (id: string) => {
      await deleteGrandOralSession(id)
      if (sessionId === id) reset()
      await refreshHistory()
    },
    [sessionId, reset, refreshHistory],
  )

  return {
    phase,
    task,
    sessionToken,
    sessionId,
    grading,
    history,
    error,
    startNew,
    connectSession,
    toolHandler,
    submitAndGrade,
    loadSession,
    removeSession,
    reset,
  }
}
