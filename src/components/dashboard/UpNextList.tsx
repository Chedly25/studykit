import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { BookOpen, ClipboardCheck, RotateCcw, Lightbulb, Layers, ArrowRight } from 'lucide-react'
import type { StudyRecommendation } from '../../lib/studyRecommender'

interface UpNextListProps {
  recommendations: StudyRecommendation[]
  queueTopicIds?: Set<string>
}

const ACTION_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  'read': BookOpen,
  'practice': ClipboardCheck,
  'review': RotateCcw,
  'explain-back': Lightbulb,
  'flashcards': Layers,
}

export function UpNextList({ recommendations, queueTopicIds }: UpNextListProps) {
  const { t } = useTranslation()

  if (recommendations.length === 0) return null

  return (
    <div className="glass-card p-4 mb-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">
        {t('dashboard.upNext', 'Up next')}
      </p>
      <div className="space-y-1">
        {recommendations.slice(0, 3).map(rec => {
          const Icon = ACTION_ICONS[rec.action] ?? BookOpen
          return (
            <Link
              key={rec.topicId}
              to={rec.linkTo}
              className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-[var(--bg-input)] transition-colors w-full"
            >
              <Icon size={18} className="text-[var(--text-muted)] shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-[var(--text-heading)] truncate block">
                  {rec.topicName}
                </span>
                <span className="text-xs text-[var(--text-faint)] truncate block">{rec.reason}</span>
              </div>
              <span className="text-xs font-medium text-[var(--text-muted)] shrink-0">
                {Math.round(rec.decayedMastery * 100)}%
              </span>
              {queueTopicIds?.has(rec.topicId) && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--accent-bg)] text-[var(--accent-text)] shrink-0">In queue</span>
              )}
              <ArrowRight className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
            </Link>
          )
        })}
      </div>
    </div>
  )
}
