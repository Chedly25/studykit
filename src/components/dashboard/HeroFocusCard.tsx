import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { BookOpen, ClipboardCheck, RotateCcw, Lightbulb, Layers, ArrowRight, PartyPopper, Upload } from 'lucide-react'
import type { StudyRecommendation } from '../../lib/studyRecommender'

interface HeroFocusCardProps {
  recommendation: StudyRecommendation | null
  dueFlashcardCount: number
  isResearch: boolean
  allCaughtUp: boolean
  hasTopics: boolean
}

const ACTION_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  'read': BookOpen,
  'practice': ClipboardCheck,
  'review': RotateCcw,
  'explain-back': Lightbulb,
  'flashcards': Layers,
}

const ACTION_COLORS: Record<string, string> = {
  'read': 'bg-blue-500/15 text-blue-500',
  'practice': 'bg-purple-500/15 text-purple-500',
  'review': 'bg-amber-500/15 text-amber-500',
  'explain-back': 'bg-emerald-500/15 text-emerald-500',
  'flashcards': 'bg-pink-500/15 text-pink-500',
}

export function HeroFocusCard({ recommendation, dueFlashcardCount, isResearch: _isResearch, allCaughtUp, hasTopics }: HeroFocusCardProps) {
  const { t } = useTranslation()

  // State 1: Has a recommendation → show it
  if (recommendation) {
    const Icon = ACTION_ICONS[recommendation.action] ?? BookOpen
    const colorClass = ACTION_COLORS[recommendation.action] ?? 'bg-[var(--accent-bg)] text-[var(--accent-text)]'

    return (
      <div className="glass-card p-6 md:p-8 mb-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3">
          {t('dashboard.yourFocus')}
        </p>
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-full ${colorClass} flex items-center justify-center shrink-0`}>
            <Icon size={24} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-[var(--text-heading)] truncate">
              {recommendation.topicName}
            </h2>
            <p className="text-sm text-[var(--text-muted)]">{recommendation.subjectName}</p>
            <p className="text-xs text-[var(--text-faint)] mt-0.5">{recommendation.reason}</p>
          </div>
          <Link
            to={recommendation.linkTo}
            className="btn-primary px-5 py-2.5 flex items-center gap-2 shrink-0"
          >
            {t('dashboard.startSession')} <ArrowRight size={16} />
          </Link>
        </div>

        {/* Flashcard nudge */}
        {recommendation.action !== 'flashcards' && dueFlashcardCount > 0 && (
          <p className="text-xs text-[var(--text-muted)] mt-3 pl-16">
            {t('dashboard.flashcardsDueAlso', { count: dueFlashcardCount })}
            {' — '}
            <Link to="/flashcard-maker" className="text-[var(--accent-text)] hover:underline">
              {t('common.start')}
            </Link>
          </p>
        )}
      </div>
    )
  }

  // State 2: No recommendation, has topics, all caught up
  if (allCaughtUp && hasTopics) {
    return (
      <div className="glass-card p-6 md:p-8 mb-4 border-emerald-500/20">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0">
            <PartyPopper size={24} className="text-emerald-500" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-[var(--text-heading)]">
              {t('dashboard.allCaughtUp')}
            </h2>
            <p className="text-sm text-[var(--text-muted)] mt-1">
              {t('dashboard.allCaughtUpDesc')}
            </p>
            <div className="flex flex-wrap gap-3 mt-3">
              {dueFlashcardCount > 0 && (
                <Link to="/flashcard-maker" className="text-sm text-[var(--accent-text)] hover:underline">
                  {t('dashboard.reviewFlashcards', { count: dueFlashcardCount })}
                </Link>
              )}
              <Link to="/sources" className="text-sm text-[var(--accent-text)] hover:underline">
                {t('dashboard.exploreTopic')}
              </Link>
              <Link to="/practice-exam" className="text-sm text-[var(--accent-text)] hover:underline">
                {t('dashboard.takePracticeExam')}
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // State 3: New user — no topics or no recommendations yet → invite to upload materials
  return (
    <div className="glass-card p-6 md:p-8 mb-4">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-[var(--accent-bg)] flex items-center justify-center shrink-0">
          <Upload size={24} className="text-[var(--accent-text)]" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-bold text-[var(--text-heading)]">
            {t('dashboard.heroGetStarted')}
          </h2>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            {t('dashboard.heroGetStartedDesc')}
          </p>
        </div>
        <Link
          to="/sources"
          className="btn-primary px-5 py-2.5 flex items-center gap-2 shrink-0"
        >
          {t('dashboard.heroGetStartedCta')} <ArrowRight size={16} />
        </Link>
      </div>
    </div>
  )
}
