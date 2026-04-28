import { FileText, AlertTriangle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { CoverageSummary } from '../../lib/sourceCoverage'

interface Props {
  coverage: CoverageSummary
}

export function SourceCoverageChart({ coverage }: Props) {
  const { t } = useTranslation()

  return (
    <div className="glass-card p-4">
      <h3 className="font-semibold text-[var(--text-heading)] mb-3 flex items-center gap-2">
        <FileText className="w-4 h-4 text-[var(--accent-text)]" /> {t('sources.coverage')}
      </h3>

      {/* Overall bar */}
      <div className="mb-4">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-[var(--text-body)]">Overall Coverage</span>
          <span className="font-medium text-[var(--accent-text)]">{coverage.coveragePercent}%</span>
        </div>
        <div className="w-full h-3 rounded-full bg-[var(--border-card)] overflow-hidden">
          <div
            className="h-full rounded-full bg-[var(--accent-text)] transition-all duration-500"
            style={{ width: `${coverage.coveragePercent}%` }}
          />
        </div>
        <p className="text-xs text-[var(--text-faint)] mt-1">
          {t('sources.coveredTopics', { count: coverage.coveredTopics })} / {coverage.totalTopics}
        </p>
      </div>

      {/* Subject breakdown */}
      <div className="space-y-2 mb-4">
        {coverage.subjectBreakdown.map(s => (
          <div key={s.subjectName}>
            <div className="flex justify-between text-xs mb-0.5">
              <span className="text-[var(--text-muted)]">{s.subjectName}</span>
              <span className="text-[var(--text-faint)]">{s.coveredTopics}/{s.totalTopics}</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-[var(--border-card)] overflow-hidden">
              <div
                className="h-full rounded-full bg-[var(--accent-text)]/70 transition-all"
                style={{ width: `${s.coveragePercent}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Uncovered high-priority */}
      {coverage.uncoveredHighPriority.length > 0 && (
        <div>
          <div className="flex items-center gap-1 text-xs font-medium text-[var(--color-warning)] mb-2">
            <AlertTriangle className="w-3 h-3" /> Needs Source Material
          </div>
          <div className="space-y-1">
            {coverage.uncoveredHighPriority.map(t => (
              <div key={t.topicName} className="text-xs text-[var(--text-muted)] flex justify-between">
                <span>{t.topicName}</span>
                <span className="text-[var(--text-faint)]">{t.mastery}% mastery</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
