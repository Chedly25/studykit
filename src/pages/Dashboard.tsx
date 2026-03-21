import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ArrowRight, Zap, ListTodo } from 'lucide-react'
import { isCramModeActive } from '../lib/cramModeEngine'
import { db } from '../db'
import type { StudySession } from '../db/schema'
import { useExamProfile } from '../hooks/useExamProfile'
import { useKnowledgeGraph } from '../hooks/useKnowledgeGraph'
import { useProfileMode } from '../hooks/useProfileMode'
import { useMilestones } from '../hooks/useMilestones'
import { useHabitGoals } from '../hooks/useHabitGoals'
import { useStudentModel } from '../hooks/useStudentModel'
import { useExerciseBank } from '../hooks/useExerciseBank'
import { MilestoneTrackerCard } from '../components/dashboard/MilestoneTrackerCard'
import { HabitGoalsCard } from '../components/dashboard/HabitGoalsCard'
import { LevelsView } from '../components/dashboard/LevelsView'
import { GettingStartedCard } from '../components/dashboard/GettingStartedCard'
import { StatusBar } from '../components/dashboard/StatusBar'
import { UpNextList } from '../components/dashboard/UpNextList'
import { computeDailyRecommendations } from '../lib/studyRecommender'
import { useIntelligence } from '../hooks/useIntelligence'
import { AttentionCard } from '../components/dashboard/AttentionCard'
import { AchievementsCard } from '../components/dashboard/AchievementsCard'

export default function Dashboard() {
  const { t } = useTranslation()
  const { activeProfile } = useExamProfile()
  const { isResearch } = useProfileMode()
  const profileId = activeProfile?.id
  const { milestones, doneCount, daysUntilNext, addMilestone, updateMilestone } = useMilestones(profileId)
  const { goals: habitGoals, getTodayProgress, addGoal: addHabitGoal, logProgress: logHabitProgress, deleteGoal: deleteHabitGoal } = useHabitGoals(profileId)
  const { subjects, chapters, topics, readiness, weakTopics, streak, freezeUsed, weeklyHours, getTopicsForSubject, getChaptersForSubject, getTopicsForChapter, dailyLogs } = useKnowledgeGraph(profileId)
  const { studentModel } = useStudentModel(profileId)
  const { getExerciseStatsByTopic: getExerciseStatsMap } = useExerciseBank(profileId)
  const exerciseStatsByTopic = useMemo(() => getExerciseStatsMap(), [getExerciseStatsMap])
  const { signals } = useIntelligence(topics, subjects, profileId)

  const sessions = useLiveQuery(
    () => profileId
      ? db.studySessions.where('examProfileId').equals(profileId).toArray()
      : Promise.resolve([] as StudySession[]),
    [profileId]
  ) ?? []

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

  const showCramBanner = activeProfile?.examDate
    ? isCramModeActive(activeProfile.examDate)
    : false

  const [cramActive, setCramActive] = useState(() =>
    activeProfile?.id ? localStorage.getItem(`cramMode_${activeProfile.id}`) === 'true' : false
  )

  const toggleCramMode = () => {
    if (!activeProfile?.id) return
    const key = `cramMode_${activeProfile.id}`
    if (cramActive) {
      localStorage.removeItem(key)
      setCramActive(false)
    } else {
      localStorage.setItem(key, 'true')
      setCramActive(true)
    }
  }

  // Block 2B: Check for mid-progress queue
  const queueInProgress = useMemo(() => {
    if (!profileId) return false
    const today = new Date().toISOString().slice(0, 10)
    try {
      const saved = localStorage.getItem(`queue_progress_${profileId}_${today}`)
      if (!saved) return false
      const progress = JSON.parse(saved)
      return progress.completedIds?.length > 0
    } catch {
      return false
    }
  }, [profileId])

  if (!activeProfile) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <h1 className="text-2xl font-bold text-[var(--text-heading)] mb-4">{t('dashboard.welcome')}</h1>
        <p className="text-[var(--text-muted)] mb-6">{t('dashboard.setupPrompt')}</p>
        <Link to="/exam-profile" className="btn-primary px-6 py-2.5 inline-block">{t('dashboard.createProfile')}</Link>
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

      {/* Cram Mode Banner */}
      {showCramBanner && daysUntilExam !== undefined && (
        <div className={`flex items-center justify-between w-full px-4 py-3 mb-3 rounded-xl ${cramActive ? 'bg-red-500/15 border border-red-500/30' : 'bg-orange-500/10 border border-orange-500/20'}`}>
          <div className="flex items-center gap-2">
            <Zap className={`w-4 h-4 ${cramActive ? 'text-red-500' : 'text-orange-500'}`} />
            <span className="text-sm font-medium text-[var(--text-heading)]">
              {cramActive ? 'Cram Mode Active' : `Exam in ${daysUntilExam} day${daysUntilExam !== 1 ? 's' : ''}`}
            </span>
          </div>
          <button
            onClick={toggleCramMode}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
              cramActive
                ? 'bg-red-500/20 text-red-600 hover:bg-red-500/30'
                : 'bg-orange-500/20 text-orange-600 hover:bg-orange-500/30'
            }`}
          >
            {cramActive ? 'Deactivate' : 'Activate Cram Mode'}
          </button>
        </div>
      )}

      {/* Queue CTA — unified resume/start */}
      {topics.length > 0 && (
        <Link
          to="/queue"
          className={`flex items-center justify-between w-full px-6 py-4 mb-3 rounded-xl font-semibold text-base hover:opacity-90 transition-opacity ${
            queueInProgress
              ? 'bg-amber-500 text-white'
              : 'bg-[var(--accent-text)] text-white'
          }`}
        >
          <div className="flex items-center gap-3">
            <ListTodo className="w-5 h-5" />
            <span>{queueInProgress ? "Resume Today's Queue" : "Start Today's Queue"}</span>
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

      {/* Up Next — top 3 recommendations with action-specific links */}
      <UpNextList recommendations={recommendations} />

      {/* Attention — proactive intelligence signals */}
      <AttentionCard signals={signals} />

      {/* Levels View — Subject > Chapter > Topic with mastery */}
      <LevelsView
        subjects={subjects}
        chapters={chapters}
        topics={topics}
        exerciseStatsByTopic={exerciseStatsByTopic}
        getChaptersForSubject={getChaptersForSubject}
        getTopicsForChapter={getTopicsForChapter}
      />

      {/* Achievements */}
      {profileId && <AchievementsCard examProfileId={profileId} />}

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
