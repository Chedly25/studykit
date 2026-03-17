import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { BookOpen, ClipboardCheck, RotateCcw, Lightbulb, Layers, ChevronRight } from 'lucide-react'
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
            <Link
              key={rec.topicId}
              to={rec.linkTo}
              className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-[var(--bg-input)] transition-colors group"
            >
              <Icon size={18} className="text-[var(--text-muted)] shrink-0" />
              <span className="text-sm font-medium text-[var(--text-heading)] truncate flex-1">
                {rec.topicName}
              </span>
              <span className="text-xs text-[var(--text-faint)] hidden sm:inline">{rec.subjectName}</span>
              <span className="text-xs font-medium text-[var(--text-muted)]">
                {Math.round(rec.decayedMastery * 100)}%
              </span>
              <ChevronRight size={14} className="text-[var(--text-faint)] group-hover:text-[var(--accent-text)] transition-colors shrink-0" />
            </Link>
          )
        })}
      </div>
    </div>
  )
}
