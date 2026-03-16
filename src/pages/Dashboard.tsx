import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useTranslation, Trans } from 'react-i18next'
import { Link } from 'react-router-dom'
import { MessageCircle, ClipboardCheck, Upload, Target, PenTool, BookOpen, Users } from 'lucide-react'
import { db } from '../db'
import type { StudySession } from '../db/schema'
import { useExamProfile } from '../hooks/useExamProfile'
import { useKnowledgeGraph } from '../hooks/useKnowledgeGraph'
import { useProactiveInsights } from '../hooks/useProactiveInsights'
import { useSessionInsights } from '../hooks/useSessionInsights'
import { useSourceCoverage } from '../hooks/useSourceCoverage'
import { useProfileMode } from '../hooks/useProfileMode'
import { useMilestones } from '../hooks/useMilestones'
import { useHabitGoals } from '../hooks/useHabitGoals'
import { ReadinessGauge } from '../components/dashboard/ReadinessGauge'
import { ExamCountdownCard } from '../components/dashboard/ExamCountdownCard'
import { StudyStreakCard } from '../components/dashboard/StudyStreakCard'
import { ActivityFeed } from '../components/dashboard/ActivityFeed'
import { InsightCard } from '../components/dashboard/InsightCard'
import { SessionInsightsCard } from '../components/dashboard/SessionInsightsCard'
import { TopicTree } from '../components/knowledge/TopicTree'
import { MilestoneTrackerCard } from '../components/dashboard/MilestoneTrackerCard'
import { ResearchThreadsCard } from '../components/dashboard/ResearchThreadsCard'
import { HabitGoalsCard } from '../components/dashboard/HabitGoalsCard'
import { GettingStartedCard } from '../components/dashboard/GettingStartedCard'
import { WelcomeHero } from '../components/dashboard/WelcomeHero'
import { IntelligenceBriefCard } from '../components/dashboard/IntelligenceBriefCard'
import { LandscapeCard } from '../components/dashboard/LandscapeCard'
import { DecisionConsoleCard } from '../components/dashboard/DecisionConsoleCard'
import { computeDailyRecommendations } from '../lib/studyRecommender'

