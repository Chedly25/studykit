/**
 * Morning Briefing Banner — shown at top of daily queue page.
 * Displays readiness score, focus recommendation, and top actions.
 * Dismissible per day.
 */
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Brain, X, ArrowRight, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import type { MorningBriefing } from '../../ai/agents/autopilot/types'

interface Props {
  briefing: MorningBriefing
  onDismiss: () => void
}

export default function MorningBriefingBanner({ briefing, onDismiss }: Props) {
  const { t } = useTranslation()

  if (briefing.dismissed) return null

  const trendIcon = {
    improving: <TrendingUp className="w-4 h-4 text-emerald-500" />,
    stable: <Minus className="w-4 h-4 text-amber-500" />,
    declining: <TrendingDown className="w-4 h-4 text-red-500" />,
  }[briefing.readinessTrend]

  return (
    <div className="glass-card p-4 mb-4 border-l-4 border-[var(--accent)] animate-fade-in relative">
      <button
        onClick={onDismiss}
        className="absolute top-3 right-3 p-1 rounded-lg hover:bg-[var(--bg-card-hover)] transition-colors"
        aria-label={t('dismiss', 'Dismiss')}
      >
        <X className="w-4 h-4 text-[var(--text-muted)]" />
      </button>

      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-[var(--accent)]/10 shrink-0">
          <Brain className="w-5 h-5 text-[var(--accent)]" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-semibold text-[var(--text-heading)]">
              {t('autopilot.briefingTitle', 'Briefing du jour')}
            </h3>
            <span className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
              {trendIcon}
              {briefing.readinessScore}%
            </span>
            {briefing.daysUntilExam !== null && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--bg-card)] text-[var(--text-muted)]">
                J-{briefing.daysUntilExam}
              </span>
            )}
          </div>

          <p className="text-sm text-[var(--text-body)] mb-2">
            {briefing.focusRecommendation}
          </p>

          {briefing.topActions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {briefing.topActions.map((action, i) => (
                <Link
                  key={i}
                  to={action.route}
                  className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] text-[var(--text-body)] transition-colors"
                >
                  <span className={
                    action.priority === 'critical' ? 'text-red-500' :
                    action.priority === 'high' ? 'text-amber-500' : 'text-[var(--text-muted)]'
                  }>
                    {action.priority === 'critical' ? '!!' : action.priority === 'high' ? '!' : ''}
                  </span>
                  {action.action}
                  <ArrowRight className="w-3 h-3" />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
