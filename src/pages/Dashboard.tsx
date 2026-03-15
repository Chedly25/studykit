import { useLiveQuery } from 'dexie-react-hooks'
import { useTranslation } from 'react-i18next'
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
  const { todaysPlan, markActivityCompleted } = useStudyPlan(profileId)

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
          <span className="text-sm text-[var(--text-body)]" dangerouslySetInnerHTML={{
            __html: t('dashboard.sourceCoverage', { percent: sourceCoverage.coveragePercent })
          }} />
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
