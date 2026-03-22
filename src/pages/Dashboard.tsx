import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ArrowRight, Zap, ListTodo, ClipboardCheck, FileText, AlertCircle, MessageCircle } from 'lucide-react'
import { useUser } from '@clerk/clerk-react'
import { isCramModeActive } from '../lib/cramModeEngine'
import { db } from '../db'
import { useExamProfile } from '../hooks/useExamProfile'
import { useKnowledgeGraph } from '../hooks/useKnowledgeGraph'
import { useTopicStats } from '../hooks/useTopicStats'
import { TutorDirectory } from '../components/TutorDirectory'
import { NextStepsCard } from '../components/dashboard/NextStepsCard'
import { LearningProfileCard } from '../components/dashboard/LearningProfileCard'
import { CalibrationAlert } from '../components/dashboard/CalibrationAlert'
import { CelebrationBanner } from '../components/CelebrationBanner'
import { ResourceScoutCard } from '../components/ResourceScoutCard'
import { useSubscription } from '../hooks/useSubscription'
import { useDailyQueue } from '../hooks/useDailyQueue'

function getGreeting(name: string): string {
  const hour = new Date().getHours()
  if (hour < 12) return `Good morning, ${name}.`
  if (hour < 18) return `Good afternoon, ${name}.`
  return `Good evening, ${name}.`
}

export default function Dashboard() {
  const { t } = useTranslation()
  const { user } = useUser()
  const { activeProfile } = useExamProfile()
  const profileId = activeProfile?.id
  const { subjects, topics, getChaptersForSubject, streak } = useKnowledgeGraph(profileId)
  const topicStats = useTopicStats(profileId)
  const { queue: dailyQueue, typeCounts, remainingMinutes: queueMinutes } = useDailyQueue(profileId)
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

  // Course documents
  const courseDocuments = useLiveQuery(
    async () => {
      if (!profileId) return []
      return db.documents.where('examProfileId').equals(profileId)
        .filter(d => d.category === 'course')
        .toArray()
    },
    [profileId],
  ) ?? []

  // Exam sources with exercise counts
  const examSources = useLiveQuery(
    async () => {
      if (!profileId) return []
      const sources = await db.examSources.where('examProfileId').equals(profileId).toArray()
      const exercises = await db.exercises.where('examProfileId').equals(profileId).toArray()
      return sources.map(source => {
        const exs = exercises.filter(e => e.examSourceId === source.id && !e.hidden)
        return {
          ...source,
          exerciseCount: exs.length,
          completedCount: exs.filter(e => e.status === 'completed').length,
        }
      })
    },
    [profileId],
  ) ?? []

  // Student model for Learning Profile card
  const studentModel = useLiveQuery(
    () => profileId ? db.studentModels.where('examProfileId').equals(profileId).first() : undefined,
    [profileId],
  )

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

  // Quick stats
  const topicsWithoutMaterial = useMemo(() => {
    return topics.filter(t => {
      const stats = topicStats.get(t.id)
      return !stats?.docs && !stats?.exercises
    }).length
  }, [topics, topicStats])

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

      {/* Celebration Banner */}
      {profileId && <CelebrationBanner examProfileId={profileId} streak={streak} />}

      {/* Welcome Header */}
      <div className="mb-6">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--text-heading)]">
          {getGreeting(user?.firstName || activeProfile.name)}
        </h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          {activeProfile.name}
          {daysUntilExam !== undefined && ` — ${daysUntilExam} day${daysUntilExam !== 1 ? 's' : ''} to go`}
        </p>
        {activePhase && (
          <p className="text-xs text-[var(--accent-text)] mt-1 font-medium">
            {activePhase.name}
          </p>
        )}
        <div className="flex gap-3 mt-4">
          <Link to="/queue" className="btn-primary flex-1 py-3 text-sm text-center flex items-center justify-center gap-2">
            Start Today's Session <ArrowRight className="w-4 h-4" />
          </Link>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('open-chat-panel', { detail: {} }))}
            className="btn-secondary flex-1 py-3 text-sm text-center flex items-center justify-center gap-2"
          >
            <MessageCircle className="w-4 h-4" /> Talk to a Tutor
          </button>
        </div>
      </div>

      {/* Next Steps */}
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

      {/* Resource Scout */}
      {profileId && <ResourceScoutCard examProfileId={profileId} />}

      {/* Calibration Alert */}
      {profileId && <CalibrationAlert topics={topics} profileId={profileId} />}

      {/* Subjects */}
      {subjects.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">Your Tutors</p>
          <TutorDirectory subjects={subjects} topics={topics} />
        </div>
      )}

      {/* AI Learning Profile */}
      <LearningProfileCard studentModel={studentModel} />

      {/* Your courses */}
      {courseDocuments.length > 0 && (
        <div className="glass-card p-4 mb-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">My Courses</p>
          <div className="space-y-1">
            {courseDocuments.map(doc => (
              <Link key={doc.id} to={`/read/${doc.id}`}
                className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-[var(--bg-input)] transition-colors">
                <FileText size={16} className="text-blue-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-[var(--text-heading)] truncate block">{doc.title}</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-[var(--text-muted)]" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Your exams */}
      {examSources.length > 0 && (
        <div className="glass-card p-4 mb-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">My Exams</p>
          <div className="space-y-1">
            {examSources.map(source => (
              <Link key={source.id} to={`/read/${source.documentId}`}
                className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-[var(--bg-input)] transition-colors">
                <ClipboardCheck size={16} className="text-orange-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-[var(--text-heading)] truncate block">
                    {source.name}{source.year ? ` ${source.year}` : ''}
                  </span>
                  <span className="text-xs text-[var(--text-faint)]">
                    {source.completedCount}/{source.exerciseCount} exercises completed
                  </span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-[var(--text-muted)]" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Topics needing material */}
      {topicsWithoutMaterial > 0 && (
        <Link to="/sources" className="glass-card p-4 mb-4 flex items-center gap-3 hover:bg-[var(--bg-input)]/30 transition-colors block">
          <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
          <div className="flex-1">
            <span className="text-sm font-medium text-[var(--text-heading)]">{topicsWithoutMaterial} topic{topicsWithoutMaterial !== 1 ? 's' : ''} without course material</span>
            <span className="text-xs text-[var(--text-faint)] block">Upload documents to cover them</span>
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-[var(--text-muted)]" />
        </Link>
      )}
    </div>
  )
}
