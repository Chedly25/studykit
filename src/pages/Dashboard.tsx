import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useTranslation, Trans } from 'react-i18next'
import { Link } from 'react-router-dom'
import { MessageCircle, ClipboardCheck, Upload, Target, CheckCircle, Circle, ArrowRight } from 'lucide-react'
import { useAuth } from '@clerk/clerk-react'
import { db } from '../db'
import type { StudySession } from '../db/schema'
import { useExamProfile } from '../hooks/useExamProfile'
import { useKnowledgeGraph } from '../hooks/useKnowledgeGraph'
import { useProactiveInsights } from '../hooks/useProactiveInsights'
import { useSessionInsights } from '../hooks/useSessionInsights'
import { useSourceCoverage } from '../hooks/useSourceCoverage'
import { useStudyPlan } from '../hooks/useStudyPlan'
import { ReadinessGauge } from '../components/dashboard/ReadinessGauge'
import { WeakTopicsCard } from '../components/dashboard/WeakTopicsCard'
import { ExamCountdownCard } from '../components/dashboard/ExamCountdownCard'
import { StudyStreakCard } from '../components/dashboard/StudyStreakCard'
import { TodaysPlanCard } from '../components/dashboard/TodaysPlanCard'
import { ActivityFeed } from '../components/dashboard/ActivityFeed'
import { InsightCard } from '../components/dashboard/InsightCard'
import { SessionInsightsCard } from '../components/dashboard/SessionInsightsCard'
import { StudyPlanCard } from '../components/dashboard/StudyPlanCard'
import { TopicTree } from '../components/knowledge/TopicTree'
import { TodaysPriorityCard } from '../components/dashboard/TodaysPriorityCard'
import { computeDailyRecommendations } from '../lib/studyRecommender'

