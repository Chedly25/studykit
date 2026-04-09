/**
 * Autopilot Card — dashboard component showing autopilot status,
 * toggle, budget usage, engagement insights, and activity log.
 */
import { useTranslation } from 'react-i18next'
import { Brain, Zap, ZapOff, Activity, AlertTriangle, TrendingUp, Clock } from 'lucide-react'
import { useAutopilot } from '../../hooks/useAutopilot'

interface Props {
  examProfileId: string
}

export default function AutopilotCard({ examProfileId }: Props) {
  const { t } = useTranslation()
  const {
    enabled, toggleAutopilot,
    budgetUsed, budgetLimit, budgetIsLow,
    engagement, loading,
  } = useAutopilot(examProfileId)

  if (loading) return null

  const budgetPercent = budgetLimit > 0 ? Math.min(100, Math.round((budgetUsed / budgetLimit) * 100)) : 0

  return (
    <div className="glass-card p-4">
      {/* Header + Toggle */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-[var(--accent)]" />
          <h3 className="text-sm font-semibold text-[var(--text-heading)]">
            {t('autopilot.title', 'Autopilot')}
          </h3>
        </div>
        <button
          onClick={() => toggleAutopilot(!enabled)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            enabled ? 'bg-[var(--accent)]' : 'bg-[var(--border-card)]'
          }`}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            enabled ? 'translate-x-6' : 'translate-x-1'
          }`} />
        </button>
      </div>

      {!enabled && (
        <p className="text-xs text-[var(--text-muted)]">
          {t('autopilot.disabledDesc', 'Activez l\'autopilot pour que le système gère automatiquement votre préparation : détection des lacunes, génération de contenu, et adaptation du plan.')}
        </p>
      )}

      {enabled && (
        <div className="space-y-3">
          {/* Budget bar */}
          <div>
            <div className="flex items-center justify-between text-xs text-[var(--text-muted)] mb-1">
              <span className="flex items-center gap-1">
                <Zap className="w-3 h-3" />
                {t('autopilot.budget', 'Budget IA')}
              </span>
              <span>{budgetUsed}/{budgetLimit}</span>
            </div>
            <div className="h-1.5 rounded-full bg-[var(--bg-card)] overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  budgetIsLow ? 'bg-amber-500' : 'bg-[var(--accent)]'
                }`}
                style={{ width: `${budgetPercent}%` }}
              />
            </div>
          </div>

          {/* Engagement insights */}
          {engagement && engagement.insights.length > 0 && (
            <div className="space-y-1.5">
              {engagement.insights.slice(0, 3).map((insight, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <span className="shrink-0 mt-0.5">
                    {insight.urgency === 'urgent' ? (
                      <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                    ) : insight.type === 'momentum' ? (
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                    ) : insight.type === 'optimal-window' ? (
                      <Clock className="w-3.5 h-3.5 text-blue-500" />
                    ) : (
                      <Activity className="w-3.5 h-3.5 text-amber-500" />
                    )}
                  </span>
                  <span className="text-[var(--text-body)]">{insight.message}</span>
                </div>
              ))}
            </div>
          )}

          {/* Status line */}
          <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
            {enabled ? (
              <Zap className="w-3 h-3 text-emerald-500" />
            ) : (
              <ZapOff className="w-3 h-3" />
            )}
            {engagement ? (
              <span>
                {t('autopilot.sessionTrend', 'Sessions')}: {engagement.sessionTrend === 'increasing' ? '↑' : engagement.sessionTrend === 'decreasing' ? '↓' : '→'}
                {' · '}
                {t('autopilot.avgSession', 'Moy')}: {engagement.avgSessionMinutes}min
              </span>
            ) : (
              <span>{t('autopilot.analyzing', 'Analyse en cours...')}</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
