/**
 * Dashboard card surfacing proactive intelligence signals.
 * Shows calibration gaps, exercise gaps, mastery decay, error patterns.
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, TrendingDown, Target, Brain, BookOpen, ChevronDown, ChevronUp, ArrowRight } from 'lucide-react'
import type { IntelligenceSignal } from '../../hooks/useIntelligence'

const TYPE_ICONS: Record<IntelligenceSignal['type'], typeof AlertTriangle> = {
  'exercise-gap': Target,
  'mastery-decay': TrendingDown,
  'calibration': AlertTriangle,
  'error-pattern': Brain,
  'source-gap': BookOpen,
}

const SEVERITY_COLORS: Record<IntelligenceSignal['severity'], string> = {
  high: 'text-red-500 bg-red-500/10',
  medium: 'text-amber-500 bg-amber-500/10',
  low: 'text-blue-500 bg-blue-500/10',
}

interface Props {
  signals: IntelligenceSignal[]
}

export function AttentionCard({ signals }: Props) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)

  if (signals.length === 0) return null

  const visible = expanded ? signals : signals.slice(0, 3)

  return (
    <div className="glass-card p-4 mb-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">
        {t('dashboard.attention')}
      </p>

      <div className="space-y-2">
        {visible.map((signal, i) => {
          const Icon = TYPE_ICONS[signal.type]
          const colorClass = SEVERITY_COLORS[signal.severity]

          return (
            <Link
              key={`${signal.type}-${i}`}
              to={signal.actionLink}
              className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-[var(--bg-input)] transition-colors group"
            >
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${colorClass}`}>
                <Icon className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-[var(--text-heading)] truncate">
                  {signal.title}
                </div>
                <div className="text-xs text-[var(--text-muted)] line-clamp-1 mt-0.5">
                  {signal.description}
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-[var(--text-faint)] group-hover:text-[var(--accent-text)] transition-colors shrink-0 mt-1" />
            </Link>
          )
        })}
      </div>

      {signals.length > 3 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 mt-2 text-xs text-[var(--text-muted)] hover:text-[var(--accent-text)] transition-colors mx-auto"
        >
          {expanded ? (
            <>Show less <ChevronUp className="w-3 h-3" /></>
          ) : (
            <>{signals.length - 3} more <ChevronDown className="w-3 h-3" /></>
          )}
        </button>
      )}
    </div>
  )
}
