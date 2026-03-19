import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ArrowRight, Rocket } from 'lucide-react'
import { db } from '../db'
import type { StudySession } from '../db/schema'
import { useExamProfile } from '../hooks/useExamProfile'
import { useKnowledgeGraph } from '../hooks/useKnowledgeGraph'
import { useProfileMode } from '../hooks/useProfileMode'
import { useMilestones } from '../hooks/useMilestones'
import { useHabitGoals } from '../hooks/useHabitGoals'
import { useStudentModel } from '../hooks/useStudentModel'
import { MilestoneTrackerCard } from '../components/dashboard/MilestoneTrackerCard'
import { HabitGoalsCard } from '../components/dashboard/HabitGoalsCard'
import { GettingStartedCard } from '../components/dashboard/GettingStartedCard'
import { StatusBar } from '../components/dashboard/StatusBar'
import { HeroFocusCard } from '../components/dashboard/HeroFocusCard'
import { UpNextList } from '../components/dashboard/UpNextList'
import { QuickAccessRow } from '../components/dashboard/QuickAccessRow'
import { computeDailyRecommendations } from '../lib/studyRecommender'

export default function Dashboard() {
  const { t } = useTranslation()
  const { activeProfile } = useExamProfile()
  const { isResearch } = useProfileMode()
  const profileId = activeProfile?.id
  const { milestones, doneCount, daysUntilNext, addMilestone, updateMilestone } = useMilestones(profileId)
  const { goals: habitGoals, getTodayProgress, addGoal: addHabitGoal, logProgress: logHabitProgress, deleteGoal: deleteHabitGoal } = useHabitGoals(profileId)
  const { subjects, topics, readiness, weakTopics, streak, freezeUsed, weeklyHours, getTopicsForSubject, dailyLogs } = useKnowledgeGraph(profileId)
  const { studentModel } = useStudentModel(profileId)

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

  // Load today's study plan activities for recommender plan awareness
  const todayPlanActivities = useLiveQuery(async () => {
    if (!profileId) return undefined
    const activePlan = await db.studyPlans
      .where('examProfileId').equals(profileId)
      .filter(p => p.isActive)
      .first()
    if (!activePlan) return undefined
    const today = new Date().toISOString().slice(0, 10)
    const planDayId = `${activePlan.id}:${today}`
    const planDay = await db.studyPlanDays.get(planDayId)
    if (!planDay) return undefined
    try {
      const activities = JSON.parse(planDay.activities) as Array<{ topicName: string; completed?: boolean }>
      return activities.map(a => ({ topicName: a.topicName, completed: a.completed ?? false }))
    } catch { return undefined }
  }, [profileId])

  const recommendations = useMemo(() => {
    if (!activeProfile || topics.length === 0) return []
    const daysUntilExam = activeProfile.examDate
      ? Math.max(0, Math.ceil((new Date(activeProfile.examDate).getTime() - Date.now()) / 86400000))
      : 30 // Default urgency for no-deadline profiles

    // Parse student model common mistakes
    let commonMistakes: string[] | undefined
    if (studentModel?.commonMistakes) {
      try { commonMistakes = JSON.parse(studentModel.commonMistakes) } catch { /* ignore */ }
    }

    // Build prerequisite graph and mastery map from topics
    const prerequisiteGraph = new Map<string, string[]>()
    const topicMasteryMap = new Map<string, number>()
    for (const t of topics) {
      topicMasteryMap.set(t.id, t.mastery)
      if (t.prerequisiteTopicIds && t.prerequisiteTopicIds.length > 0) {
        prerequisiteGraph.set(t.id, t.prerequisiteTopicIds)
      }
    }

    return computeDailyRecommendations({
      topics,
      subjects,
      daysUntilExam,
      dueFlashcardsByTopic,
      todayPlanActivities: todayPlanActivities ?? undefined,
      commonMistakes,
      prerequisiteGraph: prerequisiteGraph.size > 0 ? prerequisiteGraph : undefined,
      topicMasteryMap,
    })
  }, [activeProfile, topics, subjects, dueFlashcardsByTopic, todayPlanActivities, studentModel])

  const documentsCount = useLiveQuery(
    () => profileId
      ? db.documents.where('examProfileId').equals(profileId).count()
      : Promise.resolve(0),
    [profileId]
  ) ?? 0

  const hasActivity = sessions.length > 0 || topics.some(t => t.questionsAttempted > 0)

  const daysUntilExam = activeProfile?.examDate
    ? Math.max(0, Math.ceil((new Date(activeProfile.examDate).getTime() - Date.now()) / 86400000))
    : undefined

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
    <div className="max-w-2xl mx-auto px-4 py-6 animate-fade-in">
      {/* Getting Started Card — dismissible, for new users */}
      <GettingStartedCard
        hasDocuments={documentsCount > 0}
        hasTopics={topics.length > 0}
        hasActivity={hasActivity}
      />

      {/* Hero CTA — always visible when there's a recommendation */}
      {recommendations.length > 0 && (
        <Link
          to={recommendations[0].linkTo}
          className="flex items-center justify-between w-full px-6 py-4 mb-4 rounded-xl bg-[var(--accent-text)] text-white font-semibold text-base hover:opacity-90 transition-opacity"
        >
          <div className="flex items-center gap-3">
            {!hasActivity ? (
              <Rocket className="w-5 h-5" />
            ) : (
              <ArrowRight className="w-5 h-5" />
            )}
            <span>
              {!hasActivity
                ? t('dashboard.startFirstSession', 'Start your first session')
                : `${t('dashboard.continueStudying', 'Continue studying')}: ${recommendations[0].topicName}`
              }
            </span>
          </div>
          <ArrowRight className="w-5 h-5" />
        </Link>
      )}

      {/* StatusBar — only show once user has topics (metrics become meaningful) */}
      {topics.length > 0 && (
        <StatusBar
          streak={streak}
          freezeUsed={freezeUsed}
          readiness={readiness}
          examDate={activeProfile.examDate}
          weeklyHours={weeklyHours}
          weeklyTarget={activeProfile.weeklyTargetHours}
          daysUntilExam={daysUntilExam}
          milestoneProgress={{ done: doneCount, total: milestones.length }}
          isResearch={isResearch}
        />
      )}

      <HeroFocusCard
        recommendation={recommendations[0] ?? null}
        dueFlashcardCount={dueFlashcards}
        isResearch={isResearch}
        allCaughtUp={recommendations.length === 0 && topics.length > 0}
        hasTopics={topics.length > 0}
      />

      <UpNextList recommendations={recommendations.slice(1, 4)} />

      <QuickAccessRow isResearch={isResearch} dueFlashcardCount={dueFlashcards} />

      {/* Milestones (research) or Habit Goals */}
      {isResearch ? (
        <div className="mt-4">
          <MilestoneTrackerCard
            milestones={milestones}
            doneCount={doneCount}
            daysUntilNext={daysUntilNext}
            onAdd={addMilestone}
            onUpdate={updateMilestone}
          />
        </div>
      ) : habitGoals.length > 0 ? (
        <div className="mt-4">
          <HabitGoalsCard
            goals={habitGoals}
            getTodayProgress={getTodayProgress}
            onAdd={addHabitGoal}
            onLog={logHabitProgress}
            onDelete={deleteHabitGoal}
          />
        </div>
      ) : null}
    </div>
  )
}
