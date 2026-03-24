/**
 * Intelligence Brief on the Dashboard — surfaces agent insights proactively.
 * Reads diagnostician priorities + readiness, and progress monitor alerts.
 * Data comes from db.agentInsights (populated by agents on app-open).
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { Brain, ChevronDown, ChevronUp, ArrowRight, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { db } from '../../db'
import type { DiagnosticPriority } from '../../ai/agents/diagnostician'

interface Props {
  examProfileId: string
}

interface DiagnosticReport {
  timestamp: string
  priorities: DiagnosticPriority[]
  patterns: Array<{ type: string; description: string; topicIds: string[] }>
  readiness: { score: number; trend: 'improving' | 'stable' | 'declining'; riskAreas: string[] }
  narrative?: string
  narrativeGeneratedAt?: string
}

interface ProgressInsight {
  type: string
  urgency: 'info' | 'attention' | 'urgent'
  title: string
  message: string
  surface: string
  action?: { label: string; route: string }
}

export function DashboardIntelligenceBrief({ examProfileId }: Props) {
  const { t } = useTranslation()
  const today = new Date().toISOString().slice(0, 10)
  const storageKey = `brief_collapsed_${examProfileId}_${today}`

  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(storageKey) === 'true' } catch { return false }
  })

  // Diagnostician report (priorities + readiness)
  const report = useLiveQuery(async () => {
    const insight = await db.agentInsights.get(`diagnostician:${examProfileId}`)
    if (!insight) return null
    try { return JSON.parse(insight.data) as DiagnosticReport } catch { return null }
  }, [examProfileId]) ?? null

  // Progress monitor insights
  const progressInsights = useLiveQuery(async () => {
    const insight = await db.agentInsights.get(`progress-monitor:${examProfileId}`)
    if (!insight) return []
    try { return JSON.parse(insight.data) as ProgressInsight[] } catch { return [] }
  }, [examProfileId]) ?? []

  // Nothing to show yet — agents haven't run
  if (!report && progressInsights.length === 0) return null

  const priorities = (report?.priorities ?? [])
    .sort((a, b) => {
      const order = { critical: 0, high: 1, medium: 2, low: 3 }
      return (order[a.urgency] ?? 3) - (order[b.urgency] ?? 3)
    })
    .slice(0, 3)

  const urgentInsight = progressInsights.find(i => i.urgency === 'urgent' || i.urgency === 'attention')
  const readiness = report?.readiness

  const handleCollapse = () => {
    setCollapsed(true)
    try { localStorage.setItem(storageKey, 'true') } catch {}
  }

  const handleExpand = () => {
    setCollapsed(false)
    try { localStorage.removeItem(storageKey) } catch {}
  }

  if (collapsed) {
    return (
      <button
        onClick={handleExpand}
        className="w-full glass-card p-3 mb-4 flex items-center justify-between text-left animate-fade-in"
      >
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-[var(--accent-text)]" />
          <span className="text-sm text-[var(--text-body)]">{t('dashboard.briefTitle', 'Intelligence Brief')}</span>
          {readiness && (
            <span className="text-xs font-bold text-[var(--accent-text)]">{Math.round(readiness.score * 100)}%</span>
          )}
        </div>
        <ChevronDown className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
      </button>
    )
  }

  return (
    <div className="glass-card p-4 mb-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-[var(--accent-text)]" />
          <span className="text-sm font-semibold text-[var(--text-heading)]">{t('dashboard.briefTitle', 'Intelligence Brief')}</span>
        </div>
        <button onClick={handleCollapse} className="p-1 text-[var(--text-muted)] hover:text-[var(--text-body)]">
          <ChevronUp className="w-4 h-4" />
        </button>
      </div>

      {/* Readiness score + trend */}
      {readiness && (
        <div className="flex items-center gap-3 mb-3 px-3 py-2 rounded-lg bg-[var(--bg-input)]">
          <div>
            <span className="text-2xl font-bold text-[var(--text-heading)]">{Math.round(readiness.score * 100)}%</span>
            <span className="text-xs text-[var(--text-muted)] ml-1">{t('dashboard.briefReadiness', 'Readiness')}</span>
          </div>
          <div className="flex items-center gap-1 text-xs">
            {readiness.trend === 'improving' && <><TrendingUp className="w-3.5 h-3.5 text-emerald-500" /><span className="text-emerald-500">{t('dashboard.briefTrendImproving', 'Improving')}</span></>}
            {readiness.trend === 'stable' && <><Minus className="w-3.5 h-3.5 text-[var(--text-muted)]" /><span className="text-[var(--text-muted)]">{t('dashboard.briefTrendStable', 'Stable')}</span></>}
            {readiness.trend === 'declining' && <><TrendingDown className="w-3.5 h-3.5 text-red-500" /><span className="text-red-500">{t('dashboard.briefTrendDeclining', 'Declining')}</span></>}
          </div>
        </div>
      )}

      {/* Advisor narrative */}
      {report?.narrative && (
        <div className="mb-3 px-3 py-2.5 rounded-lg bg-[var(--bg-input)] border-l-2 border-[var(--accent-text)]">
          <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-1">{t('dashboard.advisorNote', "Advisor's Note")}</p>
          <p className="text-sm text-[var(--text-body)] leading-relaxed">{report.narrative}</p>
        </div>
      )}

      {/* Priorities */}
      {priorities.length > 0 ? (
        <div className="mb-3">
          <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-2">{t('dashboard.briefPriorities', "Today's priorities")}</p>
          <ul className="space-y-1.5">
            {priorities.map((p, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="mt-0.5 shrink-0">
                  <span className={`inline-block w-2 h-2 rounded-full ${p.urgency === 'critical' ? 'bg-red-500' : p.urgency === 'high' ? 'bg-orange-500' : 'bg-blue-500'}`} />
                </span>
                <span className="text-[var(--text-body)]">
                  <span className="font-medium text-[var(--text-heading)]">{p.topicName}</span>
                  {' — '}{p.reason}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-[var(--text-muted)] mb-3">{t('dashboard.briefNoPriorities', "No urgent items — you're on track")}</p>
      )}

      {/* Urgent progress insight */}
      {urgentInsight && (
        <div className={`text-xs p-2 rounded-lg mb-3 ${
          urgentInsight.urgency === 'urgent' ? 'bg-red-500/10 text-red-600' : 'bg-amber-500/10 text-amber-600'
        }`}>
          <span className="font-medium">{urgentInsight.title}</span>: {urgentInsight.message}
        </div>
      )}

      {/* CTA */}
      <Link
        to="/queue"
        className="w-full btn-primary py-2 text-sm font-medium flex items-center justify-center gap-2"
      >
        {t('dashboard.briefViewQueue', 'Start session')}
        <ArrowRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  )
}
