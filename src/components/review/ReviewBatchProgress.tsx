/**
 * Per-article progress grid during batch processing.
 */
import { CheckCircle2, XCircle, Loader2, Circle } from 'lucide-react'
import type { BatchProgress, ItemStatus } from '../../ai/orchestrator/parallelBatch'

interface Props {
  progress: BatchProgress | null
  onCancel: () => void
  isRunning: boolean
}

function StatusIcon({ status }: { status: ItemStatus }) {
  switch (status) {
    case 'completed': return <CheckCircle2 size={16} className="text-[var(--color-success)]" />
    case 'failed': return <XCircle size={16} className="text-[var(--color-error)]" />
    case 'running': return <Loader2 size={16} className="text-[var(--accent-text)] animate-spin" />
    default: return <Circle size={16} className="text-[var(--text-muted)]" />
  }
}

export function ReviewBatchProgress({ progress, onCancel, isRunning }: Props) {
  if (!progress) return null

  // completedItems already includes failedItems (see parallelBatch.ts)
  const percent = progress.totalItems > 0
    ? Math.round((progress.completedItems / progress.totalItems) * 100)
    : 0

  const elapsed = Math.round(progress.elapsedMs / 1000)
  const minutes = Math.floor(elapsed / 60)
  const seconds = elapsed % 60

  return (
    <div className="glass-card p-6 animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-[var(--text-heading)]">
          Processing Articles
        </h3>
        <div className="flex items-center gap-3">
          <span className="text-sm text-[var(--text-muted)]">
            {minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`}
          </span>
          {isRunning && (
            <button onClick={onCancel} className="btn-secondary text-xs px-3 py-1">
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Overall progress bar */}
      <div className="mb-4">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-[var(--text-body)]">
            {progress.completedItems} / {progress.totalItems} complete
          </span>
          <span className="text-[var(--text-muted)]">{percent}%</span>
        </div>
        <div className="h-2 rounded-full bg-[var(--bg-input)] overflow-hidden">
          <div
            className="h-full rounded-full bg-[var(--accent-text)] transition-all duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      {/* Stats row */}
      <div className="flex gap-4 mb-4 text-sm">
        <span className="text-[var(--color-success)]">
          {progress.completedItems - progress.failedItems} done
        </span>
        {progress.failedItems > 0 && (
          <span className="text-[var(--color-error)]">
            {progress.failedItems} failed
          </span>
        )}
        <span className="text-[var(--accent-text)]">
          {progress.runningItems} running
        </span>
        <span className="text-[var(--text-muted)]">
          {progress.totalItems - progress.completedItems - progress.runningItems} queued
        </span>
      </div>

      {/* Per-article grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-80 overflow-y-auto">
        {[...progress.items.entries()].map(([id, state]) => (
          <div
            key={id}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
              state.status === 'running'
                ? 'bg-[var(--accent-bg)] border border-[var(--accent-text)]/20'
                : 'bg-[var(--bg-input)]'
            }`}
          >
            <StatusIcon status={state.status} />
            <span className="truncate flex-1 text-[var(--text-body)]">
              {id.slice(0, 8)}...
            </span>
            {state.workflowProgress && state.status === 'running' && (
              <span className="text-xs text-[var(--text-muted)]">
                {state.workflowProgress.currentStepName}
              </span>
            )}
            {state.error && (
              <span className="text-xs text-[var(--color-error)] truncate max-w-32" title={state.error}>
                {state.error}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
