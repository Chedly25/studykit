/**
 * Live Grand Oral session — WebRTC connected to OpenAI Realtime.
 * Displays countdown (15 min expose + 30 min Q&A), sujet card,
 * transcript, jury speaking indicator, mute + end-session controls.
 * On end: assembles submission + metrics, hands off to parent for grading.
 */
import { useEffect, useMemo, useRef } from 'react'
import { Mic, MicOff, Square } from 'lucide-react'
import { useGrandOralWebRTC } from '../../hooks/useGrandOralWebRTC'
import type { GrandOralTask, JuryQuestionToolArgs, JuryQuestionToolResult } from '../../ai/coaching/types'

const EXPOSE_SECS = 15 * 60
const TOTAL_SECS = 45 * 60

interface Props {
  task: GrandOralTask
  clientSecret: string
  model: string
  toolHandler: (args: JuryQuestionToolArgs) => Promise<JuryQuestionToolResult>
  onFinish: (args: {
    transcript: ReturnType<typeof useGrandOralWebRTC>['transcript']
    metrics: ReturnType<typeof useGrandOralWebRTC>['metrics']
  }) => void
  onError: (msg: string) => void
}

export function GrandOralSessionLive({ task, clientSecret, model, toolHandler, onFinish, onError }: Props) {
  const rtc = useGrandOralWebRTC({ clientSecret, model, toolHandler, onClose: onError })

  // Auto-connect once on mount. The Brief component already captured user gesture.
  const connectedOnce = useRef(false)
  useEffect(() => {
    if (connectedOnce.current) return
    connectedOnce.current = true
    void rtc.connect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const elapsed = Math.floor(rtc.metrics.durationSec)
  const phase: 'expose' | 'qa' | 'overtime' = elapsed < EXPOSE_SECS
    ? 'expose'
    : elapsed < TOTAL_SECS
    ? 'qa'
    : 'overtime'

  const phaseRemaining = phase === 'expose'
    ? EXPOSE_SECS - elapsed
    : phase === 'qa'
    ? TOTAL_SECS - elapsed
    : 0

  const transcript = rtc.transcript
  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [transcript.length])

  const juryIsSpeaking = useMemo(() => {
    // Heuristic: last turn is jury and less than 3 sec since its startedAt was updated.
    // Without per-delta timestamps we approximate by inspecting the latest turn.
    if (transcript.length === 0) return false
    const last = transcript[transcript.length - 1]
    return last.role === 'jury' && rtc.metrics.durationSec * 1000 - last.completedAt < 2000
  }, [transcript, rtc.metrics.durationSec])

  const handleFinish = () => {
    // Capture state BEFORE disconnecting (disconnect doesn't reset transcript but belt-and-suspenders)
    const snapshot = { transcript: rtc.transcript, metrics: rtc.metrics }
    rtc.disconnect()
    onFinish(snapshot)
  }

  return (
    <div className="flex flex-col h-full max-w-5xl mx-auto p-4 gap-4">
      <audio ref={rtc.audioRef} autoPlay hidden />

      {/* Sujet + timer header */}
      <header className="rounded-lg border border-[var(--border-card)] bg-[var(--bg-main)] p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="text-xs uppercase tracking-wider text-[var(--text-muted)]">Sujet</div>
            <div className="text-base font-semibold text-[var(--text-heading)] line-clamp-2">{task.sujet.text}</div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-xs uppercase tracking-wider text-[var(--text-muted)]">
              {phase === 'expose' ? 'Exposé' : phase === 'qa' ? 'Questions' : 'Temps écoulé'}
            </div>
            <div className={`text-2xl font-mono tabular-nums ${phaseRemaining < 60 && phase !== 'overtime' ? 'text-[var(--color-error)]' : 'text-[var(--text-heading)]'}`}>
              {formatMMSS(phaseRemaining)}
            </div>
          </div>
        </div>
      </header>

      {/* Status bar */}
      <div className="flex items-center gap-3 text-sm">
        <ConnectionIndicator state={rtc.state} />
        <div className="flex-1" />
        <div className="text-xs text-[var(--text-muted)]">
          {rtc.metrics.juryQuestions.length} questions • {rtc.metrics.interruptionCount} interruptions
        </div>
      </div>

      {rtc.error && (
        <div className="rounded-lg bg-[var(--color-error-bg)] border border-[var(--color-error-border)] text-[var(--color-error)] text-sm p-3">
          {rtc.error}
        </div>
      )}

      {/* Mic status / jury speaker indicator */}
      <div className="rounded-lg border border-[var(--border-card)] bg-[var(--bg-main)] p-6 flex items-center justify-center gap-6">
        <div className="flex items-center gap-2">
          {rtc.isMuted ? (
            <MicOff className="w-5 h-5 text-[var(--color-error)]" />
          ) : (
            <Mic className={`w-5 h-5 ${rtc.state === 'connected' ? 'text-[var(--color-success)]' : 'text-[var(--text-muted)]'}`} />
          )}
          <span className="text-xs text-[var(--text-muted)]">
            {rtc.isMuted ? 'Micro coupé' : 'Micro actif'}
          </span>
        </div>
        <div className="h-8 w-px bg-[var(--border-card)]" />
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${juryIsSpeaking ? 'bg-[var(--color-info)] animate-pulse' : 'bg-[var(--border-card)]'}`} />
          <span className="text-xs text-[var(--text-muted)]">
            {juryIsSpeaking ? 'Le jury parle' : 'Silence jury'}
          </span>
        </div>
      </div>

      {/* Transcript */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto rounded-lg border border-[var(--border-card)] bg-[var(--bg-main)] p-4 space-y-3">
        {transcript.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)] text-center py-8">
            Le jury attend votre début d'exposé…
          </p>
        ) : (
          transcript.map((turn, i) => (
            <div key={i} className={`text-sm ${turn.role === 'jury' ? 'pl-4 border-l-2 border-[var(--color-info-border)]' : ''}`}>
              <div className="text-xs uppercase tracking-wider text-[var(--text-muted)] mb-0.5">
                {turn.role === 'jury' ? 'Jury' : 'Candidat'}
              </div>
              <div className="text-[var(--text-primary)]">{turn.text}</div>
            </div>
          ))
        )}
      </div>

      {/* Controls */}
      <footer className="flex gap-3">
        <button
          type="button"
          onClick={rtc.toggleMute}
          disabled={rtc.state !== 'connected'}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[var(--border-card)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] disabled:opacity-50"
        >
          {rtc.isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          {rtc.isMuted ? 'Réactiver micro' : 'Couper micro'}
        </button>
        <div className="flex-1" />
        <button
          type="button"
          onClick={handleFinish}
          disabled={rtc.state === 'connecting'}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[var(--color-error)] text-white font-semibold hover:bg-[var(--color-error)] disabled:opacity-50"
        >
          <Square className="w-4 h-4" />
          Terminer la séance
        </button>
      </footer>
    </div>
  )
}

function formatMMSS(secs: number): string {
  const s = Math.max(0, Math.floor(secs))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
}

function ConnectionIndicator({ state }: { state: ReturnType<typeof useGrandOralWebRTC>['state'] }) {
  const label = state === 'connected' ? 'En direct' : state === 'connecting' ? 'Connexion…' : state === 'error' ? 'Erreur' : state === 'closed' ? 'Fermée' : 'Inactive'
  const dot = state === 'connected' ? 'bg-[var(--color-success)] animate-pulse' : state === 'connecting' ? 'bg-[var(--color-warning)] animate-pulse' : state === 'error' ? 'bg-[var(--color-error)]' : 'bg-[var(--border-card)]'
  return (
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full ${dot}`} />
      <span className="text-xs text-[var(--text-muted)]">{label}</span>
    </div>
  )
}
