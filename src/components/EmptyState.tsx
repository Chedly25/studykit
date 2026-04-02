/**
 * Reusable empty state component — consistent icon + title + subtitle + CTA pattern.
 * Use `compact` for inline sections inside glass-cards, full mode for page-level empty states.
 */
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

interface EmptyStateAction {
  icon?: ReactNode
  label: string
  to?: string
  onClick?: () => void
}

interface EmptyStateProps {
  icon: React.ComponentType<{ className?: string }>
  title: string
  subtitle?: string
  actions?: EmptyStateAction[]
  compact?: boolean
}

export function EmptyState({ icon: Icon, title, subtitle, actions, compact }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center ${compact ? 'py-6 px-3' : 'py-16 px-4'}`}>
      <div className={`rounded-2xl bg-[var(--accent-bg)] flex items-center justify-center ${compact ? 'w-8 h-8 mb-3' : 'w-12 h-12 mb-5'}`}>
        <Icon className={`text-[var(--accent-text)] ${compact ? 'w-4.5 h-4.5' : 'w-7 h-7'}`} />
      </div>
      <h3 className={`font-[family-name:var(--font-display)] font-bold text-[var(--text-heading)] text-center ${compact ? 'text-base' : 'text-2xl'}`}>
        {title}
      </h3>
      {subtitle && (
        <p className={`text-[var(--text-muted)] text-center mt-1 ${compact ? 'text-xs max-w-xs' : 'text-sm max-w-md'}`}>
          {subtitle}
        </p>
      )}
      {actions && actions.length > 0 && (
        <div className={`flex flex-wrap gap-2 justify-center ${compact ? 'mt-3' : 'mt-6'}`}>
          {actions.map((action, i) => {
            const className = `${i === 0 ? 'btn-primary' : 'btn-secondary'} ${compact ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'} inline-flex items-center gap-1.5`
            if (action.to) {
              return (
                <Link key={i} to={action.to} className={className}>
                  {action.icon}
                  {action.label}
                </Link>
              )
            }
            return (
              <button key={i} onClick={action.onClick} className={className}>
                {action.icon}
                {action.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
