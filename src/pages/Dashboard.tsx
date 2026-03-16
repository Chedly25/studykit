import { useMemo, useState, useEffect, useCallback, useRef } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useTranslation, Trans } from 'react-i18next'
import { Link } from 'react-router-dom'
import { MessageCircle, ClipboardCheck, Upload, Target, Loader2 } from 'lucide-react'
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
import { OnboardingUpload } from '../components/dashboard/onboarding/OnboardingUpload'
import { OnboardingAssess } from '../components/dashboard/onboarding/OnboardingAssess'
import { OnboardingPlan } from '../components/dashboard/onboarding/OnboardingPlan'
import { extractTopicStructure, type ExtractionResult } from '../ai/topicExtractor'

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

  // Onboarding phase derivation
  const onboardingPhase = useMemo(() => {
    if (documentsCount === 0) return 'upload' as const
    if (topics.length === 0) return 'assess' as const
    if (!activePlan) return 'plan' as const
    return 'done' as const
  }, [documentsCount, topics.length, activePlan])

  const [extractedTopics, setExtractedTopics] = useState<ExtractionResult | null>(null)

  // Re-extraction for page refresh during assess phase
  const reExtractionAttempted = useRef(false)
  useEffect(() => {
    if (onboardingPhase === 'assess' && !extractedTopics && profileId && !reExtractionAttempted.current) {
      reExtractionAttempted.current = true
      ;(async () => {
        try {
          const token = await getToken()
          if (!token) return
          const result = await extractTopicStructure(profileId, token)
          setExtractedTopics(result)
        } catch {
          // User can refresh the page to retry
        }
      })()
    }
  }, [onboardingPhase, extractedTopics, profileId, getToken])

  const handleUploadComplete = useCallback((result: ExtractionResult) => {
    setExtractedTopics(result)
  }, [])

  const handleAssessComplete = useCallback(() => {
    // Topics are now in DB, phase auto-transitions to 'plan'
  }, [])

  const handlePlanComplete = useCallback(() => {
    // Plan is already in DB, phase auto-transitions to 'done'
  }, [])

  if (!activeProfile) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <h1 className="text-2xl font-bold text-[var(--text-heading)] mb-4">{t('dashboard.welcome')}</h1>
        <p className="text-[var(--text-muted)] mb-6">{t('dashboard.setupPrompt')}</p>
        <a href="/exam-profile" className="btn-primary px-6 py-2.5 inline-block">{t('dashboard.createProfile')}</a>
      </div>
    )
  }

  const showOnboarding = onboardingPhase !== 'done'

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

      {/* Onboarding: ExamCountdown always visible */}
      {showOnboarding && (
        <div className="mb-4">
          <ExamCountdownCard examName={activeProfile.name} examDate={activeProfile.examDate} />
        </div>
      )}

      {/* Insights — always visible (has welcome branch for new users) */}
      <InsightCard insights={insights} />

      {/* Onboarding Phase Components */}
      {onboardingPhase === 'upload' && profileId && (
        <div className="mt-4">
          <OnboardingUpload examProfileId={profileId} onComplete={handleUploadComplete} />
        </div>
      )}

      {onboardingPhase === 'assess' && profileId && extractedTopics && (
        <div className="mt-4">
          <OnboardingAssess
            examProfileId={profileId}
            extractedData={extractedTopics}
            onComplete={handleAssessComplete}
          />
        </div>
      )}

      {onboardingPhase === 'assess' && profileId && !extractedTopics && (
        <div className="mt-4 glass-card p-8 text-center">
          <Loader2 className="w-10 h-10 text-[var(--accent-text)] mx-auto mb-4 animate-spin" />
          <h3 className="text-lg font-semibold text-[var(--text-heading)]">
            {t('dashboard.onboarding.reAnalyzing')}
          </h3>
        </div>
      )}

      {onboardingPhase === 'plan' && profileId && (
        <div className="mt-4">
          <OnboardingPlan examProfileId={profileId} onComplete={handlePlanComplete} />
        </div>
      )}

      {/* Full dashboard — visible after onboarding */}
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
