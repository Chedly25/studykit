import { useTranslation } from 'react-i18next'
import { Flame, Target, Calendar, Clock } from 'lucide-react'

interface StatusBarProps {
  streak: number
  freezeUsed: boolean
  readiness: number
  examDate?: string
  weeklyHours: number
  weeklyTarget: number
  daysUntilExam?: number
  milestoneProgress?: { done: number; total: number }
  isResearch: boolean
}

export function StatusBar({
  streak, readiness, examDate, weeklyHours, weeklyTarget,
  daysUntilExam, milestoneProgress, isResearch,
}: StatusBarProps) {
  const { t } = useTranslation()

  const readinessColor =
    readiness < 50 ? 'text-red-500' :
    readiness < 80 ? 'text-amber-500' :
    'text-emerald-500'

  const chips: Array<{ icon: React.ReactNode; value: string; label: string; className?: string }> = []

  // Streak
  chips.push({
    icon: <Flame size={16} className={streak > 0 ? 'text-orange-500' : 'text-[var(--text-faint)]'} />,
    value: `${streak}`,
    label: t('dashboard.streakDays', { count: streak }),
    className: streak > 0 ? 'text-orange-500' : undefined,
  })

  // Readiness
  chips.push({
    icon: <Target size={16} className={readinessColor} />,
    value: `${readiness}%`,
    label: t('dashboard.ready', 'ready'),
    className: readinessColor,
  })

  // Exam countdown or milestone progress
  if (!isResearch && examDate && daysUntilExam !== undefined) {
    chips.push({
      icon: <Calendar size={16} className="text-[var(--accent-text)]" />,
      value: `${daysUntilExam}`,
      label: t('dashboard.daysLeft', { count: daysUntilExam }),
    })
  } else if (milestoneProgress && milestoneProgress.total > 0) {
    chips.push({
      icon: <Calendar size={16} className="text-[var(--accent-text)]" />,
      value: `${milestoneProgress.done}/${milestoneProgress.total}`,
      label: 'milestones',
    })
  }

  // Weekly hours
  chips.push({
    icon: <Clock size={16} className="text-[var(--text-muted)]" />,
    value: `${weeklyHours.toFixed(1)}h`,
    label: `/ ${weeklyTarget}h ${t('dashboard.weeklyProgress', 'week')}`,
  })

  return (
    <div className="glass-card p-3 mb-4">
      <div className="flex items-center gap-4 flex-wrap sm:flex-nowrap justify-center sm:justify-start">
        {chips.map((chip, i) => (
          <div key={i} className="flex items-center gap-1.5 text-sm">
            {chip.icon}
            <span className={`font-bold ${chip.className ?? 'text-[var(--text-heading)]'}`}>
              {chip.value}
            </span>
            <span className="text-[var(--text-muted)] text-xs hidden sm:inline">{chip.label}</span>
            {i < chips.length - 1 && (
              <span className="text-[var(--border-card)] ml-2 hidden sm:inline">|</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
