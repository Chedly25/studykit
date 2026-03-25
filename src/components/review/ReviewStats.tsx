/**
 * Stats bar showing article review counts.
 */
import { BarChart3, Star, HelpCircle, XCircle, Clock } from 'lucide-react'

interface Props {
  stats: {
    total: number
    shortlisted: number
    maybe: number
    rejected: number
    pending: number
  }
  targetCount?: number
}

export function ReviewStats({ stats, targetCount }: Props) {
  return (
    <div className="glass-card p-4">
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <div className="flex items-center gap-1.5">
          <BarChart3 size={14} className="text-[var(--accent-text)]" />
          <span className="font-medium text-[var(--text-heading)]">{stats.total}</span>
          <span className="text-[var(--text-muted)]">total</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Star size={14} className="text-[var(--color-success)]" />
          <span className="font-medium text-[var(--color-success)]">{stats.shortlisted}</span>
          <span className="text-[var(--text-muted)]">shortlisted</span>
          {targetCount !== undefined && (
            <span className="text-[var(--text-muted)]">/ {targetCount}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <HelpCircle size={14} className="text-[var(--color-warning)]" />
          <span className="font-medium text-[var(--color-warning)]">{stats.maybe}</span>
          <span className="text-[var(--text-muted)]">maybe</span>
        </div>
        <div className="flex items-center gap-1.5">
          <XCircle size={14} className="text-[var(--color-error)]" />
          <span className="font-medium text-[var(--color-error)]">{stats.rejected}</span>
          <span className="text-[var(--text-muted)]">rejected</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock size={14} className="text-[var(--text-muted)]" />
          <span className="font-medium text-[var(--text-muted)]">{stats.pending}</span>
          <span className="text-[var(--text-muted)]">pending</span>
        </div>
      </div>
    </div>
  )
}
