import { FileText, X, Loader2, AlertCircle } from 'lucide-react'

interface Props {
  name: string
  status: 'pending' | 'parsing' | 'ready' | 'error'
  onRemove: () => void
}

export function AttachmentChip({ name, status, onRemove }: Props) {
  const truncated = name.length > 24 ? name.slice(0, 21) + '...' : name

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${
        status === 'error'
          ? 'bg-[var(--color-error-bg)] text-[var(--color-error)] border border-[var(--color-error-border)]'
          : 'bg-[var(--accent-bg)] text-[var(--accent-text)] border border-[var(--border-card)]'
      }`}
    >
      {status === 'parsing' ? (
        <Loader2 className="w-3 h-3 animate-spin flex-shrink-0" />
      ) : status === 'error' ? (
        <AlertCircle className="w-3 h-3 flex-shrink-0" />
      ) : (
        <FileText className="w-3 h-3 flex-shrink-0" />
      )}
      <span className="truncate max-w-[140px]">{truncated}</span>
      {status === 'parsing' && (
        <span className="text-[var(--text-faint)]">parsing...</span>
      )}
      <button
        onClick={onRemove}
        className="ml-0.5 p-0.5 rounded-full hover:bg-[var(--bg-input)] transition-colors"
      >
        <X className="w-3 h-3" />
      </button>
    </span>
  )
}