export default function Dashboard() {
  const { t } = useTranslation()
  const { activeProfile } = useExamProfile()
  const { isResearch } = useProfileMode()
  const profileId = activeProfile?.id
  const { milestones, doneCount, daysUntilNext, addMilestone, updateMilestone } = useMilestones(profileId)
  const { goals: habitGoals, getTodayProgress, addGoal: addHabitGoal, logProgress: logHabitProgress, deleteGoal: deleteHabitGoal } = useHabitGoals(profileId)
  const { subjects, topics, readiness, weakTopics, streak, weeklyHours, getTopicsForSubject } = useKnowledgeGraph(profileId)
  const insights = useProactiveInsights(profileId)
  const { recentInsights: sessionInsights } = useSessionInsights(profileId)
  const { coverage: sourceCoverage } = useSourceCoverage(profileId)

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
    const daysUntilExam = activeProfile.examDate
      ? Math.max(0, Math.ceil((new Date(activeProfile.examDate).getTime() - Date.now()) / 86400000))
      : 30 // Default urgency for no-deadline profiles
    return computeDailyRecommendations({
      topics,
      subjects,
      daysUntilExam,
      dueFlashcardsByTopic,
    })
  }, [activeProfile, topics, subjects, dueFlashcardsByTopic])

  const documentsCount = useLiveQuery(
    () => profileId
      ? db.documents.where('examProfileId').equals(profileId).count()
      : Promise.resolve(0),
    [profileId]
  ) ?? 0

  const hasActivity = sessions.length > 0 || topics.some(t => t.questionsAttempted > 0)
  const isBrandNew = documentsCount === 0 && !hasActivity

  const [welcomeDismissed, setWelcomeDismissed] = useState(() => {
    try { return sessionStorage.getItem('welcomeHeroDismissed') === '1' } catch { return false }
  })

  if (!activeProfile) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <h1 className="text-2xl font-bold text-[var(--text-heading)] mb-4">{t('dashboard.welcome')}</h1>
        <p className="text-[var(--text-muted)] mb-6">{t('dashboard.setupPrompt')}</p>
        <a href="/exam-profile" className="btn-primary px-6 py-2.5 inline-block">{t('dashboard.createProfile')}</a>
      </div>
    )
  }

  if (isBrandNew && !welcomeDismissed) {
    return (
      <WelcomeHero
        profileName={activeProfile.name}
        isResearch={isResearch}
        topics={topics}
        subjects={subjects}
        onSkip={() => {
          setWelcomeDismissed(true)
          try { sessionStorage.setItem('welcomeHeroDismissed', '1') } catch { /* noop */ }
        }}
      />
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-heading)]">{activeProfile.name}</h1>
          <p className="text-sm text-[var(--text-muted)]">{t('dashboard.subtitle')}</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {(isResearch ? [
          { icon: MessageCircle, label: t('research.quickActions.researchPartner'), desc: t('research.quickActions.researchPartnerDesc'), to: '/chat' },
          { icon: PenTool, label: t('research.quickActions.writingSession'), desc: t('research.quickActions.writingSessionDesc'), to: '/writing' },
          { icon: BookOpen, label: t('research.quickActions.uploadPapers'), desc: t('research.quickActions.uploadPapersDesc'), to: '/sources' },
          { icon: Users, label: t('research.quickActions.meetings'), desc: t('research.quickActions.meetingsDesc'), to: '/meetings' },
        ] : [
          { icon: MessageCircle, label: t('dashboard.quickActions.aiTutor'), desc: t('dashboard.quickActions.aiTutorDesc'), to: '/chat' },
          { icon: ClipboardCheck, label: t('dashboard.quickActions.practiceExam'), desc: t('dashboard.quickActions.practiceExamDesc'), to: '/practice-exam' },
          { icon: Upload, label: t('dashboard.quickActions.uploadSources'), desc: t('dashboard.quickActions.uploadSourcesDesc'), to: '/sources' },
          { icon: Target, label: t('dashboard.quickActions.studyPlan'), desc: t('dashboard.quickActions.studyPlanDesc'), to: '/study-plan' },
        ]).map(({ icon: Icon, label, desc, to }) => (
          <Link key={to} to={to} className="glass-card glass-card-hover p-4 flex flex-col items-start gap-2 group">
            <div className="w-10 h-10 rounded-lg bg-[var(--accent-bg)] flex items-center justify-center">
              <Icon className="w-5 h-5 text-[var(--accent-text)]" />
            </div>
            <span className="font-semibold text-[var(--text-heading)] group-hover:text-[var(--accent-text)] transition-colors">{label}</span>
            <span className="text-sm text-[var(--text-muted)]">{desc}</span>
          </Link>
        ))}
      </div>

      {/* Getting Started Card — dismissible, for new users */}
      <GettingStartedCard
        hasDocuments={documentsCount > 0}
        hasTopics={topics.length > 0}
        hasActivity={hasActivity}
      />

      {/* Insights — always visible */}
      <InsightCard insights={insights} />

      {/* Top row: Readiness + Countdown/Milestones + Streak */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
        <div className="glass-card p-4 flex items-center justify-center relative">
          <ReadinessGauge
            value={readiness}
            label={isResearch ? t('research.researchDepth') : undefined}
          />
        </div>
        {isResearch ? (
          <MilestoneTrackerCard
            milestones={milestones}
            doneCount={doneCount}
            daysUntilNext={daysUntilNext}
            onAdd={addMilestone}
            onUpdate={updateMilestone}
          />
        ) : activeProfile.examDate ? (
          <ExamCountdownCard examName={activeProfile.name} examDate={activeProfile.examDate} />
        ) : (
          <MilestoneTrackerCard
            milestones={milestones}
            doneCount={doneCount}
            daysUntilNext={daysUntilNext}
            onAdd={addMilestone}
            onUpdate={updateMilestone}
          />
        )}
        <StudyStreakCard streak={streak} weeklyHours={weeklyHours} weeklyTarget={activeProfile.weeklyTargetHours} />
      </div>

      {/* Decision Console — study mode only, full width */}
      {!isResearch && (
        <div className="mt-4">
          <DecisionConsoleCard
            recommendations={recommendations}
            dueFlashcardCount={dueFlashcards}
            hasTopics={topics.length > 0}
          />
        </div>
      )}

      {/* Middle row: Intelligence Brief + Landscape / Research Threads */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        <IntelligenceBriefCard
          recommendations={recommendations}
          insights={insights}
          dueFlashcardCount={dueFlashcards}
        />
        {isResearch ? (
          <ResearchThreadsCard topics={weakTopics.length > 0 ? weakTopics : topics} subjects={subjects} />
        ) : (
          <LandscapeCard topics={topics} subjects={subjects} />
        )}
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
          <TopicTree subjects={subjects} getTopicsForSubject={getTopicsForSubject} showStatus={isResearch} />
        </div>
      </div>

      {/* Habit Goals */}
      {(habitGoals.length > 0 || isResearch) && (
        <div className="mt-4">
          <HabitGoalsCard
            goals={habitGoals}
            getTodayProgress={getTodayProgress}
            onAdd={addHabitGoal}
            onLog={logHabitProgress}
            onDelete={deleteHabitGoal}
          />
        </div>
      )}

      {/* Session Insights */}
      {sessionInsights.length > 0 && (
        <div className="mt-4">
          <SessionInsightsCard insights={sessionInsights} />
        </div>
      )}
    </div>
  )
}
