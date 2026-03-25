import { useTranslation } from 'react-i18next'
import { Loader2, CheckCircle2, XCircle, Circle } from 'lucide-react'

export interface BatchUploadProgressState {
  total: number
  completed: number
  currentFile: string
  results: Array<{ fileName: string; status: 'done' | 'error'; error?: string }>
}

interface Props {
  progress: BatchUploadProgressState
}

export function BatchUploadProgress({ progress }: Props) {
  const { t } = useTranslation()
  const pending = progress.total - progress.completed - (progress.currentFile ? 1 : 0)

  return (
    <div className="glass-card p-4 mb-4 animate-fade-in">
      <div className="flex items-center gap-2 mb-3">
        <Loader2 className="w-4 h-4 text-[var(--accent-text)] animate-spin" />
        <span className="text-sm font-medium text-[var(--text-heading)]">
          {t('sources.batchUploading', { completed: progress.completed, total: progress.total })}
        </span>
      </div>
      <div className="space-y-1.5">
        {/* Completed files */}
        {progress.results.map((r, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            {r.status === 'done' ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-[var(--color-success)] flex-shrink-0" />
            ) : (
              <XCircle className="w-3.5 h-3.5 text-[var(--color-error)] flex-shrink-0" />
            )}
            <span className={r.status === 'error' ? 'text-[var(--color-error)]' : 'text-[var(--text-body)]'}>
              {r.fileName}
              {r.error && <span className="text-[var(--text-faint)]"> — {r.error}</span>}
            </span>
          </div>
        ))}
        {/* Current file */}
        {progress.currentFile && (
          <div className="flex items-center gap-2 text-xs">
            <Loader2 className="w-3.5 h-3.5 text-[var(--accent-text)] animate-spin flex-shrink-0" />
            <span className="text-[var(--text-body)]">{progress.currentFile}</span>
          </div>
        )}
        {/* Pending files indicator */}
        {pending > 0 && (
          <div className="flex items-center gap-2 text-xs text-[var(--text-faint)]">
            <Circle className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{pending} more pending...</span>
          </div>
        )}
      </div>
    </div>
  )
}
