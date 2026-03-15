import { useLiveQuery } from 'dexie-react-hooks'
import { useTranslation, Trans } from 'react-i18next'
import { Link } from 'react-router-dom'
import { MessageCircle, ClipboardCheck, Upload, Target, CheckCircle, Circle, ArrowRight } from 'lucide-react'
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

export default function Dashboard() {
  const { t } = useTranslation()
  const { activeProfile } = useExamProfile()
  const profileId = activeProfile?.id
  const { subjects, readiness, weakTopics, dueTopics, streak, weeklyHours, getTopicsForSubject } = useKnowledgeGraph(profileId)
  const insights = useProactiveInsights(profileId)
  const { recentInsights: sessionInsights } = useSessionInsights(profileId)
  const { coverage: sourceCoverage } = useSourceCoverage(profileId)
  const { activePlan, todaysPlan, markActivityCompleted } = useStudyPlan(profileId)

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
    { done: sessions.length > 0, label: t('dashboard.onboarding.startSession'), to: '/practice-exam' },
    { done: conversationsCount > 0, label: t('dashboard.onboarding.chatTutor'), to: '/chat' },
    { done: !!activePlan, label: t('dashboard.onboarding.generatePlan'), to: '/study-plan' },
  ]
  const completedSteps = onboardingSteps.filter(s => s.done).length
  const showOnboarding = completedSteps < 3

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

      {/* Quick Actions */}
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

      {/* Onboarding Checklist */}
      {showOnboarding && (
        <div className="glass-card p-4 mb-4">
          <h3 className="font-semibold text-[var(--text-heading)] mb-1">{t('dashboard.onboarding.title')}</h3>
          <p className="text-sm text-[var(--text-muted)] mb-3">
            {t('dashboard.onboarding.subtitle', { completed: completedSteps, total: onboardingSteps.length })}
          </p>
          <div className="flex flex-col gap-2">
            {onboardingSteps.map((step) => (
              <Link
                key={step.to}
                to={step.to}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-[var(--accent-bg)] transition-colors group"
              >
                {step.done ? (
                  <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                ) : (
                  <Circle className="w-5 h-5 text-[var(--text-muted)] opacity-40 flex-shrink-0" />
                )}
                <span className={`flex-1 text-sm ${step.done ? 'line-through text-[var(--text-muted)]' : 'text-[var(--text-body)]'}`}>
                  {step.label}
                </span>
                {!step.done && (
                  <ArrowRight className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--accent-text)] transition-colors" />
                )}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Insights */}
      <InsightCard insights={insights} />

      {/* Top row: Readiness + Countdown + Streak */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
        <div className="glass-card p-4 flex items-center justify-center relative">
          <ReadinessGauge value={readiness} />
        </div>
        <ExamCountdownCard examName={activeProfile.name} examDate={activeProfile.examDate} />
        <StudyStreakCard streak={streak} weeklyHours={weeklyHours} weeklyTarget={activeProfile.weeklyTargetHours} />
      </div>

      {/* Middle row: Today's Plan + Weak Topics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        {todaysPlan ? (
          <StudyPlanCard todaysPlan={todaysPlan} onToggleActivity={markActivityCompleted} />
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
    </div>
  )
}
