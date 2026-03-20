import type { ErrorPatternSummary } from '../../lib/errorPatterns'

interface Props {
  data: ErrorPatternSummary[]
  onDrillDown?: (topicName: string, errorType: string) => void
}

const TYPE_COLORS: Record<string, string> = {
  recall: '#3b82f6',
  conceptual: '#ef4444',
  application: '#f59e0b',
  distractor: '#8b5cf6',
  unclassified: '#6b7280',
}

const TYPE_LABELS: Record<string, string> = {
  recall: 'Recall',
  conceptual: 'Conceptual',
  application: 'Application',
  distractor: 'Distractor',
  unclassified: 'Unclassified',
}

export function ErrorPatternChart({ data, onDrillDown }: Props) {
  if (data.length === 0) {
    return (
      <p className="text-sm text-[var(--text-muted)]">
        No incorrect answers recorded yet.
      </p>
    )
  }

  const topData = data.slice(0, 8)
  const maxErrors = Math.max(...topData.map(d => d.totalErrors))

  return (
    <div>
      <div className="space-y-3">
        {topData.map(d => {
          const pct = maxErrors > 0 ? (d.totalErrors / maxErrors) * 100 : 0
          const segments = [
            { type: 'recall', count: d.recall },
            { type: 'conceptual', count: d.conceptual },
            { type: 'application', count: d.application },
            { type: 'distractor', count: d.distractor },
            { type: 'unclassified', count: d.unclassified },
          ].filter(s => s.count > 0)

          return (
            <div key={d.topicName}>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-[var(--text-body)] truncate max-w-[200px]">{d.topicName}</span>
                <span className="text-[var(--text-muted)] text-xs">{d.totalErrors} errors</span>
              </div>
              <div className="flex h-5 rounded-md overflow-hidden" style={{ width: `${Math.max(pct, 15)}%` }}>
                {segments.map(seg => {
                  const segPct = (seg.count / d.totalErrors) * 100
                  return (
                    <div
                      key={seg.type}
                      className={`h-full transition-all ${onDrillDown ? 'cursor-pointer hover:opacity-80' : ''}`}
                      style={{
                        width: `${segPct}%`,
                        backgroundColor: TYPE_COLORS[seg.type],
                      }}
                      title={`${TYPE_LABELS[seg.type]}: ${seg.count}`}
                      onClick={() => onDrillDown?.(d.topicName, seg.type)}
                    />
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-4">
        {Object.entries(TYPE_LABELS).map(([key, label]) => (
          <div key={key} className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
            <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: TYPE_COLORS[key] }} />
            {label}
          </div>
        ))}
      </div>
    </div>
  )
}
