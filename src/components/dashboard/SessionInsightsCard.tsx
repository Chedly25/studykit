import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Brain, ChevronDown, ChevronRight, AlertTriangle, HelpCircle } from 'lucide-react'
import type { SessionInsight } from '../../db/schema'

interface Props {
  insights: SessionInsight[]
}

function InsightItem({ insight }: { insight: SessionInsight }) {
  const [expanded, setExpanded] = useState(false)
  const { t, i18n } = useTranslation()
  const misconceptions: string[] = JSON.parse(insight.misconceptions || '[]')
  const openQuestions: string[] = JSON.parse(insight.openQuestions || '[]')
  const date = new Date(insight.timestamp).toLocaleDateString(i18n.language, { month: 'short', day: 'numeric' })

  return (
    <div className="border border-[var(--border-card)] rounded-lg p-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-start gap-2 text-left"
      >
        {expanded ? <ChevronDown className="w-4 h-4 mt-0.5 text-[var(--text-muted)]" /> : <ChevronRight className="w-4 h-4 mt-0.5 text-[var(--text-muted)]" />}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-[var(--text-body)] line-clamp-2">{insight.summary}</p>
          <span className="text-xs text-[var(--text-faint)]">{date}</span>
        </div>
      </button>
      {expanded && (
        <div className="mt-2 ml-6 space-y-2">
          {misconceptions.length > 0 && (
            <div>
              <div className="flex items-center gap-1 text-xs font-medium text-amber-500 mb-1">
                <AlertTriangle className="w-3 h-3" /> {t('dashboard.misconceptions')}
              </div>
              <ul className="text-xs text-[var(--text-muted)] space-y-0.5">
                {misconceptions.map((m, i) => <li key={i}>- {m}</li>)}
              </ul>
            </div>
          )}
          {openQuestions.length > 0 && (
            <div>
              <div className="flex items-center gap-1 text-xs font-medium text-blue-500 mb-1">
                <HelpCircle className="w-3 h-3" /> {t('dashboard.openQuestions')}
              </div>
              <ul className="text-xs text-[var(--text-muted)] space-y-0.5">
                {openQuestions.map((q, i) => <li key={i}>- {q}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function SessionInsightsCard({ insights }: Props) {
  const { t } = useTranslation()
  if (insights.length === 0) return null

  return (
    <div className="glass-card p-4">
      <h3 className="font-semibold text-[var(--text-heading)] mb-3 flex items-center gap-2">
        <Brain className="w-4 h-4 text-[var(--accent-text)]" /> {t('dashboard.sessionInsights')}
      </h3>
      <div className="space-y-2">
        {insights.slice(0, 3).map(insight => (
          <InsightItem key={insight.id} insight={insight} />
        ))}
      </div>
    </div>
  )
}
