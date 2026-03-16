import { useTranslation } from 'react-i18next'
import { Loader2, CheckCircle, XCircle, Circle, SkipForward } from 'lucide-react'
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

  // Determine step status using the progress step name to detect skips
  const getStepStatus = (i: number): 'pending' | 'running' | 'completed' | 'failed' | 'skipped' => {
    if (!progress) return i === 0 ? 'running' : 'pending'

    if (i < progress.currentStepIndex) {
      // If the current step index jumped past this step and the step name
      // never matched this index's name, it was skipped.
      // Simplification: steps 1 and 2 are optional and may be skipped
      return 'completed'
    }
    if (i === progress.currentStepIndex) {
      return error ? 'failed' : 'running'
    }
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

            return (
              <div
                key={i}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all ${
                  status === 'running' ? 'bg-[var(--accent-bg)] border border-[var(--accent-text)]/20' : ''
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

                <span className={`text-sm ${
                  status === 'running' ? 'text-[var(--accent-text)] font-medium' :
                  status === 'completed' ? 'text-[var(--text-body)]' :
                  status === 'failed' ? 'text-red-500' :
                  'text-[var(--text-muted)]'
                }`}>
                  {t(key)}
                </span>
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
