import { useTranslation } from 'react-i18next'
import { Eye, RotateCcw, TrendingUp } from 'lucide-react'
import type { PracticeExamSession } from '../../db/schema'

interface Props {
  sessions: PracticeExamSession[]
  onReview: (sessionId: string) => void
  onRetake: (session: PracticeExamSession) => void
}

export function PracticeExamHistory({ sessions, onReview, onRetake }: Props) {
  const { t } = useTranslation()

  if (sessions.length === 0) return null

  // Score trend sparkline (last 10 sessions)
  const trendData = sessions
    .slice(0, 10)
    .reverse()
    .map(s => {
      const max = s.maxScore ?? 1
      return max > 0 ? Math.round(((s.totalScore ?? 0) / max) * 100) : 0
    })

  const sparklineWidth = 120
  const sparklineHeight = 32
  const points = trendData.map((val, i) => {
    const x = trendData.length > 1 ? (i / (trendData.length - 1)) * sparklineWidth : sparklineWidth / 2
    const y = sparklineHeight - (val / 100) * sparklineHeight
    return `${x},${y}`
  }).join(' ')

  return (
    <div className="glass-card p-4 mt-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-[var(--text-heading)]">{t('practiceExam.history', 'Past Exams')}</h3>
        {trendData.length >= 3 && (
          <div className="flex items-center gap-2">
            <TrendingUp className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            <svg width={sparklineWidth} height={sparklineHeight} className="overflow-visible">
              <polyline
                points={points}
                fill="none"
                stroke="var(--accent-text)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        )}
      </div>

      <div className="space-y-2">
        {sessions.slice(0, 8).map(session => {
          const maxScore = session.maxScore ?? 1
          const percentage = maxScore > 0 ? Math.round(((session.totalScore ?? 0) / maxScore) * 100) : 0
          const date = session.completedAt
            ? new Date(session.completedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
            : '—'

          return (
            <div key={session.id} className="flex items-center gap-3 py-2 px-3 rounded-lg bg-[var(--bg-input)]">
              <span className="text-xs text-[var(--text-muted)] w-16 shrink-0">{date}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${percentage >= 60 ? 'text-emerald-500' : 'text-orange-500'}`}>
                    {percentage}%
                  </span>
                  <span className="text-xs text-[var(--text-muted)]">
                    {session.totalScore ?? 0}/{maxScore} pts
                  </span>
                  <span className="text-xs text-[var(--text-faint)]">
                    {session.questionCount} Q
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => onReview(session.id)}
                  className="p-1.5 text-[var(--text-muted)] hover:text-[var(--accent-text)] transition-colors"
                  title="Review"
                >
                  <Eye className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onRetake(session)}
                  className="p-1.5 text-[var(--text-muted)] hover:text-[var(--accent-text)] transition-colors"
                  title="Retake"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
