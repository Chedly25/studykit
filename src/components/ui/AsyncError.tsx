import { AlertTriangle, RefreshCw } from 'lucide-react'
import type { ReactNode } from 'react'

interface AsyncErrorProps {
  title?: string
  message?: string
  onRetry?: () => void
  retryLabel?: string
  compact?: boolean
  children?: ReactNode
  className?: string
}

export function AsyncError({
  title = 'Something went wrong',
  message = "We couldn't load this section. Try again in a moment.",
  onRetry,
  retryLabel = 'Try again',
  compact = false,
  children,
  className = '',
}: AsyncErrorProps) {
  return (
    <div
      role="alert"
      className={`glass-card flex flex-col items-center justify-center text-center ${
        compact ? 'py-6 px-4' : 'py-12 px-6'
      } ${className}`}
    >
      <div
        className={`rounded-full bg-[var(--color-error-bg)] flex items-center justify-center ${
          compact ? 'w-9 h-9 mb-3' : 'w-12 h-12 mb-4'
        }`}
      >
        <AlertTriangle
          className={`text-[var(--color-error)] ${compact ? 'w-5 h-5' : 'w-6 h-6'}`}
          aria-hidden="true"
        />
      </div>
      <h3
        className={`font-[family-name:var(--font-display)] font-semibold text-[var(--text-heading)] ${
          compact ? 'text-base' : 'text-xl'
        }`}
      >
        {title}
      </h3>
      <p
        className={`text-[var(--text-muted)] mt-1 ${
          compact ? 'text-xs max-w-xs' : 'text-sm max-w-md'
        }`}
      >
        {message}
      </p>
      {children && <div className="mt-3">{children}</div>}
      {onRetry && (
        <button
          onClick={onRetry}
          className={`btn-secondary inline-flex items-center gap-2 ${
            compact ? 'mt-3 btn-sm' : 'mt-5'
          }`}
        >
          <RefreshCw className={compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
          {retryLabel}
        </button>
      )}
    </div>
  )
}
