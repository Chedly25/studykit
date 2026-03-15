import { useExamProfile } from '../hooks/useExamProfile'
import { useAnalytics } from '../hooks/useAnalytics'
import { BarChart3 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { CalibrationChart } from '../components/analytics/CalibrationChart'
import { ErrorPatternChart } from '../components/analytics/ErrorPatternChart'
import { computeCalibrationData } from '../lib/calibration'
import { computeErrorPatterns } from '../lib/errorPatterns'

export default function Analytics() {
  const { t, i18n } = useTranslation()
  const { activeProfile } = useExamProfile()
  const { weeklyHours, sessionDistribution, subjectBalance, scoreTrend, topics, subjects, questionResults } = useAnalytics(activeProfile?.id)

  if (!activeProfile) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <h1 className="text-2xl font-bold text-[var(--text-heading)] mb-4">{t('analytics.title')}</h1>
        <p className="text-[var(--text-muted)]">{t('analytics.noData')}</p>
        <a href="/exam-profile" className="btn-primary px-6 py-2.5 mt-4 inline-block">Create Profile</a>
      </div>
    )
  }

  const calibrationData = computeCalibrationData(topics, subjects)
  const errorPatterns = computeErrorPatterns(questionResults, topics)
  const maxHours = Math.max(...weeklyHours.map(d => d.hours), 1)

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 animate-fade-in">
      <h1 className="text-2xl font-bold text-[var(--text-heading)] mb-6">{t('analytics.title')}</h1>

      {/* Study Hours Chart */}
      <div className="glass-card p-4 mb-4">
        <h2 className="font-semibold text-[var(--text-heading)] mb-4 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-[var(--accent-text)]" /> {t('analytics.studyTime')}
        </h2>
        <div className="flex items-end gap-2 h-40">
          {weeklyHours.map(d => {
            const pct = maxHours > 0 ? (d.hours / maxHours) * 100 : 0
            const dayLabel = new Date(d.date + 'T12:00:00').toLocaleDateString(i18n.language, { weekday: 'short' })
            return (
              <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-xs text-[var(--text-muted)]">{d.hours.toFixed(1)}h</span>
                <div className="w-full rounded-t-md bg-[var(--accent-text)]/80 transition-all duration-300" style={{ height: `${Math.max(pct, 2)}%` }} />
                <span className="text-xs text-[var(--text-faint)]">{dayLabel}</span>
              </div>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Subject Balance */}
        <div className="glass-card p-4">
          <h2 className="font-semibold text-[var(--text-heading)] mb-3">Subject Balance</h2>
          {subjectBalance.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">{t('analytics.noData')}</p>
          ) : (
            <div className="space-y-3">
              {subjectBalance.map(s => (
                <div key={s.name}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-[var(--text-body)]">{s.name}</span>
                    <span className="text-[var(--text-muted)]">
                      {s.actual.toFixed(0)}% actual / {s.weight}% target
                    </span>
                  </div>
                  <div className="relative w-full h-2 rounded-full bg-[var(--border-card)] overflow-hidden">
                    <div
                      className="absolute h-full rounded-full opacity-80 transition-all"
                      style={{ width: `${Math.min(s.actual, 100)}%`, backgroundColor: s.color }}
                    />
                    <div
                      className="absolute h-full w-0.5 bg-[var(--text-heading)]"
                      style={{ left: `${Math.min(s.weight, 100)}%` }}
                      title={`Target: ${s.weight}%`}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Session Distribution */}
        <div className="glass-card p-4">
          <h2 className="font-semibold text-[var(--text-heading)] mb-3">Session Types</h2>
          {sessionDistribution.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">{t('analytics.noData')}</p>
          ) : (
            <div className="space-y-2">
              {sessionDistribution.map(s => (
                <div key={s.type} className="flex items-center justify-between text-sm">
                  <span className="text-[var(--text-body)] capitalize">{s.type.replace('-', ' ')}</span>
                  <span className="text-[var(--text-muted)]">{s.count} sessions &middot; {s.totalMinutes}m</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Score Trend */}
        <div className="glass-card p-4 md:col-span-2">
          <h2 className="font-semibold text-[var(--text-heading)] mb-3">Score Trend</h2>
          {scoreTrend.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">{t('analytics.noData')}</p>
          ) : (
            <div className="h-32 flex items-end gap-px">
              {scoreTrend.map((point, i) => (
                <div
                  key={i}
                  className="flex-1 bg-[var(--accent-text)]/60 rounded-t-sm transition-all"
                  style={{ height: `${point.score}%` }}
                  title={`${point.score.toFixed(0)}%`}
                />
              ))}
            </div>
          )}
        </div>

        {/* Confidence Calibration */}
        <div className="glass-card p-4 md:col-span-2">
          <h2 className="font-semibold text-[var(--text-heading)] mb-3">Confidence Calibration</h2>
          <CalibrationChart data={calibrationData} />
        </div>

        {/* Error Patterns */}
        <div className="glass-card p-4 md:col-span-2">
          <h2 className="font-semibold text-[var(--text-heading)] mb-3">Error Patterns</h2>
          <ErrorPatternChart data={errorPatterns} />
        </div>
      </div>
    </div>
  )
}
