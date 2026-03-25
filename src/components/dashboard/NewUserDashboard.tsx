/**
 * New user onboarding dashboard — 3 guided step cards.
 * Shown when avgMastery < 10% and no documents uploaded.
 * Cards get checkmarks as each step is completed.
 */
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Upload, ClipboardCheck, BookOpen, CheckCircle, ArrowRight } from 'lucide-react'
import type { ExamProfile } from '../../db/schema'

interface NewUserDashboardProps {
  profile: ExamProfile
  userName?: string
  documentCount: number
  practiceExamCount: number
  sessionCount: number
}

export function NewUserDashboard({ profile, userName, documentCount, practiceExamCount, sessionCount }: NewUserDashboardProps) {
  const { t } = useTranslation()

  const steps = [
    {
      done: documentCount > 0,
      icon: Upload,
      title: t('dashboard.step1Title', 'Upload your courses'),
      hint: t('dashboard.step1Hint', 'Drop your PDFs, photos or notes so the AI can analyze your program'),
      cta: t('dashboard.step1Cta', 'Upload'),
      link: '/sources',
    },
    {
      done: practiceExamCount > 0,
      icon: ClipboardCheck,
      title: t('dashboard.step2Title', 'Take a practice exam'),
      hint: t('dashboard.step2Hint', 'Test your level with an exam-style test'),
      cta: t('dashboard.step2Cta', 'Start exam'),
      link: '/practice-exam',
    },
    {
      done: sessionCount > 0,
      icon: BookOpen,
      title: t('dashboard.step3Title', 'Start a study session'),
      hint: t('dashboard.step3Hint', 'The AI guides you question by question'),
      cta: t('dashboard.step3Cta', 'Study'),
      link: '/queue',
    },
  ]

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 animate-fade-in">
      {/* Welcome */}
      <div className="mb-6">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--text-heading)]">
          {t('dashboard.welcomeName', 'Welcome, {{name}}!', { name: userName || profile.name })}
        </h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          {profile.name}
          {profile.examDate && (() => {
            const days = Math.max(0, Math.ceil((new Date(profile.examDate).getTime() - Date.now()) / 86400000))
            return days > 0 ? ` · ${t('dashboard.daysToGo', { count: days })}` : ''
          })()}
        </p>
      </div>

      {/* Step cards */}
      <div className="space-y-3">
        {steps.map((step, i) => {
          const Icon = step.done ? CheckCircle : step.icon
          return (
            <Link
              key={i}
              to={step.link}
              className={`glass-card glass-card-hover p-5 flex items-center gap-4 transition-opacity ${
                step.done ? 'opacity-50' : ''
              }`}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                step.done
                  ? 'bg-[var(--color-success-bg)] text-[var(--color-success)]'
                  : 'bg-[var(--accent-bg)] text-[var(--accent-text)]'
              }`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[var(--text-faint)]">
                    {step.done ? t('dashboard.stepDone', 'Done') : `${i + 1}`}
                  </span>
                  <h3 className="text-sm font-semibold text-[var(--text-heading)]">{step.title}</h3>
                </div>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">{step.hint}</p>
              </div>
              {!step.done && (
                <ArrowRight className="w-4 h-4 text-[var(--text-faint)] shrink-0" />
              )}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
