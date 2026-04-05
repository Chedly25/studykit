/**
 * Active user dashboard — command center style.
 * Hero with readiness bar + session CTA, focus list, subject cards.
 */
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowRight, MessageCircle, Sparkles, Target } from 'lucide-react'
import { EmptyState } from '../EmptyState'
import type { ExamProfile, Subject, Topic } from '../../db/schema'
import { db } from '../../db'
import { ReadinessBar } from './ReadinessBar'
import { TutorDirectory } from '../TutorDirectory'

interface DailyQueueItem {
  id: string
  estimatedMinutes: number
}

interface ActiveDashboardProps {
  profile: ExamProfile
  userName?: string
  topics: Topic[]
  subjects: Subject[]
  dailyQueue: DailyQueueItem[]
  streak: number
  avgMastery: number
  daysUntilExam?: number
  queueInProgress: boolean
}

export function ActiveDashboard({
  profile,
  userName,
  topics,
  subjects,
  dailyQueue,
  streak,
  avgMastery,
  daysUntilExam,
  queueInProgress,
}: ActiveDashboardProps) {
  const { t } = useTranslation()

  // Get greeting based on time of day
  const hour = new Date().getHours()
  const greetingKey = hour < 12 ? 'dashboard.greetingMorning' : hour < 18 ? 'dashboard.greetingAfternoon' : 'dashboard.greetingEvening'

  // Top 3 weakest topics (that have been attempted at least once, or all if none attempted)
  const focusTopics = useMemo(() => {
    const sorted = [...topics]
      .filter(t => t.mastery < 0.8)
      .sort((a, b) => a.mastery - b.mastery)
    return sorted.slice(0, 3)
  }, [topics])

  // Swarm activity log — last 24h entries
  const recentActivity = useLiveQuery(async () => {
    const key = `swarm-activity-log:${profile.id}`
    const insight = await db.agentInsights.get(key)
    if (!insight?.data) return []
    try {
      const entries = JSON.parse(insight.data) as { action: string; summary: string; timestamp: string }[]
      const cutoff = Date.now() - 24 * 60 * 60 * 1000
      return entries.filter(e => new Date(e.timestamp).getTime() > cutoff)
    } catch { return [] }
  }, [profile.id]) ?? []

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 animate-fade-in">
      {/* ─── Hero Section ─── */}
      <div className="glass-card p-6 mb-4 animate-fade-in-up stagger-1">
        {/* Greeting */}
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--text-heading)]">
          {t(greetingKey, { name: userName || profile.name })}
        </h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          {profile.name}
          {streak > 0 && <span> · {t('session.dayStreak', { count: streak })}</span>}
          {daysUntilExam !== undefined && daysUntilExam > 0 && (
            <span> · {t('dashboard.daysToGo', { count: daysUntilExam })}</span>
          )}
        </p>

        {/* Readiness bar */}
        <div className="mt-4">
          <ReadinessBar percent={Math.round(avgMastery * 100)} />
        </div>

        {/* Primary CTA */}
        <div className="mt-4">
          {dailyQueue.length > 0 ? (
            <Link
              to="/queue"
              className="btn-primary w-full py-3 text-sm font-medium flex items-center justify-center gap-2"
            >
              {queueInProgress
                ? t('dashboard.continueSession')
                : t('dashboard.startSessionCta', "Start today's session — {{count}} items, ~{{minutes}} min", {
                    count: dailyQueue.length,
                    minutes: dailyQueue.reduce((s, q) => s + q.estimatedMinutes, 0),
                  })
              }
              <ArrowRight className="w-4 h-4" />
            </Link>
          ) : (
            <div className="flex gap-2">
              <Link to="/practice-exam" className="btn-primary flex-1 py-2.5 text-sm font-medium flex items-center justify-center gap-2">
                {t('dashboard.startFirstExam')}
              </Link>
              <button
                onClick={() => window.dispatchEvent(new CustomEvent('open-chat-panel', { detail: {} }))}
                className="btn-ghost py-2.5 px-4 text-sm flex items-center gap-2"
              >
                <MessageCircle className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ─── Working for you ─── */}
      {recentActivity.length > 0 ? (
        <div className="glass-card p-4 mb-4 animate-fade-in-up stagger-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[var(--accent-text)] animate-gentle-pulse" />
            <span className="text-xs font-semibold text-[var(--text-heading)]">
              {t('dashboard.workingForYou')}
            </span>
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-1.5 leading-relaxed">
            {recentActivity.map(e => e.summary).join(' · ')}
          </p>
        </div>
      ) : topics.length > 0 ? (
        <div className="glass-card p-4 mb-4 animate-fade-in-up stagger-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[var(--accent-text)] animate-gentle-pulse" />
            <span className="text-xs font-semibold text-[var(--text-heading)]">
              {t('emptyState.dashboardAiStarting.title')}
            </span>
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-1.5 leading-relaxed">
            {t('emptyState.dashboardAiStarting.subtitle')}
          </p>
        </div>
      ) : null}

      {/* ─── Focus List ─── */}
      {focusTopics.length > 0 ? (
        <div className="glass-card p-4 mb-4 animate-fade-in-up stagger-3">
          <div className="mb-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-faint)]">
              {t('dashboard.focusTitle')}
            </p>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              {t('dashboard.focusSubtitle')}
            </p>
          </div>
          <div className="space-y-2">
            {focusTopics.map((topic) => (
              <Link
                key={topic.id}
                to={`/topic/${topic.id}`}
                className="flex items-center justify-between py-1.5 group"
              >
                <span className="text-sm text-[var(--text-body)] group-hover:text-[var(--accent-text)] transition-colors">
                  {topic.name || 'Unnamed'}
                </span>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-semibold tabular-nums ${
                    topic.mastery < 0.2 ? 'text-[var(--color-error)]' :
                    topic.mastery < 0.5 ? 'text-[var(--color-warning)]' :
                    'text-[var(--text-muted)]'
                  }`}>
                    {Math.round(topic.mastery * 100)}%
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-[var(--text-faint)] group-hover:text-[var(--accent-text)] transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      ) : topics.length > 0 ? (
        <div className="glass-card p-4 mb-4 animate-fade-in-up stagger-3">
          <EmptyState
            icon={Target}
            title={t('emptyState.dashboardNoFocus.title')}
            subtitle={t('emptyState.dashboardNoFocus.subtitle')}
            compact
          />
        </div>
      ) : null}

      {/* ─── Subject Cards ─── */}
      {subjects.length > 0 && (
        <div className="animate-fade-in-up stagger-4">
          <div className="mb-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-faint)]">
              {t('dashboard.yourTutors')}
            </p>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              {t('dashboard.subjectsSubtitle')}
            </p>
          </div>
          <TutorDirectory subjects={subjects} topics={topics} />
        </div>
      )}
    </div>
  )
}
