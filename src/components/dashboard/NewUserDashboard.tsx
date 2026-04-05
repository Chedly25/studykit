/**
 * New user dashboard — context-aware post-onboarding + guided step cards.
 * When just finished onboarding: shows acknowledgment, live processing, and first action CTA.
 * Otherwise: shows 3 step cards with checkmarks as each step is completed.
 */
import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Upload, ClipboardCheck, BookOpen, CheckCircle, ArrowRight, Check, Loader2 } from 'lucide-react'
import type { ExamProfile } from '../../db/schema'
import { useActiveJobs } from '../../hooks/useActiveJobs'

interface NewUserDashboardProps {
  profile: ExamProfile
  userName?: string
  documentCount: number
  practiceExamCount: number
  sessionCount: number
}

interface PostOnboardingData {
  profileId: string
  completedAt: number
  topicCount: number
  docsQueuedCount: number
}

function readPostOnboarding(profileId: string): PostOnboardingData | null {
  try {
    const raw = localStorage.getItem('postOnboarding')
    if (!raw) return null
    const data: PostOnboardingData = JSON.parse(raw)
    if (data.profileId !== profileId) return null
    // 30-minute TTL
    if (Date.now() - data.completedAt > 30 * 60 * 1000) {
      localStorage.removeItem('postOnboarding')
      return null
    }
    return data
  } catch {
    return null
  }
}

export function NewUserDashboard({ profile, userName, documentCount, practiceExamCount, sessionCount }: NewUserDashboardProps) {
  const { t } = useTranslation()

  const [postOnboarding] = useState(() => readPostOnboarding(profile.id))

  // Clear the flag after the user has seen it
  useEffect(() => {
    if (postOnboarding) {
      const timer = setTimeout(() => localStorage.removeItem('postOnboarding'), 5000)
      return () => clearTimeout(timer)
    }
  }, [postOnboarding])

  // Live background jobs for processing status
  const activeJobs = useActiveJobs(profile.id)
  const processingDocs = useMemo(
    () => activeJobs.filter(j => j.type === 'source-processing'),
    [activeJobs],
  )

  const steps = [
    {
      done: documentCount > 0,
      icon: Upload,
      title: t('dashboard.step1Title'),
      hint: t('dashboard.step1Hint'),
      link: '/sources',
    },
    {
      done: practiceExamCount > 0,
      icon: ClipboardCheck,
      title: t('dashboard.step2Title'),
      hint: t('dashboard.step2Hint'),
      link: '/practice-exam',
    },
    {
      done: sessionCount > 0,
      icon: BookOpen,
      title: t('dashboard.step3Title'),
      hint: t('dashboard.step3Hint'),
      link: '/queue',
    },
  ]

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 animate-fade-in">
      {/* ─── Post-Onboarding Acknowledgment ─── */}
      {postOnboarding ? (
        <>
          {/* Welcome card */}
          <div className="glass-card p-6 mb-4 animate-fade-in-up stagger-1">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-4">
              <Check className="w-7 h-7 text-emerald-500" />
            </div>
            <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--text-heading)]">
              {t('dashboard.postOnboarding.title', { name: userName || profile.name })}
            </h1>
            <p className="text-sm text-[var(--text-muted)] mt-1">
              {t('dashboard.postOnboarding.subtitle')}
            </p>

            {/* Summary chips */}
            <div className="flex flex-wrap gap-2 mt-4">
              {postOnboarding.topicCount > 0 && (
                <span className="text-xs font-medium bg-[var(--accent-bg)] text-[var(--accent-text)] px-3 py-1 rounded-full">
                  {t('dashboard.postOnboarding.topicsSeeded', { count: postOnboarding.topicCount })}
                </span>
              )}
              {processingDocs.length > 0 ? (
                <span className="text-xs font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 px-3 py-1 rounded-full animate-gentle-pulse">
                  {t('dashboard.postOnboarding.docsProcessing', { count: processingDocs.length })}
                </span>
              ) : postOnboarding.docsQueuedCount > 0 ? (
                <span className="text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-3 py-1 rounded-full">
                  {t('dashboard.postOnboarding.docsReady')}
                </span>
              ) : null}
            </div>
          </div>

          {/* Live processing status */}
          {processingDocs.length > 0 && (
            <div className="glass-card p-4 mb-4 animate-fade-in-up stagger-2">
              <div className="flex items-center gap-2 mb-2">
                <Loader2 className="w-4 h-4 text-[var(--accent-text)] animate-spin" />
                <span className="text-xs font-semibold text-[var(--text-heading)]">
                  {t('dashboard.postOnboarding.aiWorking')}
                </span>
              </div>
              <p className="text-xs text-[var(--text-muted)]">
                {t('dashboard.postOnboarding.aiWorkingSubtitle')}
              </p>
              <div className="mt-3 space-y-2">
                {processingDocs.map(job => (
                  <div key={job.id} className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-[var(--bg-input)] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[var(--accent-text)] transition-all duration-500"
                        style={{ width: `${job.totalSteps > 0 ? (job.completedStepCount / job.totalSteps) * 100 : 10}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-[var(--text-faint)] shrink-0">
                      {job.currentStepName || 'Processing...'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* First action CTA */}
          <div className="glass-card p-5 mb-4 animate-fade-in-up stagger-3">
            <h3 className="font-semibold text-[var(--text-heading)] mb-1">
              {t('dashboard.postOnboarding.firstAction')}
            </h3>
            <p className="text-xs text-[var(--text-muted)] mb-4">
              {t('dashboard.postOnboarding.firstActionHint')}
            </p>
            <div className="flex gap-2">
              <Link to="/queue" className="btn-primary flex-1 py-2.5 text-sm flex items-center justify-center gap-2">
                {t('dashboard.postOnboarding.startFirstSession')} <ArrowRight className="w-4 h-4" />
              </Link>
              <Link to="/analytics" className="btn-secondary flex-1 py-2.5 text-sm text-center">
                {t('dashboard.postOnboarding.exploreTopics')}
              </Link>
            </div>
          </div>
        </>
      ) : (
        /* ─── Standard Welcome ─── */
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
      )}

      {/* ─── Step cards (always visible) ─── */}
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
                    {step.done ? t('dashboard.stepDone') : `${i + 1}`}
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
