/**
 * Step progress UI for source processing — follows PracticeExamGenerator pattern.
 */
import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, CheckCircle, XCircle, Circle, Pencil } from 'lucide-react'
import type { WorkflowProgress } from '../../ai/orchestrator/types'

interface SourceProcessingBannerProps {
  progress: WorkflowProgress | null
  error: string | null
  onCancel: () => void
}

const STEP_NAMES = [
  'sources.processing.gatherContext',
  'sources.processing.embedChunks',
  'sources.processing.extractConcepts',
  'sources.processing.generateFlashcards',
  'sources.processing.saveResults',
]

export function SourceProcessingBanner({ progress, error, onCancel }: SourceProcessingBannerProps) {
  const { t } = useTranslation()
  const [elapsed, setElapsed] = useState(0)
  const stepStartRef = useRef(Date.now())

  useEffect(() => {
    stepStartRef.current = Date.now()
    setElapsed(0)
  }, [progress?.currentStepIndex])

  useEffect(() => {
    if (!progress || error) return
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - stepStartRef.current) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [progress, error])

  const getStepStatus = (i: number): 'pending' | 'running' | 'completed' | 'failed' => {
    if (!progress) return i === 0 ? 'running' : 'pending'
    if (i < progress.currentStepIndex) return 'completed'
    if (i === progress.currentStepIndex) return error ? 'failed' : 'running'
    return 'pending'
  }

  return (
    <div className="glass-card p-6 mb-4 animate-fade-in">
      <h3 className="text-lg font-semibold text-[var(--text-heading)] mb-4">
        {t('sources.processing.title')}
      </h3>

      <div className="space-y-2 mb-4">
        {STEP_NAMES.map((key, i) => {
          const status = getStepStatus(i)
          const isActive = status === 'running'

          return (
            <div key={i}>
              <div className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${
                isActive ? 'bg-[var(--accent-bg)] border border-[var(--accent-text)]/20' : ''
              }`}>
                {status === 'running' && <Loader2 className="w-4 h-4 text-[var(--accent-text)] animate-spin shrink-0" />}
                {status === 'completed' && <CheckCircle className="w-4 h-4 text-[var(--color-success)] shrink-0" />}
                {status === 'failed' && <XCircle className="w-4 h-4 text-[var(--color-error)] shrink-0" />}
                {status === 'pending' && <Circle className="w-4 h-4 text-[var(--text-muted)] shrink-0" />}

                <span className={`text-sm flex-1 ${
                  status === 'running' ? 'text-[var(--accent-text)] font-medium' :
                  status === 'completed' ? 'text-[var(--text-body)]' :
                  status === 'failed' ? 'text-[var(--color-error)]' :
                  'text-[var(--text-muted)]'
                }`}>
                  {t(key)}
                </span>

                {isActive && elapsed > 0 && (
                  <span className="text-xs text-[var(--text-muted)] font-mono tabular-nums">{elapsed}s</span>
                )}
              </div>

              {isActive && progress?.isStreaming && progress.streamedChars > 0 && (
                <div className="flex items-center gap-2 px-3 pt-1">
                  <Pencil className="w-3 h-3 text-[var(--accent-text)] animate-pulse shrink-0" />
                  <div className="flex-1 h-1.5 rounded-full bg-[var(--bg-input)] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[var(--accent-text)] transition-all duration-300"
                      style={{ width: `${Math.min(95, (progress.streamedChars / 80))}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {error && (
        <div className="text-sm text-[var(--color-error)] bg-[var(--color-error-bg)] rounded-lg p-3 mb-3">{error}</div>
      )}

      <button onClick={onCancel} className="btn-secondary px-4 py-1.5 text-sm w-full">
        {t('common.cancel')}
      </button>
    </div>
  )
}
