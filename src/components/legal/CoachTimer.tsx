/**
 * Optional countdown timer for CRFPA coaches — pedagogical, not coercive.
 * - Student clicks "Démarrer" to start
 * - Pause / resume / reset always available
 * - At 0 we show a soft banner ("Temps écoulé") but do NOT auto-submit
 * - Persists running state in sessionStorage so a tab reload doesn't restart
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Timer, Play, Pause, RotateCcw } from 'lucide-react'

interface Props {
  /** Stable key — typically the session ID, so the timer resumes correctly after a reload */
  sessionKey: string
  /** Default duration in seconds (e.g. 15*60 for 15 minutes) */
  defaultSeconds: number
}

interface PersistedState {
  // Total allotted seconds
  total: number
  // Remaining at last tick — absolute ms since epoch when last paused/updated
  remainingAtPause: number
  // If running, the timestamp we started the current run (ms since epoch), else null
  startedAt: number | null
}

const STORAGE_KEY = (sessionKey: string) => `studyskit.timer.${sessionKey}`

function load(sessionKey: string, fallbackSeconds: number): PersistedState {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY(sessionKey))
    if (!raw) return { total: fallbackSeconds, remainingAtPause: fallbackSeconds, startedAt: null }
    const parsed = JSON.parse(raw) as PersistedState
    return {
      total: parsed.total ?? fallbackSeconds,
      remainingAtPause: parsed.remainingAtPause ?? fallbackSeconds,
      startedAt: parsed.startedAt ?? null,
    }
  } catch {
    return { total: fallbackSeconds, remainingAtPause: fallbackSeconds, startedAt: null }
  }
}

function save(sessionKey: string, state: PersistedState): void {
  try {
    sessionStorage.setItem(STORAGE_KEY(sessionKey), JSON.stringify(state))
  } catch { /* noop */ }
}

function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  const m = Math.floor(s / 60)
  const rem = s % 60
  return `${m.toString().padStart(2, '0')}:${rem.toString().padStart(2, '0')}`
}

export function CoachTimer({ sessionKey, defaultSeconds }: Props) {
  // Compute effective remaining seconds from persisted state + wall clock.
  const [state, setState] = useState<PersistedState>(() => load(sessionKey, defaultSeconds))
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Re-hydrate when the sessionKey changes (e.g. switching to a different session)
  useEffect(() => {
    setState(load(sessionKey, defaultSeconds))
  }, [sessionKey, defaultSeconds])

  // Derived: how many seconds are left right now
  const computeRemaining = useCallback((s: PersistedState): number => {
    if (s.startedAt === null) return s.remainingAtPause
    const elapsedSec = (Date.now() - s.startedAt) / 1000
    return Math.max(0, s.remainingAtPause - elapsedSec)
  }, [])

  const [remaining, setRemaining] = useState<number>(() => computeRemaining(state))

  // Tick every 250ms while running
  useEffect(() => {
    if (tickRef.current) clearInterval(tickRef.current)
    tickRef.current = setInterval(() => {
      setRemaining(computeRemaining(state))
    }, 250)
    return () => {
      if (tickRef.current) clearInterval(tickRef.current)
    }
  }, [state, computeRemaining])

  const start = useCallback(() => {
    setState(prev => {
      if (prev.startedAt !== null) return prev  // already running
      if (prev.remainingAtPause <= 0) return prev  // expired, need a reset
      const next: PersistedState = {
        ...prev,
        startedAt: Date.now(),
      }
      save(sessionKey, next)
      return next
    })
  }, [sessionKey])

  const pause = useCallback(() => {
    setState(prev => {
      if (prev.startedAt === null) return prev  // already paused
      const elapsedSec = (Date.now() - prev.startedAt) / 1000
      const next: PersistedState = {
        ...prev,
        remainingAtPause: Math.max(0, prev.remainingAtPause - elapsedSec),
        startedAt: null,
      }
      save(sessionKey, next)
      return next
    })
  }, [sessionKey])

  const reset = useCallback(() => {
    setState(prev => {
      const next: PersistedState = {
        total: prev.total,
        remainingAtPause: prev.total,
        startedAt: null,
      }
      save(sessionKey, next)
      return next
    })
  }, [sessionKey])

  const isRunning = state.startedAt !== null
  const isExpired = remaining <= 0

  // Color progression: green (>50%) → amber (20-50%) → red (<20%)
  const pct = state.total > 0 ? remaining / state.total : 0
  const colorClass =
    isExpired ? 'text-[var(--color-error)] '
    : pct < 0.2 ? 'text-[var(--color-error)] '
    : pct < 0.5 ? 'text-[var(--color-warning)] '
    : 'text-[var(--text-secondary)]'

  return (
    <div className="glass-card p-3 flex items-center gap-3">
      <Timer className={`w-4 h-4 ${isExpired ? 'text-[var(--color-error)]' : 'text-[var(--text-muted)]'}`} />
      <div className="flex-1 min-w-0">
        <div className={`font-mono text-base font-semibold tabular-nums ${colorClass}`}>
          {formatClock(remaining)}
        </div>
        {isExpired && (
          <div className="text-[11px] text-[var(--color-error)] ">
            Temps écoulé — tu peux continuer, mais c'est le moment de conclure.
          </div>
        )}
      </div>
      <div className="flex items-center gap-1">
        {!isRunning ? (
          <button
            type="button"
            onClick={start}
            disabled={isExpired}
            className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] disabled:opacity-40"
            title="Démarrer"
            aria-label="Démarrer"
          >
            <Play className="w-4 h-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={pause}
            className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-secondary)]"
            title="Pause"
            aria-label="Pause"
          >
            <Pause className="w-4 h-4" />
          </button>
        )}
        <button
          type="button"
          onClick={reset}
          className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-muted)]"
          title="Réinitialiser"
          aria-label="Réinitialiser"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

