import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ArrowRight, Zap, MessageCircle, Loader2, AlertTriangle, TrendingUp, TrendingDown, FolderOpen, ClipboardCheck } from 'lucide-react'
import { useUser } from '@clerk/clerk-react'
import { isCramModeActive } from '../lib/cramModeEngine'
import { db } from '../db'
import { useExamProfile } from '../hooks/useExamProfile'
import { useKnowledgeGraph } from '../hooks/useKnowledgeGraph'
import { TutorDirectory } from '../components/TutorDirectory'
import { NextStepsCard } from '../components/dashboard/NextStepsCard'
import { CelebrationBanner } from '../components/CelebrationBanner'
import { useSubscription } from '../hooks/useSubscription'
import { useDailyQueue } from '../hooks/useDailyQueue'
import { DashboardIntelligenceBrief } from '../components/dashboard/DashboardIntelligenceBrief'
import { WeeklyScheduleCard } from '../components/dashboard/WeeklyScheduleCard'
import { DataLocalBanner } from '../components/dashboard/DataLocalBanner'

function getGreetingKey(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'dashboard.greetingMorning'
  if (hour < 18) return 'dashboard.greetingAfternoon'
  return 'dashboard.greetingEvening'
}

export default function Dashboard() {
  const { t } = useTranslation()
  const { user } = useUser()
  const { activeProfile } = useExamProfile()
  const profileId = activeProfile?.id
  const { subjects, topics, streak } = useKnowledgeGraph(profileId)
  const { queue: dailyQueue } = useDailyQueue(profileId)
  const { isPro } = useSubscription()

  const dueFlashcardCount = useLiveQuery(async () => {
    const today = new Date().toISOString().slice(0, 10)
    return db.flashcards.where('nextReviewDate').belowOrEqual(today).count()
  }) ?? 0

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

  // (Course documents, exam sources, student model moved to Sources/Settings pages)

  // Exercise counts for NextSteps
  const exerciseCounts = useLiveQuery(
    async () => {
      if (!profileId) return { total: 0, attempts: 0 }
      const total = await db.exercises.where('examProfileId').equals(profileId).filter(e => !e.hidden).count()
      const attempts = await db.exerciseAttempts.where('examProfileId').equals(profileId).count()
      return { total, attempts }
    },
    [profileId],
  ) ?? { total: 0, attempts: 0 }

  // Practice exam count for NextSteps
  const practiceExamCount = useLiveQuery(
    () => profileId ? db.practiceExamSessions.where('examProfileId').equals(profileId).count() : 0,
    [profileId],
  ) ?? 0

  // Study plan for NextSteps
  const hasStudyPlan = useLiveQuery(
    async () => {
      if (!profileId) return false
      const plan = await db.studyPlans.where('examProfileId').equals(profileId).filter(p => p.isActive).first()
      return !!plan
    },
    [profileId],
  ) ?? false

  // All documents for NextSteps
  const allDocuments = useLiveQuery(
    () => profileId ? db.documents.where('examProfileId').equals(profileId).toArray() : [],
    [profileId],
  ) ?? []

  // Macro roadmap active phase
  const activePhase = useLiveQuery(async () => {
    if (!profileId) return null
    try {
      const roadmap = await db.macroRoadmaps.get(profileId)
      if (!roadmap) return null
      const phases = JSON.parse(roadmap.phases) as Array<{ name: string; status: string; startDate: string; endDate: string }>
      return phases.find(p => p.status === 'active') ?? null
    } catch { return null }
  }, [profileId]) ?? null

  // Detect newly created profile with active background jobs
  const isNewProfile = useMemo(() => {
    if (!activeProfile?.createdAt) return false
    const createdMs = new Date(activeProfile.createdAt).getTime()
    return Date.now() - createdMs < 5 * 60 * 1000 // within 5 minutes
  }, [activeProfile?.createdAt])

  const activeJobCount = useLiveQuery(async () => {
    if (!profileId || !isNewProfile) return 0
    return db.backgroundJobs
      .where('[examProfileId+status]').equals([profileId, 'running'])
      .count()
      .then(running => db.backgroundJobs
        .where('[examProfileId+status]').equals([profileId, 'queued'])
        .count()
        .then(queued => running + queued)
      )
  }, [profileId, isNewProfile]) ?? 0

  const showSettingUp = isNewProfile && activeJobCount > 0

  // Behind schedule detection
  const missedPlanDays = useLiveQuery(async () => {
    if (!profileId) return 0
    const plan = await db.studyPlans.where('examProfileId').equals(profileId).filter(p => p.isActive).first()
    if (!plan) return 0
    const today = new Date().toISOString().slice(0, 10)
    const days = await db.studyPlanDays.where('planId').equals(plan.id).toArray()
    return days.filter(d => d.date < today && !d.isCompleted).length
  }, [profileId]) ?? 0

  // Predicted score from past simulation exams
  const predictedScore = useLiveQuery(async () => {
    if (!profileId) return null
    const sims = await db.practiceExamSessions
      .where('examProfileId').equals(profileId)
      .filter(s => !!s.simulationMode && s.phase === 'graded' && s.totalScore != null && s.maxScore != null && s.maxScore! > 0)
      .toArray()
    if (sims.length < 2) return null
    const sorted = sims.sort((a, b) => (a.completedAt ?? '').localeCompare(b.completedAt ?? ''))
    const recent = sorted.slice(-5)
    let weightedSum = 0, weightTotal = 0
    recent.forEach((s, i) => {
      const weight = i + 1
      weightedSum += (s.totalScore! / s.maxScore!) * 100 * weight
      weightTotal += weight
    })
    const predicted = Math.round(weightedSum / weightTotal)
    const trend = recent.length >= 2
      ? (recent[recent.length - 1].totalScore! / recent[recent.length - 1].maxScore!) >
        (recent[recent.length - 2].totalScore! / recent[recent.length - 2].maxScore!)
        ? 'up' as const : 'down' as const
      : null
    return { predicted, trend, count: sims.length }
  }, [profileId]) ?? null

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
      {/* Cram Mode Banner */}
      {showCramBanner && daysUntilExam !== undefined && (
        <div className={`flex items-center justify-between w-full px-4 py-3 mb-3 rounded-xl ${cramActive ? 'bg-red-500/15 border border-red-500/30' : 'bg-orange-500/10 border border-orange-500/20'}`}>
          <div className="flex items-center gap-2">
            <Zap className={`w-4 h-4 ${cramActive ? 'text-red-500' : 'text-orange-500'}`} />
            <span className="text-sm font-medium text-[var(--text-heading)]">
              {cramActive ? t('dashboard.cramModeActive') : t('dashboard.examInDays', { count: daysUntilExam })}
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
            {cramActive ? t('dashboard.deactivate') : t('dashboard.activateCramMode')}
          </button>
        </div>
      )}

      {/* Celebration Banner */}
      {profileId && <CelebrationBanner examProfileId={profileId} streak={streak} />}

      {/* Setting up indicator for new profiles */}
      {showSettingUp && (
        <div className="flex items-center gap-3 px-4 py-3 mb-3 rounded-xl bg-[var(--accent-bg)] border border-[var(--accent-text)]/20 animate-fade-in">
          <Loader2 className="w-4 h-4 text-[var(--accent-text)] animate-spin shrink-0" />
          <div>
            <span className="text-sm font-medium text-[var(--text-heading)]">{t('dashboard.settingUp')}</span>
            <span className="text-xs text-[var(--text-muted)] block">{t('dashboard.settingUpDesc')}</span>
          </div>
        </div>
      )}

      {/* Data local warning for free users */}
      <DataLocalBanner isPro={isPro} />

      {/* ─── Hero Section ─── */}
      <div className="mb-6">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--text-heading)]">
          {t(getGreetingKey(), { name: user?.firstName || activeProfile.name })}
        </h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          {streak > 0 && <span>{t('session.dayStreak', { count: streak })}</span>}
          {streak > 0 && daysUntilExam !== undefined && <span> · </span>}
          {daysUntilExam !== undefined && <span>{t('dashboard.daysToGo', { count: daysUntilExam })}</span>}
          {activePhase && <span className="text-[var(--accent-text)]"> · {activePhase.name}</span>}
        </p>
        {predictedScore && (
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-sm font-bold ${predictedScore.predicted >= (activeProfile.passingThreshold ?? 60) ? 'text-emerald-500' : 'text-amber-500'}`}>
              {t('dashboard.predicted', 'Predicted: {{score}}%', { score: predictedScore.predicted })}
            </span>
            <span className="text-xs text-[var(--text-faint)]">
              ({t('dashboard.passing', 'passing: {{threshold}}%', { threshold: activeProfile.passingThreshold ?? 60 })})
            </span>
            {predictedScore.trend === 'up' && <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />}
            {predictedScore.trend === 'down' && <TrendingDown className="w-3.5 h-3.5 text-red-500" />}
          </div>
        )}

        {/* Primary CTA */}
        {dailyQueue.length > 0 ? (
          <Link
            to="/queue"
            className="btn-primary w-full py-3.5 text-sm font-medium text-center flex items-center justify-center gap-2 mt-4"
          >
            {queueInProgress
              ? t('dashboard.continueSession', 'Continue session')
              : t('dashboard.startSessionCta', 'Start today\'s session — {{count}} items, ~{{minutes}} min', {
                  count: dailyQueue.length,
                  minutes: dailyQueue.reduce((s, q) => s + q.estimatedMinutes, 0),
                })
            }
            <ArrowRight className="w-4 h-4" />
          </Link>
        ) : (() => {
          // Check if user is new (low mastery, hasn't really started)
          const avgMastery = topics.length > 0
            ? topics.reduce((s, t) => s + t.mastery, 0) / topics.length
            : 0
          const isNewUser = avgMastery < 0.15 && topics.length > 0

          return isNewUser ? (
            <div className="glass-card p-5 mt-4 text-center space-y-3">
              <p className="text-sm font-semibold text-[var(--text-heading)]">{t('dashboard.getStarted', "Get started")}</p>
              <p className="text-xs text-[var(--text-muted)]">{t('dashboard.getStartedHint', 'Upload your course materials or take a practice exam to begin.')}</p>
              <div className="flex gap-2 justify-center flex-wrap">
                <Link to="/sources" className="btn-secondary py-2 px-4 text-sm flex items-center gap-2">
                  <FolderOpen className="w-4 h-4" /> {t('dashboard.uploadMaterials', 'Upload materials')}
                </Link>
                <Link to="/practice-exam" className="btn-primary py-2 px-4 text-sm flex items-center gap-2">
                  <ClipboardCheck className="w-4 h-4" /> {t('dashboard.startFirstExam', 'Take a practice exam')}
                </Link>
              </div>
            </div>
          ) : (
            <div className="glass-card p-4 mt-4 text-center">
              <p className="text-sm font-medium text-[var(--text-heading)]">{t('dashboard.allCaughtUp')}</p>
              <div className="flex gap-2 mt-3 justify-center">
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent('open-chat-panel', { detail: {} }))}
                  className="btn-secondary py-2 px-4 text-sm flex items-center gap-2"
                >
                  <MessageCircle className="w-4 h-4" /> {t('dashboard.talkToTutor')}
                </button>
              </div>
            </div>
          )
        })()}
      </div>

      {/* ─── This Week Schedule ─── */}
      <WeeklyScheduleCard examProfileId={profileId} />

      {/* Behind schedule banner */}
      {missedPlanDays > 0 && (
        <Link to="/study-plan" className="glass-card p-3 mb-4 flex items-center gap-2 border-l-4 border-amber-500 hover:bg-[var(--bg-input)]/30 transition-colors block">
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
          <span className="text-sm text-[var(--text-body)] flex-1">
            {t('dashboard.behindSchedule', 'You\'re {{count}} days behind schedule', { count: missedPlanDays })}
          </span>
          <ArrowRight className="w-3.5 h-3.5 text-[var(--text-muted)]" />
        </Link>
      )}

      {/* ─── Advisor Section ─── */}
      {profileId && <DashboardIntelligenceBrief examProfileId={profileId} />}

      <NextStepsCard
        topics={topics}
        documents={allDocuments}
        dueFlashcardCount={dueFlashcardCount}
        dailyQueue={dailyQueue}
        exerciseCount={exerciseCounts.total}
        exerciseAttemptCount={exerciseCounts.attempts}
        practiceExamCount={practiceExamCount}
        hasStudyPlan={hasStudyPlan}
        queueStartedToday={queueInProgress}
        isPro={isPro}
      />

      {/* ─── Subjects ─── */}
      {subjects.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">{t('dashboard.yourTutors')}</p>
          <TutorDirectory subjects={subjects} topics={topics} />
        </div>
      )}
    </div>
  )
}
