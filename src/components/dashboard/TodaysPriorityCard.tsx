/**
 * Dashboard widget showing today's prioritized study recommendations.
 */
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { BookOpen, ClipboardCheck, RotateCcw, MessageCircle, Layers, Zap, ArrowRight } from 'lucide-react'
import type { StudyRecommendation, RecommendationAction } from '../../lib/studyRecommender'

interface TodaysPriorityCardProps {
  recommendations: StudyRecommendation[]
}

const actionIcons: Record<RecommendationAction, typeof BookOpen> = {
  read: BookOpen,
  practice: ClipboardCheck,
  review: RotateCcw,
  'explain-back': MessageCircle,
  flashcards: Layers,
}

const actionColors: Record<RecommendationAction, string> = {
  read: 'text-blue-500 bg-blue-500/10',
  practice: 'text-purple-500 bg-purple-500/10',
  review: 'text-amber-500 bg-amber-500/10',
  'explain-back': 'text-green-500 bg-green-500/10',
  flashcards: 'text-pink-500 bg-pink-500/10',
}

export function TodaysPriorityCard({ recommendations }: TodaysPriorityCardProps) {
  const { t } = useTranslation()

  if (recommendations.length === 0) return null

  return (
    <div className="glass-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Zap className="w-5 h-5 text-[var(--accent-text)]" />
        <h3 className="font-semibold text-[var(--text-heading)]">
          {t('dashboard.todaysPriority')}
        </h3>
      </div>

      <div className="space-y-2">
        {recommendations.map((rec, i) => {
          const Icon = actionIcons[rec.action]
          const colorClass = actionColors[rec.action]

          return (
            <Link
              key={rec.topicId}
              to={rec.linkTo}
              className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-[var(--accent-bg)] transition-colors group"
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${colorClass}`}>
                <Icon className="w-4 h-4" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {i === 0 && (
                    <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--accent-text)] bg-[var(--accent-bg)] px-1.5 py-0.5 rounded">
                      {t('dashboard.topPriority')}
                    </span>
                  )}
                  <span className="text-sm font-medium text-[var(--text-heading)] truncate">
                    {rec.topicName}
                  </span>
                </div>
                <p className="text-xs text-[var(--text-muted)] truncate">{rec.reason}</p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-[var(--text-muted)]">
                  {Math.round(rec.decayedMastery * 100)}%
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-[var(--text-muted)] group-hover:text-[var(--accent-text)] transition-colors" />
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
