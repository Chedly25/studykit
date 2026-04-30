/**
 * Feature demo player — full-screen overlay that hosts a scripted playback
 * through real-coach-shaped UI. Provides progress bar, pause/resume, restart,
 * skip-to-end, and a "Démarrer pour de vrai" exit handle.
 */
import { useEffect, type ReactNode } from 'react'
import { Pause, Play, RotateCcw, SkipForward, X, ArrowRight } from 'lucide-react'
import type { DemoControls } from './types'

interface FeatureDemoPlayerProps {
  /** Title shown in the top bar (e.g. "Démo · Syllogisme"). */
  title: string
  /** One-line subtitle (e.g. the example hook). */
  subtitle?: string
  /** Current narration caption (empty string hides the strip). */
  caption: string
  /** Controls returned by useDemoRunner. */
  controls: DemoControls
  /** The coach-specific demo body — driven by the runner's state. */
  children: ReactNode
  /** Close handler (used by the X button and Esc). */
  onClose: () => void
  /** Called when the user clicks "Démarrer pour de vrai" — typically closes
   *  the player and lets the user begin a real session. */
  onStartReal: () => void
}

export function FeatureDemoPlayer({
  title,
  subtitle,
  caption,
  controls,
  children,
  onClose,
  onStartReal,
}: FeatureDemoPlayerProps) {
  // Esc closes the player.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const progressPct = controls.totalMs > 0
    ? Math.min(100, Math.round((controls.elapsedMs / controls.totalMs) * 100))
    : 0

  const isFinished = controls.status === 'finished'
  const isPaused = controls.status === 'paused'

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="relative w-full max-w-5xl h-[90vh] flex flex-col rounded-2xl border border-[var(--border-card)] bg-[var(--bg-main)] shadow-2xl overflow-hidden animate-fade-in-up">
        {/* ─── Header ─────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-[var(--border-card)] bg-[var(--bg-card)]">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wider font-semibold text-[var(--accent-text)]">
              Démo
            </div>
            <div className="text-sm font-semibold text-[var(--text-heading)] truncate">
              {title}
            </div>
            {subtitle && (
              <div className="text-xs text-[var(--text-muted)] truncate">{subtitle}</div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-body)] hover:bg-[var(--bg-hover)] transition-colors"
            aria-label="Fermer la démo"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ─── Body — coach demo UI ───────────────────────────── */}
        <div className="flex-1 overflow-y-auto bg-[var(--bg-main)]">
          {children}
        </div>

        {/* ─── Footer — caption + progress + controls ─────────── */}
        <div className="border-t border-[var(--border-card)] bg-[var(--bg-card)]">
          {/* Caption strip — fades in/out */}
          <div className="px-5 pt-3 min-h-[2.25rem]">
            {caption && (
              <div
                key={caption}
                className="inline-block text-sm text-[var(--text-body)] leading-snug animate-fade-in"
              >
                {caption}
              </div>
            )}
          </div>

          {/* Progress bar */}
          <div className="px-5 pt-2">
            <div className="h-1 rounded-full bg-[var(--bg-input)] overflow-hidden">
              <div
                className="h-full rounded-full bg-[var(--accent-text)] transition-[width] duration-100"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          {/* Controls row */}
          <div className="flex items-center justify-between gap-3 px-5 py-3">
            <div className="flex items-center gap-1">
              {!isFinished && (
                <button
                  type="button"
                  onClick={isPaused ? controls.resume : controls.pause}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[var(--text-body)] hover:bg-[var(--bg-hover)] transition-colors"
                  aria-label={isPaused ? 'Reprendre la démo' : 'Mettre en pause'}
                >
                  {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                  <span>{isPaused ? 'Reprendre' : 'Pause'}</span>
                </button>
              )}
              <button
                type="button"
                onClick={controls.restart}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-body)] hover:bg-[var(--bg-hover)] transition-colors"
                aria-label="Recommencer la démo"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Recommencer</span>
              </button>
              {!isFinished && (
                <button
                  type="button"
                  onClick={controls.skipToEnd}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-body)] hover:bg-[var(--bg-hover)] transition-colors"
                  aria-label="Voir la fin"
                >
                  <SkipForward className="w-3.5 h-3.5" />
                  <span>Voir la fin</span>
                </button>
              )}
              <span className="text-[11px] text-[var(--text-faint)] tabular-nums ml-2">
                {Math.round(controls.elapsedMs / 1000)}s / {Math.round(controls.totalMs / 1000)}s
              </span>
            </div>

            <button
              type="button"
              onClick={onStartReal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--accent-bg)] text-[var(--accent-text)] hover:opacity-90 transition-opacity"
            >
              <span>Démarrer pour de vrai</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
