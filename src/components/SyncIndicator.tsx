/**
 * Small header icon showing cloud sync status.
 * Hidden when sync is disabled or user is free tier.
 */
import { Cloud, CloudOff, Loader2, AlertCircle, Check } from 'lucide-react'
import { useCloudSync } from '../hooks/useCloudSync'

export function SyncIndicator() {
  const { status, lastSyncedAt, sync } = useCloudSync()

  if (status === 'disabled') return null

  const iconMap = {
    idle: <Cloud size={18} className="text-[var(--text-muted)]" />,
    syncing: <Loader2 size={18} className="text-[var(--accent-text)] animate-spin" />,
    synced: <Check size={14} className="text-emerald-500" />,
    error: <AlertCircle size={18} className="text-amber-500" />,
    offline: <CloudOff size={18} className="text-[var(--text-muted)]" />,
  }

  const titleMap = {
    idle: 'Cloud sync enabled',
    syncing: 'Syncing...',
    synced: lastSyncedAt ? `Synced ${formatRelative(lastSyncedAt)}` : 'Synced',
    error: 'Sync error — click to retry',
    offline: 'Offline — will sync when connected',
  }

  return (
    <button
      onClick={() => { if (status === 'error' || status === 'idle') sync() }}
      className={`p-2 rounded-lg transition-colors ${
        status === 'synced'
          ? 'text-emerald-500'
          : 'text-[var(--text-muted)] hover:text-[var(--accent-text)] hover:bg-[var(--bg-input)]'
      }`}
      title={titleMap[status]}
    >
      {status === 'synced' ? (
        <div className="relative">
          <Cloud size={18} className="text-emerald-500" />
          <Check size={8} className="absolute -bottom-0.5 -right-0.5 text-emerald-500" strokeWidth={3} />
        </div>
      ) : (
        iconMap[status]
      )}
    </button>
  )
}

function formatRelative(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}
