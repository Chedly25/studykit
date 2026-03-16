import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Clock, BookOpen, CheckCircle } from 'lucide-react'
import type { StudySession } from '../../db/schema'

interface Props {
  sessions: StudySession[]
}

export function ActivityFeed({ sessions }: Props) {
  const { t, i18n } = useTranslation()

  const recent = [...sessions]
    .sort((a, b) => b.startTime.localeCompare(a.startTime))
    .slice(0, 5)

  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`
    const m = Math.floor(seconds / 60)
    return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`
  }

  const formatTime = (iso: string): string => {
    const d = new Date(iso)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMins = Math.floor(diffMs / 60000)

    if (diffMins < 1) return i18n.language === 'fr' ? "A l'instant" : 'Just now'
    if (diffMins < 60) return `${diffMins}m`
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h`
    return d.toLocaleDateString(i18n.language, { month: 'short', day: 'numeric' })
  }

  const typeIcon = (type: string) => {
    switch (type) {
      case 'pomodoro': return <Clock className="w-3.5 h-3.5" />
      case 'review': return <BookOpen className="w-3.5 h-3.5" />
      default: return <CheckCircle className="w-3.5 h-3.5" />
    }
  }

  if (recent.length === 0) {
    return (
      <div className="glass-card p-4">
        <h3 className="font-semibold text-[var(--text-heading)] mb-2">{t('dashboard.activityFeed')}</h3>
        <p className="text-sm text-[var(--text-muted)]">{t('dashboard.activityEmpty')}</p>
        <Link to="/focus" className="inline-block mt-2 text-sm text-[var(--accent-text)] hover:underline">
          {t('focus.startFocus')}
        </Link>
      </div>
    )
  }

  return (
    <div className="glass-card p-4">
      <h3 className="font-semibold text-[var(--text-heading)] mb-3">{t('dashboard.activityFeed')}</h3>
      <div className="space-y-2">
        {recent.map(s => (
          <div key={s.id} className="flex items-center gap-3 text-sm">
            <div className="text-[var(--accent-text)]">{typeIcon(s.type)}</div>
            <div className="flex-1">
              <span className="text-[var(--text-body)] capitalize">{s.type.replace('-', ' ')}</span>
              {s.durationSeconds > 0 && (
                <span className="text-[var(--text-muted)]"> &middot; {formatDuration(s.durationSeconds)}</span>
              )}
            </div>
            <span className="text-xs text-[var(--text-faint)]">{formatTime(s.startTime)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
