/**
 * Overall readiness progress bar — shows avg mastery as a percentage.
 * At 0%: shows neutral "Just getting started" instead of alarming red.
 */
import { useTranslation } from 'react-i18next'

interface ReadinessBarProps {
  percent: number // 0-100
}

export function ReadinessBar({ percent }: ReadinessBarProps) {
  const { t } = useTranslation()
  const clamped = Math.max(0, Math.min(100, Math.round(percent)))
  const color = clamped >= 50
    ? 'bg-[var(--accent-text)]'
    : clamped >= 25
    ? 'bg-[var(--color-warning)]'
    : clamped > 0
    ? 'bg-[var(--color-warning)]'
    : 'bg-[var(--accent-text)]/30'

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2.5 rounded-full bg-[var(--bg-input)] overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
      <span key={clamped} className="text-sm font-semibold text-[var(--text-heading)] tabular-nums shrink-0 animate-count-up">
        {clamped === 0
          ? t('dashboard.readinessJustStarted', 'Just getting started')
          : t('dashboard.readiness', '{{percent}}% ready', { percent: clamped })
        }
      </span>
    </div>
  )
}
