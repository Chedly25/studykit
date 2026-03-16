import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Flame } from 'lucide-react'

interface Props {
  streak: number
  weeklyHours: number
  weeklyTarget: number
}

export function StudyStreakCard({ streak, weeklyHours, weeklyTarget }: Props) {
  const { t } = useTranslation()
  const targetPct = weeklyTarget > 0 ? Math.min(100, Math.round((weeklyHours / weeklyTarget) * 100)) : 0

  return (
    <div className="glass-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Flame className={`w-4 h-4 ${streak > 0 ? 'text-orange-500' : 'text-[var(--text-muted)]'}`} />
        <h3 className="font-semibold text-[var(--text-heading)]">{t('dashboard.streak')}</h3>
      </div>
      <div className="text-3xl font-bold text-[var(--text-heading)]">
        {streak}
        <span className="text-base font-normal text-[var(--text-muted)]"> {t('dashboard.streakDays', { count: streak })}</span>
      </div>
      {streak === 0 && (
        <Link to="/focus" className="inline-block mt-2 text-sm text-[var(--accent-text)] hover:underline">
          {t('dashboard.streakStartPrompt')}
        </Link>
      )}
      <div className="mt-3">
        <div className="flex justify-between text-xs text-[var(--text-muted)] mb-1">
          <span>{t('dashboard.weeklyProgress')}</span>
          <span>{t('dashboard.hoursStudied', { hours: weeklyHours })} / {t('dashboard.hoursTarget', { hours: weeklyTarget })}</span>
        </div>
        <div className="w-full h-2 rounded-full bg-[var(--border-card)] overflow-hidden">
          <div
            className="h-full rounded-full bg-[var(--accent-text)] transition-all duration-300"
            style={{ width: `${targetPct}%` }}
          />
        </div>
      </div>
    </div>
  )
}
