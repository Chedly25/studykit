import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Flame, Snowflake, ChevronDown, ChevronUp } from 'lucide-react'
import type { DailyStudyLog } from '../../db/schema'
import { CalendarHeatmap } from './CalendarHeatmap'

const MILESTONES: Record<number, string> = {
  7: '1 Week!',
  14: '2 Weeks!',
  30: '1 Month!',
  60: '2 Months!',
  100: '100 Days!',
}

interface Props {
  streak: number
  weeklyHours: number
  weeklyTarget: number
  freezeUsed?: boolean
  dailyLogs?: DailyStudyLog[]
}

export function StudyStreakCard({ streak, weeklyHours, weeklyTarget, freezeUsed, dailyLogs }: Props) {
  const { t } = useTranslation()
  const targetPct = weeklyTarget > 0 ? Math.min(100, Math.round((weeklyHours / weeklyTarget) * 100)) : 0
  const milestone = MILESTONES[streak] ?? null
  const [showHeatmap, setShowHeatmap] = useState(false)

  return (
    <div className="glass-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Flame className={`w-4 h-4 ${streak > 0 ? 'text-[var(--color-warning)]' : 'text-[var(--text-muted)]'} ${milestone ? 'animate-pulse' : ''}`} />
        <h3 className="font-semibold text-[var(--text-heading)]">{t('dashboard.streak')}</h3>
        {freezeUsed && (
          <span className="flex items-center gap-0.5 text-xs text-[var(--color-info)]" title="Streak freeze used (1 day gap forgiven)">
            <Snowflake className="w-3 h-3" /> Freeze
          </span>
        )}
      </div>
      <div className="text-3xl font-bold text-[var(--text-heading)]">
        {streak}
        <span className="text-base font-normal text-[var(--text-muted)]"> {t('dashboard.streakDays', { count: streak })}</span>
      </div>
      {milestone && (
        <div className="mt-1.5 inline-block text-xs font-bold text-[var(--color-warning)] bg-[var(--color-warning-bg)] px-2.5 py-1 rounded-full">
          {milestone}
        </div>
      )}
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

      {/* Calendar heatmap (collapsible) */}
      {dailyLogs && dailyLogs.length > 0 && (
        <>
          <button
            onClick={() => setShowHeatmap(!showHeatmap)}
            className="flex items-center gap-1 mt-3 text-xs text-[var(--text-muted)] hover:text-[var(--accent-text)] transition-colors"
          >
            {showHeatmap ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            Activity history
          </button>
          {showHeatmap && <CalendarHeatmap dailyLogs={dailyLogs} />}
        </>
      )}
    </div>
  )
}
