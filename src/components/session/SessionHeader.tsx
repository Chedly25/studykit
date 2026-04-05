import { useTranslation } from 'react-i18next'
import { ArrowLeft, BookOpen, FolderOpen } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Topic, Subject } from '../../db/schema'

interface SessionHeaderProps {
  topic: Topic
  subject: Subject | undefined
  chapterName?: string
  onToggleMaterials: () => void
  materialsOpen: boolean
}

export function SessionHeader({ topic, subject, chapterName, onToggleMaterials, materialsOpen }: SessionHeaderProps) {
  const { t } = useTranslation()
  const masteryPct = Math.round(topic.mastery * 100)

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border-card)] bg-[var(--bg-card)]/50 backdrop-blur-sm">
      <Link
        to="/dashboard"
        className="p-1.5 rounded-lg hover:bg-[var(--bg-input)] text-[var(--text-muted)] transition-colors flex-shrink-0"
        title={t('nav.dashboard')}
      >
        <ArrowLeft className="w-4 h-4" />
      </Link>

      <BookOpen className="w-5 h-5 text-[var(--accent-text)] flex-shrink-0" />

      <div className="flex-1 min-w-0">
        <h1 className="text-sm font-semibold text-[var(--text-heading)] truncate">{topic.name}</h1>
        <p className="text-xs text-[var(--text-muted)] truncate">
          {[subject?.name, chapterName].filter(Boolean).join(' › ')}
        </p>
      </div>

      {/* Mastery bar */}
      <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
        <div className="w-24 h-1.5 rounded-full bg-[var(--bg-input)] overflow-hidden">
          <div
            className="h-full rounded-full bg-[var(--accent-text)] transition-all"
            style={{ width: `${masteryPct}%` }}
          />
        </div>
        <span className="text-xs text-[var(--text-muted)] w-8">{masteryPct}%</span>
      </div>

      <button
        onClick={onToggleMaterials}
        className={`p-1.5 rounded-lg transition-colors flex-shrink-0 ${
          materialsOpen
            ? 'bg-[var(--accent-bg)] text-[var(--accent-text)]'
            : 'hover:bg-[var(--bg-input)] text-[var(--text-muted)]'
        }`}
        title={t('session.materials')}
      >
        <FolderOpen className="w-4 h-4" />
      </button>
    </div>
  )
}
