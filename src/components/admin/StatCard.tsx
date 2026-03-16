import type { LucideIcon } from 'lucide-react'

interface StatCardProps {
  icon: LucideIcon
  label: string
  value: string | number
  delta?: string
  deltaType?: 'positive' | 'negative' | 'neutral'
}

export function StatCard({ icon: Icon, label, value, delta, deltaType = 'neutral' }: StatCardProps) {
  const deltaColor =
    deltaType === 'positive'
      ? 'text-green-500'
      : deltaType === 'negative'
        ? 'text-red-500'
        : 'text-[var(--text-muted)]'

  return (
    <div className="glass-card p-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 rounded-lg bg-[var(--accent-bg)]">
          <Icon size={18} className="text-[var(--accent-text)]" />
        </div>
        <span className="text-sm text-[var(--text-muted)]">{label}</span>
      </div>
      <div className="flex items-end gap-2">
        <span className="text-2xl font-bold text-[var(--text-heading)]">{value}</span>
        {delta && (
          <span className={`text-xs font-medium ${deltaColor} mb-1`}>{delta}</span>
        )}
      </div>
    </div>
  )
}
