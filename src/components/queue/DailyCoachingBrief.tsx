import { useState, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronDown, ChevronUp, ArrowRight } from 'lucide-react'
import { db } from '../../db'
import type { DiagnosticPriority } from '../../ai/agents/diagnostician'

interface Props {
  examProfileId: string
  profileName: string
  onBeginSession: () => void
}

function getGreeting(name: string): string {
  const hour = new Date().getHours()
  if (hour < 12) return `Good morning, ${name}.`
  if (hour < 18) return `Good afternoon, ${name}.`
  return `Good evening, ${name}.`
}

export function DailyCoachingBrief({ examProfileId, profileName, onBeginSession }: Props) {
  const today = new Date().toISOString().slice(0, 10)
  const storageKey = `coaching_brief_collapsed_${examProfileId}_${today}`

  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(storageKey) === 'true' } catch { return false }
  })

  // Yesterday's study log
  const yesterday = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() - 1)
    return d.toISOString().slice(0, 10)
  }, [])

  const yesterdayLog = useLiveQuery(
    () => db.dailyStudyLogs.get(`${examProfileId}:${yesterday}`),
    [examProfileId, yesterday],
  )

  // Diagnostician priorities
  const priorities = useLiveQuery(async () => {
    const insight = await db.agentInsights.get(`diagnostician:${examProfileId}`)
    if (!insight) return []
    try {
      const report = JSON.parse(insight.data) as { priorities?: DiagnosticPriority[] }
      return (report.priorities ?? [])
        .sort((a, b) => {
          const order = { critical: 0, high: 1, medium: 2, low: 3 }
          return (order[a.urgency] ?? 3) - (order[b.urgency] ?? 3)
        })
        .slice(0, 3)
    } catch { return [] }
  }, [examProfileId]) ?? []

  const greeting = getGreeting(profileName)
  const suggestCount = priorities.length

  const handleCollapse = () => {
    setCollapsed(true)
    try { localStorage.setItem(storageKey, 'true') } catch {}
  }

  const handleExpand = () => {
    setCollapsed(false)
    try { localStorage.removeItem(storageKey) } catch {}
  }

  const handleBegin = () => {
    handleCollapse()
    onBeginSession()
  }

  if (collapsed) {
    return (
      <button
        onClick={handleExpand}
        className="w-full glass-card p-3 mb-4 flex items-center justify-between text-left animate-fade-in"
      >
        <span className="text-sm text-[var(--text-body)]">
          {greeting}{suggestCount > 0 ? ` ${suggestCount} items suggested.` : ''}
        </span>
        <ChevronDown className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
      </button>
    )
  }

  return (
    <div className="glass-card p-5 mb-4 animate-fade-in">
      {/* Header with collapse */}
      <div className="flex items-start justify-between mb-3">
        <h2 className="text-base font-semibold text-[var(--text-heading)]">{greeting}</h2>
        <button onClick={handleCollapse} className="p-1 text-[var(--text-muted)] hover:text-[var(--text-body)]">
          <ChevronUp className="w-4 h-4" />
        </button>
      </div>

      {/* Yesterday recap */}
      {yesterdayLog && yesterdayLog.totalSeconds > 0 && (
        <p className="text-sm text-[var(--text-muted)] mb-3">
          Yesterday you studied for {Math.round(yesterdayLog.totalSeconds / 60)} min
          {yesterdayLog.questionsAnswered > 0 && (
            <> and covered {yesterdayLog.questionsAnswered} item{yesterdayLog.questionsAnswered !== 1 ? 's' : ''}
            {yesterdayLog.questionsAnswered > 0 && ` with ${Math.round((yesterdayLog.questionsCorrect / yesterdayLog.questionsAnswered) * 100)}% accuracy`}</>
          )}. Nice work.
        </p>
      )}

      {/* Suggestions */}
      {priorities.length > 0 ? (
        <div className="mb-4">
          <p className="text-sm font-medium text-[var(--text-body)] mb-2">Today I'd suggest:</p>
          <ul className="space-y-1.5">
            {priorities.map((p, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="text-[var(--accent-text)] mt-0.5 shrink-0">
                  {p.urgency === 'critical' ? '🔴' : p.urgency === 'high' ? '🟠' : '🔵'}
                </span>
                <span className="text-[var(--text-body)]">
                  {p.suggestedAction === 'review' ? 'Review' : p.suggestedAction === 'practice' ? 'Practice' : p.suggestedAction === 'relearn' ? 'Revisit' : 'Assess'}{' '}
                  <span className="font-medium text-[var(--text-heading)]">{p.topicName}</span>
                  {' — '}{p.reason}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-[var(--text-muted)] mb-4">Your queue is ready. Let's get started.</p>
      )}

      {/* Begin Session CTA */}
      <button
        onClick={handleBegin}
        className="w-full btn-primary py-2.5 text-sm font-semibold flex items-center justify-center gap-2"
      >
        Begin Session
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  )
}
