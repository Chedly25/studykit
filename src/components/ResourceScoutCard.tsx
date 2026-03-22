import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { BookOpen, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react'
import { db } from '../db'
import type { ScoutResult, ScoutResource } from '../ai/agents/resourceScout'

interface Props {
  examProfileId: string
}

const TYPE_LABELS: Record<ScoutResource['type'], string> = {
  'past-exam': 'Past Exams',
  'study-guide': 'Study Guides',
  'practice-questions': 'Practice Questions',
  'outline': 'Outlines',
  'other': 'Other Resources',
}

const TYPE_ORDER: ScoutResource['type'][] = ['past-exam', 'practice-questions', 'study-guide', 'outline', 'other']

export function ResourceScoutCard({ examProfileId }: Props) {
  const [expanded, setExpanded] = useState(false)

  const scoutResult = useLiveQuery(async () => {
    const insight = await db.agentInsights.get(`resource-scout:${examProfileId}`)
    if (!insight) return null
    try {
      return JSON.parse(insight.data) as ScoutResult
    } catch { return null }
  }, [examProfileId])

  if (!scoutResult || scoutResult.resources.length === 0) return null

  // Group by type
  const grouped = new Map<ScoutResource['type'], ScoutResource[]>()
  for (const r of scoutResult.resources) {
    const list = grouped.get(r.type) ?? []
    list.push(r)
    grouped.set(r.type, list)
  }

  const totalCount = scoutResult.resources.length

  return (
    <div className="glass-card p-4 mb-4 animate-fade-in">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-[var(--accent-text)]" />
          <span className="text-sm font-semibold text-[var(--text-heading)]">
            Resources Found
          </span>
          <span className="text-xs text-[var(--text-muted)]">
            {totalCount} resource{totalCount !== 1 ? 's' : ''} for {scoutResult.examName}
          </span>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-[var(--text-muted)]" /> : <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />}
      </button>

      {expanded && (
        <div className="mt-3 space-y-3">
          {TYPE_ORDER.filter(t => grouped.has(t)).map(type => (
            <div key={type}>
              <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-1.5">
                {TYPE_LABELS[type]} ({grouped.get(type)!.length})
              </p>
              <div className="space-y-1.5">
                {grouped.get(type)!.map((r, i) => (
                  <a
                    key={i}
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start gap-2 p-2 rounded-lg hover:bg-[var(--bg-input)] transition-colors group"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-[var(--text-faint)] mt-0.5 shrink-0 group-hover:text-[var(--accent-text)]" />
                    <div className="min-w-0">
                      <div className="text-sm text-[var(--text-body)] group-hover:text-[var(--accent-text)] truncate">{r.title}</div>
                      <div className="text-xs text-[var(--text-faint)]">{r.relevance}</div>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {!expanded && (
        <div className="mt-2 flex flex-wrap gap-2">
          {TYPE_ORDER.filter(t => grouped.has(t)).map(type => (
            <span key={type} className="text-xs text-[var(--text-muted)] bg-[var(--bg-input)] px-2 py-1 rounded-md">
              {grouped.get(type)!.length} {TYPE_LABELS[type].toLowerCase()}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
