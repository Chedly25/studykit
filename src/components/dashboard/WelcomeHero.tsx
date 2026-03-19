import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Upload, ListChecks, ClipboardCheck, PenTool, BookOpen } from 'lucide-react'
import type { Topic, Subject } from '../../db/schema'
import { LandscapeCard } from './LandscapeCard'

interface Props {
  profileName: string
  isResearch: boolean
  topics: Topic[]
  subjects: Subject[]
  onSkip: () => void
}

export function WelcomeHero({ profileName, isResearch, topics, subjects, onSkip }: Props) {
  const { t } = useTranslation()

  const actions = isResearch
    ? [
        { icon: BookOpen, title: t('dashboard.welcomeHero.uploadPapersTitle'), desc: t('dashboard.welcomeHero.uploadPapersDesc'), to: '/sources' },
        { icon: PenTool, title: t('dashboard.welcomeHero.writingTitle'), desc: t('dashboard.welcomeHero.writingDesc'), to: '/writing' },
        { icon: ListChecks, title: t('dashboard.welcomeHero.practiceTitle'), desc: t('dashboard.welcomeHero.practiceDesc'), to: '/exercises' },
      ]
    : [
        { icon: Upload, title: t('dashboard.welcomeHero.uploadTitle'), desc: t('dashboard.welcomeHero.uploadDesc'), to: '/sources' },
        { icon: ListChecks, title: t('dashboard.welcomeHero.chatTitle'), desc: t('dashboard.welcomeHero.chatDesc'), to: '/exercises' },
        { icon: ClipboardCheck, title: t('dashboard.welcomeHero.practiceTitle'), desc: t('dashboard.welcomeHero.practiceDesc'), to: '/practice-exam' },
      ]

  return (
    <div className="max-w-4xl mx-auto px-4 py-12 animate-fade-in">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-[var(--text-heading)] mb-3">
          {t('dashboard.welcomeHero.title', { name: profileName })}
        </h1>
        <p className="text-[var(--text-muted)] max-w-xl mx-auto">
          {isResearch
            ? t('dashboard.welcomeHero.subtitleResearch')
            : t('dashboard.welcomeHero.subtitle')}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {actions.map(({ icon: Icon, title, desc, to }) => (
          <Link key={to} to={to} className="glass-card glass-card-hover p-5 flex flex-col items-start gap-3 group">
            <div className="w-11 h-11 rounded-lg bg-[var(--accent-bg)] flex items-center justify-center">
              <Icon className="w-5 h-5 text-[var(--accent-text)]" />
            </div>
            <div>
              <span className="font-semibold text-[var(--text-heading)] group-hover:text-[var(--accent-text)] transition-colors">
                {title}
              </span>
              <p className="text-sm text-[var(--text-muted)] mt-1">{desc}</p>
            </div>
          </Link>
        ))}
      </div>

      {topics.length > 0 && (
        <div className="mb-8">
          <p className="text-sm text-[var(--text-muted)] mb-3 text-center">
            {t('dashboard.welcomeHero.topicsReady', { count: topics.length })}
          </p>
          <LandscapeCard topics={topics} subjects={subjects} />
        </div>
      )}

      <div className="text-center">
        <button
          onClick={onSkip}
          className="text-sm text-[var(--text-muted)] hover:text-[var(--accent-text)] transition-colors underline underline-offset-2"
        >
          {t('dashboard.welcomeHero.skipToDashboard')}
        </button>
      </div>
    </div>
  )
}
