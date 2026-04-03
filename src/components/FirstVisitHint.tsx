/**
 * Dismissible first-visit hint card — shows once per profile per page.
 * Uses localStorage for permanent dismissal.
 */
import { useState } from 'react'
import { X } from 'lucide-react'

interface Props {
  hintKey: string
  profileId: string
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
}

function isSeen(hintKey: string, profileId: string): boolean {
  try { return localStorage.getItem(`hint_seen_${hintKey}_${profileId}`) === 'true' } catch { return false }
}

export function FirstVisitHint({ hintKey, profileId, icon: Icon, title, description }: Props) {
  const [dismissed, setDismissed] = useState(() => isSeen(hintKey, profileId))

  if (dismissed) return null

  const handleDismiss = () => {
    try { localStorage.setItem(`hint_seen_${hintKey}_${profileId}`, 'true') } catch { /* noop */ }
    setDismissed(true)
  }

  return (
    <div className="glass-card p-4 mb-4 animate-fade-in-up flex items-start gap-3">
      <div className="w-8 h-8 rounded-lg bg-[var(--accent-bg)] flex items-center justify-center shrink-0 mt-0.5">
        <Icon className="w-4 h-4 text-[var(--accent-text)]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[var(--text-heading)]">{title}</p>
        <p className="text-xs text-[var(--text-muted)] mt-0.5 leading-relaxed">{description}</p>
      </div>
      <button
        onClick={handleDismiss}
        className="p-1 text-[var(--text-muted)] hover:text-[var(--text-body)] shrink-0"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
