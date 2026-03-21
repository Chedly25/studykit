import { useTranslation } from 'react-i18next'
import { BookOpen, ClipboardCheck, RotateCcw, Lightbulb, Layers } from 'lucide-react'
import type { StudyRecommendation } from '../../lib/studyRecommender'

interface UpNextListProps {
  recommendations: StudyRecommendation[]
}

const ACTION_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  'read': BookOpen,
  'practice': ClipboardCheck,
  'review': RotateCcw,
  'explain-back': Lightbulb,
  'flashcards': Layers,
}

export function UpNextList({ recommendations }: UpNextListProps) {
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
            <div
              key={rec.topicId}
              className="flex items-center gap-3 px-2 py-2 rounded-lg"
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
            </div>
          )
        })}
      </div>
    </div>
  )
}