export default function Dashboard() {
  const { t } = useTranslation()
  const { getToken } = useAuth()
  const { activeProfile } = useExamProfile()
  const profileId = activeProfile?.id
  const { subjects, topics, readiness, weakTopics, dueTopics, streak, weeklyHours, getTopicsForSubject } = useKnowledgeGraph(profileId)
  const insights = useProactiveInsights(profileId)
  const { recentInsights: sessionInsights } = useSessionInsights(profileId)
  const { coverage: sourceCoverage } = useSourceCoverage(profileId)
  const { activePlan, todaysPlan, markActivityCompleted, replanPlan, replanSuggestion } = useStudyPlan(profileId)

  const sessions = useLiveQuery(
    () => profileId
      ? db.studySessions.where('examProfileId').equals(profileId).toArray()
      : Promise.resolve([] as StudySession[]),
    [profileId]
  ) ?? []

  const dueFlashcards = useLiveQuery(
    () => {
      const today = new Date().toISOString().slice(0, 10)
      return db.flashcards.where('nextReviewDate').belowOrEqual(today).count()
    }
  ) ?? 0

  // Compute due flashcards by topic for recommendations
  const dueFlashcardsByTopic = useLiveQuery(async () => {
    const today = new Date().toISOString().slice(0, 10)
    const dueCards = await db.flashcards.where('nextReviewDate').belowOrEqual(today).toArray()
    const map = new Map<string, number>()
    for (const card of dueCards) {
      if (card.topicId) {
        map.set(card.topicId, (map.get(card.topicId) ?? 0) + 1)
      }
    }
    return map
  }) ?? new Map()

  const recommendations = useMemo(() => {
    if (!activeProfile || topics.length === 0) return []
    const daysUntilExam = Math.max(0, Math.ceil((new Date(activeProfile.examDate).getTime() - Date.now()) / 86400000))
    return computeDailyRecommendations({
      topics,
      subjects,
      daysUntilExam,
      dueFlashcardsByTopic,
    })
  }, [activeProfile, topics, subjects, dueFlashcardsByTopic])

  const upcomingAssignments = useLiveQuery(() => {
    const today = new Date().toISOString().slice(0, 10)
    const weekOut = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
    return db.assignments
      .where('dueDate')
      .between(today, weekOut, true, true)
      .filter(a => a.status !== 'done')
      .count()
  }) ?? 0

  const documentsCount = useLiveQuery(
    () => profileId
      ? db.documents.where('examProfileId').equals(profileId).count()
      : Promise.resolve(0),
    [profileId]
  ) ?? 0

  const conversationsCount = useLiveQuery(
    () => profileId
      ? db.conversations.where('examProfileId').equals(profileId).count()
      : Promise.resolve(0),
    [profileId]
  ) ?? 0

  const onboardingSteps = [
    { done: documentsCount > 0, label: t('dashboard.onboarding.uploadSource'), to: '/sources' },
    { done: conversationsCount > 0, label: t('dashboard.onboarding.chatTutor'), to: '/chat' },
    { done: !!activePlan, label: t('dashboard.onboarding.generatePlan'), to: '/study-plan' },
  ]
  const completedSteps = onboardingSteps.filter(s => s.done).length
  const showOnboarding = completedSteps < 2

  if (!activeProfile) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <h1 className="text-2xl font-bold text-[var(--text-heading)] mb-4">{t('dashboard.welcome')}</h1>
        <p className="text-[var(--text-muted)] mb-6">{t('dashboard.setupPrompt')}</p>
        <a href="/exam-profile" className="btn-primary px-6 py-2.5 inline-block">{t('dashboard.createProfile')}</a>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-heading)]">{activeProfile.name}</h1>
          <p className="text-sm text-[var(--text-muted)]">{t('dashboard.subtitle')}</p>
        </div>
      </div>

      {/* Quick Actions — hidden during onboarding */}
      {!showOnboarding && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          {([
            { icon: MessageCircle, label: t('dashboard.quickActions.aiTutor'), desc: t('dashboard.quickActions.aiTutorDesc'), to: '/chat' },
            { icon: ClipboardCheck, label: t('dashboard.quickActions.practiceExam'), desc: t('dashboard.quickActions.practiceExamDesc'), to: '/practice-exam' },
            { icon: Upload, label: t('dashboard.quickActions.uploadSources'), desc: t('dashboard.quickActions.uploadSourcesDesc'), to: '/sources' },
            { icon: Target, label: t('dashboard.quickActions.studyPlan'), desc: t('dashboard.quickActions.studyPlanDesc'), to: '/study-plan' },
          ] as const).map(({ icon: Icon, label, desc, to }) => (
            <Link key={to} to={to} className="glass-card glass-card-hover p-4 flex flex-col items-start gap-2 group">
              <div className="w-10 h-10 rounded-lg bg-[var(--accent-bg)] flex items-center justify-center">
                <Icon className="w-5 h-5 text-[var(--accent-text)]" />
              </div>
              <span className="font-semibold text-[var(--text-heading)] group-hover:text-[var(--accent-text)] transition-colors">{label}</span>
              <span className="text-sm text-[var(--text-muted)]">{desc}</span>
            </Link>
          ))}
        </div>
      )}

      {/* Hero Onboarding Checklist */}
      {showOnboarding && (
        <div className="glass-card p-6 mb-6 border border-[var(--accent-text)]/20">
          <div className="flex items-start gap-4 mb-4">
            {/* Progress ring */}
            <svg width="56" height="56" className="-rotate-90 flex-shrink-0">
              <circle cx="28" cy="28" r="22" fill="none" stroke="var(--border-card)" strokeWidth="4" />
              <circle
                cx="28" cy="28" r="22" fill="none"
                stroke="var(--accent-text)" strokeWidth="4" strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 22}
                strokeDashoffset={2 * Math.PI * 22 - (completedSteps / onboardingSteps.length) * 2 * Math.PI * 22}
                className="transition-all duration-500"
              />
            </svg>
            <div>
              <h2 className="text-xl font-bold text-[var(--text-heading)]">{t('dashboard.onboarding.heroTitle')}</h2>
              <p className="text-sm text-[var(--text-muted)]">{t('dashboard.onboarding.heroSubtitle')}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {onboardingSteps.map((step) => (
              <Link
                key={step.to}
                to={step.to}
                className={`p-3 rounded-xl flex items-center gap-3 transition-colors group ${
                  step.done
                    ? 'bg-green-500/10'
                    : 'bg-[var(--accent-bg)] hover:bg-[var(--accent-bg)]/80'
                }`}
              >
                {step.done ? (
                  <CheckCircle className="w-6 h-6 text-green-500 flex-shrink-0" />
                ) : (
                  <Circle className="w-6 h-6 text-[var(--accent-text)] flex-shrink-0" />
                )}
                <span className={`flex-1 font-medium ${step.done ? 'line-through text-[var(--text-muted)]' : 'text-[var(--text-body)]'}`}>
                  {step.label}
                </span>
                {!step.done && (
                  <ArrowRight className="w-5 h-5 text-[var(--text-muted)] group-hover:text-[var(--accent-text)] transition-colors" />
                )}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ExamCountdown — always visible */}
      {showOnboarding && (
        <div className="mb-4">
          <ExamCountdownCard examName={activeProfile.name} examDate={activeProfile.examDate} />
        </div>
      )}

      {/* Insights — always visible (has welcome branch for new users) */}
      <InsightCard insights={insights} />

      {/* Everything below is hidden during onboarding */}
      {!showOnboarding && (
        <>
          {/* Top row: Readiness + Countdown + Streak */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <div className="glass-card p-4 flex items-center justify-center relative">
              <ReadinessGauge value={readiness} />
            </div>
            <ExamCountdownCard examName={activeProfile.name} examDate={activeProfile.examDate} />
            <StudyStreakCard streak={streak} weeklyHours={weeklyHours} weeklyTarget={activeProfile.weeklyTargetHours} />
          </div>

          {/* Today's Priority Recommendations */}
          {recommendations.length > 0 && (
            <div className="mt-4">
              <TodaysPriorityCard recommendations={recommendations} />
            </div>
          )}

          {/* Middle row: Today's Plan + Weak Topics */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            {todaysPlan ? (
              <StudyPlanCard
                todaysPlan={todaysPlan}
                onToggleActivity={markActivityCompleted}
                replanSuggestion={replanSuggestion}
                onReplan={async () => {
                  const token = await getToken()
                  if (token && replanSuggestion) replanPlan(token, replanSuggestion)
                }}
              />
            ) : (
              <TodaysPlanCard dueTopics={dueTopics} dueFlashcardCount={dueFlashcards} upcomingAssignments={upcomingAssignments} />
            )}
            <WeakTopicsCard topics={weakTopics} subjects={subjects} />
          </div>

          {/* Source coverage indicator */}
          {sourceCoverage && sourceCoverage.totalTopics > 0 && (
            <div className="glass-card p-3 mt-4 flex items-center justify-between">
              <span className="text-sm text-[var(--text-body)]">
                <Trans
                  i18nKey="dashboard.sourceCoverage"
                  values={{ percent: sourceCoverage.coveragePercent }}
                  components={{ 1: <strong /> }}
                />
              </span>
              <a href="/sources" className="text-xs text-[var(--accent-text)] hover:underline">{t('dashboard.viewSources')}</a>
            </div>
          )}

          {/* Bottom row: Activity + Knowledge Graph */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <ActivityFeed sessions={sessions} />
            <div className="glass-card p-4">
              <h3 className="font-semibold text-[var(--text-heading)] mb-3">{t('dashboard.knowledgeGraph')}</h3>
              <TopicTree subjects={subjects} getTopicsForSubject={getTopicsForSubject} />
            </div>
          </div>

          {/* Session Insights */}
          {sessionInsights.length > 0 && (
            <div className="mt-4">
              <SessionInsightsCard insights={sessionInsights} />
            </div>
          )}
        </>
      )}
    </div>
  )
}
