import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, CheckCircle, XCircle, Circle, SkipForward, Pencil } from 'lucide-react'
import type { WorkflowProgress } from '../../ai/orchestrator/types'

interface PracticeExamGeneratorProps {
  progress: WorkflowProgress | null
  error: string | null
  onCancel: () => void
}

const STEP_KEYS = [
  'practiceExam.steps.gatherContext',
  'practiceExam.steps.searchDocuments',
  'practiceExam.steps.searchWeb',
  'practiceExam.steps.generateQuestions',
  'practiceExam.steps.validateQuestions',
]

export function PracticeExamGenerator({ progress, error, onCancel }: PracticeExamGeneratorProps) {
  const { t } = useTranslation()
  const [elapsed, setElapsed] = useState(0)
  const stepStartRef = useRef(Date.now())

  // Reset elapsed timer when active step changes
  useEffect(() => {
    stepStartRef.current = Date.now()
    setElapsed(0)
  }, [progress?.currentStepIndex])

  // Tick elapsed timer every second while a step is running
  useEffect(() => {
    if (!progress || error) return
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - stepStartRef.current) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [progress, error])

  const getStepStatus = (i: number): 'pending' | 'running' | 'completed' | 'failed' | 'skipped' => {
    if (!progress) return i === 0 ? 'running' : 'pending'
    if (i < progress.currentStepIndex) return 'completed'
    if (i === progress.currentStepIndex) return error ? 'failed' : 'running'
    return 'pending'
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-12 animate-fade-in">
      <div className="glass-card p-8">
        <h2 className="text-xl font-bold text-[var(--text-heading)] mb-6 text-center">
          {t('practiceExam.generating')}
        </h2>

        <div className="space-y-3 mb-8">
          {STEP_KEYS.map((key, i) => {
            const status = getStepStatus(i)
            const isActive = status === 'running'

            return (
              <div key={i}>
                <div
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all ${
                    isActive ? 'bg-[var(--accent-bg)] border border-[var(--accent-text)]/20' : ''
                  }`}
                >
                  {status === 'running' && (
                    <Loader2 className="w-4 h-4 text-[var(--accent-text)] animate-spin shrink-0" />
                  )}
                  {status === 'completed' && (
                    <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                  )}
                  {status === 'failed' && (
                    <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                  )}
                  {status === 'skipped' && (
                    <SkipForward className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
                  )}
                  {status === 'pending' && (
                    <Circle className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
                  )}

                  <span className={`text-sm flex-1 ${
                    status === 'running' ? 'text-[var(--accent-text)] font-medium' :
                    status === 'completed' ? 'text-[var(--text-body)]' :
                    status === 'failed' ? 'text-red-500' :
                    'text-[var(--text-muted)]'
                  }`}>
                    {t(key)}
                  </span>

                  {/* Elapsed timer for active step */}
                  {isActive && elapsed > 0 && (
                    <span className="text-xs text-[var(--text-muted)] font-mono tabular-nums">
                      {elapsed}s
                    </span>
                  )}
                </div>

                {/* Streaming indicator for active LLM step */}
                {isActive && progress?.isStreaming && progress.streamedChars > 0 && (
                  <div className="flex items-center gap-2 px-4 pt-1.5 pb-0.5">
                    <Pencil className="w-3 h-3 text-[var(--accent-text)] animate-pulse shrink-0" />
                    <div className="flex-1 h-1.5 rounded-full bg-[var(--bg-input)] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[var(--accent-text)] transition-all duration-300"
                        style={{ width: `${Math.min(95, (progress.streamedChars / 80) )}%` }}
                      />
                    </div>
                    <span className="text-xs text-[var(--text-muted)]">
                      {t('practiceExam.writing')}
                    </span>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {error && (
          <div className="text-sm text-red-500 bg-red-500/10 rounded-lg p-3 mb-4">
            {error}
          </div>
        )}

        <button
          onClick={onCancel}
          className="btn-secondary px-4 py-2 w-full text-sm"
        >
          {t('common.cancel')}
        </button>
      </div>
    </div>
  )
}
