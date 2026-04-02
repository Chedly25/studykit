/**
 * Unified Daily Queue — one queue, one "Next" button.
 * Route: /queue
 *
 * Block A: Fixed session time tracking
 * Block B: Inline AI explanations after bad ratings
 * Block C: Post-queue AI debrief
 * Block E: Local nudges between items
 */
import { useState, useEffect, useCallback, useRef, useMemo, Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import { ArrowRight, SkipForward, CheckCircle2, BookOpen, ListChecks, Brain, Zap, Loader2, X, Flag, ExternalLink, MessageCircle, AlertTriangle, BarChart3, Lightbulb, RefreshCw, Link2, Sparkles, Star } from 'lucide-react'
import { toast } from 'sonner'
import { db } from '../db'
import { useExamProfile } from '../hooks/useExamProfile'
import { useKnowledgeGraph } from '../hooks/useKnowledgeGraph'
import { useDailyQueue } from '../hooks/useDailyQueue'
import { useStudySession } from '../hooks/useStudySession'
import { DailyCoachingBrief } from '../components/queue/DailyCoachingBrief'
import { CelebrationBanner } from '../components/CelebrationBanner'
import { SessionStartOverlay } from '../components/SessionStartOverlay'
import { SessionCompletionOverlay, type SessionCompletionData } from '../components/SessionCompletionOverlay'
import { InlineAIExplanation } from '../components/queue/InlineAIExplanation'
import { decayedMastery } from '../lib/knowledgeGraph'
import { recomputeTopicMastery, advanceTopicSRS } from '../lib/topicMastery'
import { generateNotifications } from '../lib/notificationGenerator'
import { scheduleDailyReminder } from '../lib/pushNotifications'
import { checkAchievements, type AchievementDef } from '../lib/achievements'
import { showAchievementToast } from '../components/AchievementToast'
import { AchievementUnlockModal, MAJOR_ACHIEVEMENTS } from '../components/AchievementUnlockModal'
import { computeNudge, type SessionResult, type Nudge } from '../lib/queueNudges'
import { streamChat } from '../ai/client'
import { MathText } from '../components/MathText'
import { track } from '../lib/analytics'
import { trackContentInteraction } from '../lib/effectivenessTracker'
import { EmptyState } from '../components/EmptyState'
import { useSubscription } from '../hooks/useSubscription'
import { useVoiceInput } from '../hooks/useVoiceInput'
import { useAnswerEvaluator } from '../hooks/useAnswerEvaluator'
import { useExerciseAI } from '../hooks/useExerciseAI'
import { AnswerInput } from '../components/queue/AnswerInput'
import { EvaluationResult } from '../components/queue/EvaluationResult'
import type { QueueItem } from '../lib/dailyQueueEngine'
import type { VoiceInputState } from '../components/chat/ChatInput'

interface VoicePropsForAnswer {
  initialValue?: string
  onInitialValueConsumed: () => void
  voiceInput?: VoiceInputState
}

const SESSION_START_KEY = (profileId: string, date: string) => `session_start_${profileId}_${date}`
const CRAM_KEY = (profileId: string) => `cramMode_${profileId}`

type QueueItemType = 'flashcard-review' | 'exercise' | 'concept-quiz'

const TYPE_STYLES: Record<QueueItemType, { border: string; bg: string; icon: string; progressColor: string }> = {
  'flashcard-review': { border: 'border-l-4 border-purple-400', bg: '', icon: 'text-purple-500', progressColor: 'bg-purple-500' },
  'exercise':         { border: 'border-l-4 border-orange-400', bg: '', icon: 'text-orange-500', progressColor: 'bg-orange-500' },
  'concept-quiz':     { border: 'border-l-4 border-blue-400',   bg: '', icon: 'text-blue-500',   progressColor: 'bg-blue-500' },
}

export default function DailyQueue() {
  return (
    <Suspense fallback={
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--text-muted)] mx-auto" />
      </div>
    }>
      <DailyQueueContent />
    </Suspense>
  )
}

function DailyQueueContent() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { getToken } = useAuth()
  const { activeProfile } = useExamProfile()
  const profileId = activeProfile?.id
  const { topics, streak, weeklyHours } = useKnowledgeGraph(profileId)
  const { startSession, endSession } = useStudySession(profileId)
  const { isPro } = useSubscription()
  const voiceInput = useVoiceInput()
  const [voiceTranscription, setVoiceTranscription] = useState<string | null>(null)

  const voiceProps: VoicePropsForAnswer = {
    initialValue: voiceTranscription ?? undefined,
    onInitialValueConsumed: () => setVoiceTranscription(null),
    voiceInput: isPro ? {
      isRecording: voiceInput.isRecording,
      isTranscribing: voiceInput.isTranscribing,
      onStartRecording: voiceInput.startRecording,
      onStopRecording: async () => {
        const text = await voiceInput.stopRecording()
        if (text) setVoiceTranscription(text)
      },
      onCancelRecording: voiceInput.cancelRecording,
    } : undefined,
  }

  const today = new Date().toISOString().slice(0, 10)
  const [showStartOverlay, setShowStartOverlay] = useState(false)
  const [timeAvailable, setTimeAvailable] = useState<number | undefined>(undefined)
  const [showCompletion, setShowCompletion] = useState(false)
  const [isFirstSession, setIsFirstSession] = useState(false)
  const [achievementToShow, setAchievementToShow] = useState<AchievementDef | null>(null)
  const [conceptRevealed, setConceptRevealed] = useState(false)
  const [coachDismissed, setCoachDismissed] = useState(false)

  // Coach insight from Progress Monitor agent
  const coachInsight = useLiveQuery(async () => {
    if (!profileId || coachDismissed) return null
    const insight = await db.agentInsights.get(`progress-monitor:${profileId}`)
    if (!insight) return null
    try {
      const insights = JSON.parse(insight.data) as Array<{ type: string; urgency: string; title: string; message: string; surface: string; action?: { label: string; route: string } }>
      return insights.find(i => i.surface === 'queue') ?? null
    } catch { return null }
  }, [profileId, coachDismissed]) ?? null

  // Block A: Session tracking — refs ensure session starts regardless of overlay
  const sessionStartRef = useRef<number>(0)
  const sessionStartedRef = useRef(false)
  const [finalTimeSpent, setFinalTimeSpent] = useState(0)
  // Keep a ref to latest endSession to avoid stale closure in unmount cleanup
  const endSessionRef = useRef(endSession)
  endSessionRef.current = endSession

  // Block C: AI debrief
  const [aiDebrief, setAiDebrief] = useState('')
  const [isDebriefStreaming, setIsDebriefStreaming] = useState(false)

  // Block E: Session results tracking + nudges
  const sessionResults = useRef<SessionResult[]>([])
  const [currentNudge, setCurrentNudge] = useState<Nudge | null>(null)

  // Priority 4: Pre-session mastery snapshot for computing deltas at completion
  const preMastery = useRef<Map<string, number>>(new Map())

  // Feature 5: Elapsed time
  const [elapsedMinutes, setElapsedMinutes] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      if (sessionStartRef.current > 0) {
        setElapsedMinutes(Math.floor((Date.now() - sessionStartRef.current) / 60000))
      }
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  const cramMode = profileId ? localStorage.getItem(CRAM_KEY(profileId)) === 'true' : false

  const {
    queue, currentItem, completedCount, totalCount,
    remainingMinutes, completeItem, skipItem, retryItem, isQueueEmpty,
  } = useDailyQueue(profileId, timeAvailable, cramMode)

  // Show start overlay on first visit today — but only if there are items
  useEffect(() => {
    if (!profileId) return
    if (queue.length === 0) return  // Don't show overlay for empty queues
    const key = SESSION_START_KEY(profileId, today)
    if (!localStorage.getItem(key)) {
      setShowStartOverlay(true)
    }
  }, [profileId, today, queue.length])

  // Expose current queue item context for chat panel
  useEffect(() => {
    if (currentItem) {
      sessionStorage.setItem('queue-current-item', JSON.stringify({
        topicName: currentItem.topicName,
        subjectName: currentItem.subjectName,
        itemType: currentItem.type,
      }))
    } else {
      sessionStorage.removeItem('queue-current-item')
    }
  }, [currentItem?.id])

  // Block A: Start session when first item appears (regardless of overlay)
  useEffect(() => {
    if (currentItem && !sessionStartedRef.current && profileId) {
      sessionStartRef.current = Date.now()
      sessionStartedRef.current = true
      startSession('review').catch(() => {})
    }
  }, [currentItem, profileId, startSession])

  // End session on unmount — use ref to always get latest endSession
  useEffect(() => {
    return () => {
      if (sessionStartedRef.current) {
        endSessionRef.current().catch(() => {})
        sessionStartedRef.current = false
      }
    }
  }, [])

  // Queue completion — end session, trigger debrief, achievements, notifications
  const debriefAbortRef = useRef<AbortController | null>(null)
  useEffect(() => {
    if (isQueueEmpty && completedCount > 0) {
      // Block A: Capture time before ending session
      const timeSpent = sessionStartRef.current > 0
        ? Math.round((Date.now() - sessionStartRef.current) / 1000)
        : 0
      if (sessionStartedRef.current) {
        setFinalTimeSpent(timeSpent)
        endSession().catch(() => {})
        sessionStartedRef.current = false
      }

      track('queue_completed', { completedCount, timeSpent })

      // Detect first-ever session for celebration
      if (profileId && !localStorage.getItem(`firstSessionDone_${profileId}`)) {
        localStorage.setItem(`firstSessionDone_${profileId}`, 'true')
        setIsFirstSession(true)
      }

      if (profileId) {
        generateNotifications(profileId).catch(() => {})
        scheduleDailyReminder(profileId).catch(() => {})
        checkAchievements(profileId).then(newlyUnlocked => {
          for (const a of newlyUnlocked) {
            if (MAJOR_ACHIEVEMENTS.has(a.id)) {
              setAchievementToShow(a)
            } else {
              showAchievementToast(a)
            }
          }
        }).catch(() => {})
      }

      // Block C: Generate AI debrief with abort support
      if (sessionResults.current.length > 0) {
        setIsDebriefStreaming(true)
        const controller = new AbortController()
        debriefAbortRef.current = controller
        ;(async () => {
          try {
            const token = await getToken()
            if (!token || controller.signal.aborted) return
            const results = sessionResults.current
            const struggled = results.filter(r => r.rating === 'struggled').map(r => r.topicName)
            const good = results.filter(r => r.rating === 'good').map(r => r.topicName)

            // Gather mastery context
            const currentTopics = await db.topics.where('examProfileId').equals(profileId!).toArray()
            const deltaSummary = currentTopics
              .filter(tp => preMastery.current.has(tp.id))
              .map(tp => {
                const before = preMastery.current.get(tp.id)!
                const diff = tp.mastery - before
                if (Math.abs(diff) < 0.01) return null
                return `${tp.name}: ${Math.round(before * 100)}% → ${Math.round(tp.mastery * 100)}%`
              })
              .filter(Boolean)

            // Read diagnostician priorities for forward-looking advice
            let priorityContext = ''
            try {
              const insight = await db.agentInsights.get(`diagnostician:${profileId}`)
              if (insight) {
                const report = JSON.parse(insight.data)
                const top = (report.priorities ?? []).slice(0, 3)
                if (top.length > 0) {
                  priorityContext = `\nTop study priorities: ${top.map((p: { topicName: string; reason: string }) => `${p.topicName} (${p.reason})`).join('; ')}.`
                }
              }
            } catch { /* non-critical */ }

            const prompt = `Student just completed ${results.length} study items.\n` +
              (struggled.length > 0 ? `Struggled with: ${[...new Set(struggled)].join(', ')}.\n` : '') +
              (good.length > 0 ? `Did well on: ${[...new Set(good)].join(', ')}.\n` : '') +
              (deltaSummary.length > 0 ? `Mastery changes: ${deltaSummary.join('; ')}.\n` : '') +
              priorityContext +
              `\nGive a 3-5 sentence coaching debrief. Mention specific mastery changes if notable. End with one concrete recommendation for their next session based on the priorities.`

            let text = ''
            await streamChat({
              messages: [{ role: 'user', content: prompt }],
              system: 'You are a study coach giving a brief post-session debrief. Be warm, specific, and actionable. Use LaTeX $...$ for math if relevant. Never use emojis.',
              tools: [],
              maxTokens: 1024,
              authToken: token,
              onToken: (tok) => { text += tok; setAiDebrief(text) },
              signal: controller.signal,
            })
          } catch { /* non-critical — includes AbortError */ }
          finally { setIsDebriefStreaming(false) }
        })()
      }

      setShowCompletion(true)
    }

    return () => {
      debriefAbortRef.current?.abort()
    }
  }, [isQueueEmpty, completedCount, profileId, endSession, getToken])

  // Block E: Auto-dismiss nudge after 5 seconds
  useEffect(() => {
    if (!currentNudge) return
    const timer = setTimeout(() => setCurrentNudge(null), 5000)
    return () => clearTimeout(timer)
  }, [currentNudge])

  const dueFlashcardCount = useLiveQuery(async () => {
    if (!profileId) return 0
    const decks = await db.flashcardDecks.where('examProfileId').equals(profileId).toArray()
    const deckIds = new Set(decks.map(d => d.id))
    return db.flashcards.where('nextReviewDate').belowOrEqual(today).filter(c => deckIds.has(c.deckId)).count()
  }, [profileId, today]) ?? 0

  const yesterdayStats = useLiveQuery(async () => {
    if (!profileId) return undefined
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
    return db.dailyStudyLogs.get(`${profileId}:${yesterday}`)
  }, [profileId])

  // Tomorrow's due count for session completion (items due on or before tomorrow)
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
  const tomorrowDueCount = useLiveQuery(async () => {
    if (!profileId) return 0
    const decks = await db.flashcardDecks.where('examProfileId').equals(profileId).toArray()
    const deckIds = new Set(decks.map(d => d.id))
    // Count items due exactly tomorrow (not today's leftovers)
    const flashcardsDue = await db.flashcards.where('nextReviewDate').equals(tomorrow).filter(c => deckIds.has(c.deckId)).count()
    const exercisesDue = await db.exercises.where('examProfileId').equals(profileId).filter(e => !e.hidden && e.nextReviewDate === tomorrow).count()
    return flashcardsDue + exercisesDue
  }, [profileId, tomorrow]) ?? 0

  // Macro roadmap active phase for session completion
  const activeRoadmapPhase = useLiveQuery(async () => {
    if (!profileId) return null
    try {
      const roadmap = await db.macroRoadmaps.get(profileId)
      if (!roadmap) return null
      const phases = JSON.parse(roadmap.phases) as Array<{ name: string; status: string; week?: number }>
      return phases.find(p => p.status === 'active') ?? null
    } catch { return null }
  }, [profileId]) ?? null

  const masteryDropTopics = topics
    .filter(tp => tp.mastery >= 0.4 && decayedMastery(tp) < tp.mastery - 0.05)
    .map(tp => ({ name: tp.name, drop: Math.round((tp.mastery - decayedMastery(tp)) * 100) }))
    .slice(0, 3)

  // Block E: Record a rating result and compute nudge
  const recordResult = useCallback((topicName: string, type: string, rating: 'struggled' | 'ok' | 'good') => {
    sessionResults.current.push({ topicName, type, rating })
    if (type === 'flashcard-review') track('flashcard_reviewed', { rating })
    else if (type === 'exercise') track('exercise_rated', { rating })
    const nudge = computeNudge({
      completedTopicName: topicName,
      completedCount: completedCount + 1,
      totalCount,
      sessionResults: sessionResults.current,
      streak,
    }, t)
    setCurrentNudge(nudge)
  }, [completedCount, totalCount, streak, t])

  const handleStartSession = useCallback((minutes: number) => {
    if (profileId) {
      localStorage.setItem(SESSION_START_KEY(profileId, today), 'true')
    }
    // Capture pre-session mastery for delta computation
    const topicIds = new Set(queue.map(q => q.topicId))
    for (const tp of topics) {
      if (topicIds.has(tp.id)) preMastery.current.set(tp.id, tp.mastery)
    }
    track('queue_started', { minutes, cramMode, itemCount: totalCount })
    setTimeAvailable(minutes)
    setShowStartOverlay(false)
  }, [profileId, today, cramMode, totalCount, queue, topics])

  const handleComplete = useCallback((itemId: string) => {
    setConceptRevealed(false)
    completeItem(itemId)
  }, [completeItem])

  const handleSkip = useCallback((itemId: string) => {
    setConceptRevealed(false)
    setCurrentNudge(null)
    skipItem(itemId)
  }, [skipItem])

  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  // Compute colored progress segments from session results
  const completedSegments = useMemo(() => {
    if (totalCount === 0) return []
    const typeCounts = new Map<string, number>()
    for (const r of sessionResults.current) {
      typeCounts.set(r.type, (typeCounts.get(r.type) ?? 0) + 1)
    }
    return Array.from(typeCounts.entries()).map(([type, count]) => ({
      color: TYPE_STYLES[type as QueueItemType]?.progressColor ?? 'bg-[var(--accent-text)]',
      pct: (count / totalCount) * 100,
    }))
  }, [completedCount, totalCount])

  if (!activeProfile) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <EmptyState
          icon={ListChecks}
          title={t('emptyState.queueNoProfile.title')}
          subtitle={t('emptyState.queueNoProfile.subtitle')}
          actions={[{ label: t('emptyState.queueNoProfile.cta'), to: '/exam-profile' }]}
        />
      </div>
    )
  }

  const struggled = sessionResults.current.filter(r => r.rating === 'struggled')
  const nextRecommendation = struggled.length > 0
    ? {
        topicName: struggled[0].topicName,
        action: t('queue.chatWithAI'),
        reason: t('queue.struggledReason', { topic: struggled[0].topicName }),
        linkTo: '#open-chat',
      }
    : undefined

  const exerciseCount = queue.filter(q => q.type === 'exercise').length
  const flashcardCount = queue.filter(q => q.type === 'flashcard-review').length
  const activityType = exerciseCount > flashcardCount ? 'practice-exam' as const : 'flashcards' as const

  // Compute mastery deltas from pre-session snapshot
  const masteryDeltas = topics
    .filter(tp => preMastery.current.has(tp.id) && tp.mastery !== preMastery.current.get(tp.id))
    .map(tp => ({
      topicId: tp.id,
      topicName: tp.name,
      before: preMastery.current.get(tp.id)!,
      after: tp.mastery,
    }))

  const completionData: SessionCompletionData = {
    activityType,
    timeSpentSeconds: finalTimeSpent,
    streak,
    weeklyHours,
    weeklyTarget: activeProfile.weeklyTargetHours,
    nextRecommendation,
    masteryDeltas: masteryDeltas.length > 0 ? masteryDeltas : undefined,
    tomorrowDueCount: tomorrowDueCount > 0 ? tomorrowDueCount : undefined,
    roadmapPhase: activeRoadmapPhase?.name,
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 animate-fade-in">
      {profileId && <CelebrationBanner examProfileId={profileId} streak={streak} />}
      {showStartOverlay && (
        <SessionStartOverlay
          streak={streak}
          dueFlashcardCount={dueFlashcardCount}
          masteryDropTopics={masteryDropTopics}
          topRecommendation={queue[0] ? { topicName: queue[0].topicName, reason: `${queue[0].type.replace('-', ' ')}` } : undefined}
          yesterdayStats={yesterdayStats ?? undefined}
          onStart={handleStartSession}
          onDismiss={() => { setShowStartOverlay(false); if (profileId) localStorage.setItem(SESSION_START_KEY(profileId, today), 'true') }}
        />
      )}

      {showCompletion && (
        <SessionCompletionOverlay
          data={completionData}
          onDismiss={() => setShowCompletion(false)}
          onAction={(linkTo) => {
            if (linkTo === '#open-chat') {
              window.dispatchEvent(new CustomEvent('open-chat-panel'))
              setShowCompletion(false)
            } else {
              navigate(linkTo)
              setShowCompletion(false)
            }
          }}
          aiDebrief={aiDebrief}
          isDebriefStreaming={isDebriefStreaming}
          isFirstSession={isFirstSession}
        />
      )}

      {achievementToShow && (
        <AchievementUnlockModal
          achievement={achievementToShow}
          onDismiss={() => setAchievementToShow(null)}
        />
      )}

      {/* Coach insight from Progress Monitor */}
      {coachInsight && (
        <div className={`glass-card p-3 mb-4 flex items-center gap-2 text-sm animate-fade-in ${
          coachInsight.urgency === 'urgent' ? 'border-l-4 border-red-500' :
          coachInsight.urgency === 'attention' ? 'border-l-4 border-amber-500' : ''
        }`}>
          <span className="shrink-0">
            {coachInsight.urgency === 'urgent' ? <AlertTriangle className="w-4 h-4 text-red-500" /> : coachInsight.urgency === 'attention' ? <BarChart3 className="w-4 h-4 text-amber-500" /> : <Lightbulb className="w-4 h-4 text-blue-500" />}
          </span>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-[var(--text-heading)] text-xs">{coachInsight.title}</p>
            <p className="text-[var(--text-muted)] text-xs">{coachInsight.message}</p>
          </div>
          {coachInsight.action && (
            <Link to={coachInsight.action.route} className="text-xs text-[var(--accent-text)] hover:underline shrink-0">
              {coachInsight.action.label}
            </Link>
          )}
          <button onClick={() => setCoachDismissed(true)} className="text-[var(--text-muted)] hover:text-[var(--text-body)] shrink-0">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Daily Coaching Brief */}
      {!showStartOverlay && !showCompletion && profileId && activeProfile && (
        <DailyCoachingBrief
          examProfileId={profileId}
          profileName={activeProfile.name}
          onBeginSession={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-heading)] flex items-center gap-2">
            {t('queue.todaysSession')}
            {cramMode && (
              <span className="text-xs font-bold text-red-500 bg-red-500/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                <Zap className="w-3 h-3" /> {t('queue.cramMode')}
              </span>
            )}
          </h1>
          <p className="text-sm text-[var(--text-muted)]">
            {completedCount}/{totalCount} {t('queue.covered')} · ~{remainingMinutes} {t('queue.minLeft')}
            {elapsedMinutes > 0 && <span> · {elapsedMinutes}{t('queue.mElapsed')}</span>}
          </p>
        </div>
      </div>

      {/* Progress bar — colored segments per item type */}
      <div role="progressbar" aria-valuenow={Math.round(progressPct)} aria-valuemin={0} aria-valuemax={100} aria-label="Session progress" className="w-full h-2 rounded-full bg-[var(--bg-input)] mb-6 overflow-hidden flex">
        {completedSegments.length > 0 ? (
          completedSegments.map((seg, i) => (
            <div key={i} className={`h-full transition-all duration-500 ${seg.color}`} style={{ width: `${seg.pct}%` }} />
          ))
        ) : (
          <div
            className={`h-full rounded-full transition-all duration-500 ${cramMode ? 'bg-red-500' : 'bg-[var(--accent-text)]'}`}
            style={{ width: `${progressPct}%` }}
          />
        )}
      </div>

      {/* Block E: Nudge banner */}
      {currentNudge && (
        <div className="glass-card p-3 mb-4 flex items-center gap-2 text-sm animate-fade-in">
          <span className="shrink-0">
            {currentNudge.type === 'reinforcement' ? <RefreshCw className="w-4 h-4 text-blue-500" /> : currentNudge.type === 'progress' ? <BarChart3 className="w-4 h-4 text-emerald-500" /> : currentNudge.type === 'connection' ? <Link2 className="w-4 h-4 text-purple-500" /> : <Sparkles className="w-4 h-4 text-[var(--accent-text)]" />}
          </span>
          <span className="text-[var(--text-body)] flex-1">{currentNudge.text}</span>
          <button onClick={() => setCurrentNudge(null)} className="text-[var(--text-muted)] hover:text-[var(--text-body)]">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Current Item */}
      {currentItem ? (
        <div className={`glass-card p-6 mb-4 ${TYPE_STYLES[currentItem.type as QueueItemType]?.border ?? ''} ${cramMode ? 'border border-red-500/20' : ''}`}>
          <div className="flex items-center gap-2 mb-3">
            <ItemTypeIcon type={currentItem.type} />
            <span className={`text-xs font-semibold uppercase tracking-wider ${TYPE_STYLES[currentItem.type as QueueItemType]?.icon ?? 'text-[var(--text-muted)]'}`}>
              {t(`queue.type.${currentItem.type}`, currentItem.type.replace('-', ' '))}
            </span>
            <span className="text-xs text-[var(--text-faint)]">·</span>
            <span className="text-xs text-[var(--text-muted)]">{currentItem.subjectName}</span>
          </div>

          <h2 className="text-lg font-semibold text-[var(--text-heading)] mb-1">
            <Link to={`/topic/${currentItem.topicId}`} className="hover:text-[var(--accent-text)] transition-colors">
              {currentItem.topicName}
            </Link>
          </h2>
          {currentItem.reason && (
            <p className="text-xs text-[var(--text-muted)] mb-1">{currentItem.reason}</p>
          )}
          <p className="text-sm text-[var(--text-muted)] mb-4">~{currentItem.estimatedMinutes} min</p>

          {currentItem.type === 'flashcard-review' && (
            <FlashcardReviewInline
              item={currentItem}
              profileId={profileId}
              onComplete={handleComplete}
              onRated={recordResult}
              onRetry={retryItem}
              examProfileId={profileId}
              isPro={isPro}
              voiceProps={voiceProps}
            />
          )}

          {currentItem.type === 'exercise' && (
            <ExerciseInline
              item={currentItem}
              profileId={profileId}
              onComplete={handleComplete}
              onRated={recordResult}
              onRetry={retryItem}
              examProfileId={profileId}
              isPro={isPro}
              voiceProps={voiceProps}
            />
          )}

          {currentItem.type === 'concept-quiz' && (
            <ConceptQuizInline
              item={currentItem}
              profileId={profileId}
              revealed={conceptRevealed}
              onReveal={() => setConceptRevealed(true)}
              onComplete={handleComplete}
              onRated={recordResult}
              onRetry={retryItem}
              examProfileId={profileId}
              isPro={isPro}
              voiceProps={voiceProps}
            />
          )}

          {/* Skip button */}
          <div className="flex justify-end mt-4">
            <button
              onClick={() => handleSkip(currentItem.id)}
              className="btn-secondary py-2 text-sm px-4 flex items-center gap-2"
            >
              <SkipForward className="w-4 h-4" />
              {t('common.skip')}
            </button>
          </div>
        </div>
      ) : queue.length === 0 ? (
        <div className="glass-card p-8 text-center">
          {(() => {
            const avgMastery = topics.length > 0
              ? topics.reduce((s, t) => s + t.mastery, 0) / topics.length
              : 0
            const isNewUser = avgMastery < 0.15 && completedCount === 0

            if (isNewUser) {
              return (
                <EmptyState
                  icon={BookOpen}
                  title={t('emptyState.queueNotStarted.title')}
                  subtitle={t('emptyState.queueNotStarted.subtitle')}
                  actions={[
                    { label: t('emptyState.queueNotStarted.ctaExam'), to: '/practice-exam' },
                    { label: t('emptyState.queueNotStarted.ctaUpload'), to: '/sources' },
                  ]}
                />
              )
            }

            return (
              <>
                <CheckCircle2 className="w-12 h-12 text-[var(--color-success)] mx-auto mb-3" />
                <h2 className="text-lg font-bold text-[var(--text-heading)] mb-2">
                  {completedCount > 0 ? t('queue.beautifulSession') : t('queue.allCaughtUp')}
                </h2>
                <p className="text-sm text-[var(--text-muted)] mb-4">
                  {completedCount > 0
                    ? t('queue.coveredItems', { count: completedCount })
                    : t('queue.takeABreak')
                  }
                </p>
                {tomorrowDueCount > 0 && (
                  <p className="text-xs text-[var(--text-faint)] mb-4">
                    {t('session.tomorrowDue', { count: tomorrowDueCount })}
                  </p>
                )}
                <div className="flex flex-col gap-2 max-w-xs mx-auto">
                  {topics.some(tp => tp.mastery < 0.3) && isPro && (
                    <button onClick={() => navigate('/practice-exam')} className="btn-primary w-full py-2 text-sm">
                      {t('queue.takePracticeExam', 'Take a practice exam')}
                    </button>
                  )}
                  <button onClick={() => navigate('/analytics')} className="btn-secondary w-full py-2 text-sm">
                    {t('queue.viewProgress', 'View your progress')}
                  </button>
                </div>
              </>
            )
          })()}
        </div>
      ) : null}

      {/* Queue preview */}
      {queue.length > 1 && currentItem && (
        <details className="glass-card overflow-hidden">
          <summary className="px-4 py-3 text-sm font-medium text-[var(--text-muted)] cursor-pointer hover:bg-[var(--bg-input)]/30">
            {t('queue.upNext', { count: queue.length - completedCount - 1 })}
          </summary>
          <div className="border-t border-[var(--border-card)]">
            {queue.slice(0, 8).map(item => {
              const isDone = completedCount > 0 && queue.indexOf(item) < completedCount
              return (
                <div key={item.id} className={`flex items-center gap-3 px-4 py-2 text-sm ${isDone ? 'opacity-40' : ''}`}>
                  <ItemTypeIcon type={item.type} />
                  <span className="flex-1 text-[var(--text-body)] truncate">{item.topicName}</span>
                  <span className="text-xs text-[var(--text-muted)]">~{item.estimatedMinutes}m</span>
                </div>
              )
            })}
          </div>
        </details>
      )}
    </div>
  )
}

function ItemTypeIcon({ type }: { type: string }) {
  switch (type) {
    case 'flashcard-review': return <BookOpen className="w-4 h-4 text-purple-500" />
    case 'exercise': return <ListChecks className="w-4 h-4 text-orange-500" />
    case 'concept-quiz': return <Brain className="w-4 h-4 text-blue-500" />
    default: return <ArrowRight className="w-4 h-4 text-[var(--text-muted)]" />
  }
}

// ─── Flashcard review (one card at a time + inline AI on "Again") ──────

const RATING_BUTTONS = [
  { quality: 1, labelKey: 'queue.ratingAgain', key: '1', color: 'bg-red-500/15 text-red-600 hover:bg-red-500/25' },
  { quality: 3, labelKey: 'queue.ratingHard', key: '2', color: 'bg-orange-500/15 text-orange-600 hover:bg-orange-500/25' },
  { quality: 4, labelKey: 'queue.ratingGood', key: '3', color: 'bg-blue-500/15 text-blue-600 hover:bg-blue-500/25' },
  { quality: 5, labelKey: 'queue.ratingEasy', key: '4', color: 'bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/25' },
]

function FlashcardReviewInline({
  item, profileId, onComplete, onRated, onRetry, examProfileId, isPro, voiceProps,
}: {
  item: QueueItem
  profileId: string | undefined
  onComplete: (itemId: string) => void
  onRated: (topicName: string, type: string, rating: 'struggled' | 'ok' | 'good') => void
  onRetry?: (item: QueueItem) => void
  examProfileId?: string
  isPro: boolean
  voiceProps: VoicePropsForAnswer
}) {
  const { t } = useTranslation()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [reviewedCount, setReviewedCount] = useState(0)
  // Block B: AI explanation after "Again"
  const [explanationCtx, setExplanationCtx] = useState<{ front: string; back: string } | null>(null)
  // Feature 6: Next review interval
  const [nextInterval, setNextInterval] = useState<number | null>(null)
  // AI active recall
  const [phase, setPhase] = useState<'answering' | 'evaluating' | 'evaluated' | 'self-rating'>('answering')
  const [userAnswer, setUserAnswer] = useState('')
  const evaluator = useAnswerEvaluator(examProfileId)

  const cards = useLiveQuery(async () => {
    if (!item.flashcardIds?.length) return []
    return db.flashcards.where('id').anyOf(item.flashcardIds).toArray()
  }, [item.flashcardIds]) ?? []

  const currentCard = cards[currentIndex] ?? null

  const advanceCard = () => {
    setExplanationCtx(null)
    setPhase('answering')
    setUserAnswer('')
    evaluator.reset()
    if (currentIndex + 1 >= cards.length) {
      onComplete(item.id)
    } else {
      setCurrentIndex(prev => prev + 1)
      setFlipped(false)
    }
  }

  // Watch evaluator completion
  useEffect(() => {
    if (phase === 'evaluating') {
      if (evaluator.quality !== null) {
        setFlipped(true)
        setPhase('evaluated')
      } else if (evaluator.error !== null) {
        setFlipped(true)
        setPhase('self-rating')
      }
    }
  }, [phase, evaluator.quality, evaluator.error])

  const handleRate = async (quality: number) => {
    if (!profileId || isSubmitting) return
    setIsSubmitting(true)
    try {
      const card = currentCard
      const { calculateSM2 } = await import('../lib/spacedRepetition')
      const result = calculateSM2(quality, {
        id: card.id, front: card.front, back: card.back,
        easeFactor: card.easeFactor, interval: card.interval,
        repetitions: card.repetitions, nextReviewDate: card.nextReviewDate,
        lastRating: card.lastRating,
      })
      await db.flashcards.update(card.id, {
        easeFactor: result.easeFactor, interval: result.interval,
        repetitions: result.repetitions, nextReviewDate: result.nextReviewDate,
        lastRating: quality,
      })
      if (card.topicId) {
        await recomputeTopicMastery(card.topicId)
        await advanceTopicSRS(card.topicId, quality)
      }

      setReviewedCount(prev => prev + 1)
      trackContentInteraction(card.id, quality, quality >= 3).catch(() => {})
      onRated(item.topicName, 'flashcard-review', quality <= 2 ? 'struggled' : quality <= 3 ? 'ok' : 'good')

      // Block B: Show AI explanation on "Again", don't auto-advance
      if (quality === 1) {
        setExplanationCtx({ front: card.front, back: card.back })
      } else {
        // Feature 6: Show interval before advancing
        setNextInterval(result.interval)
        setTimeout(() => {
          setNextInterval(null)
          advanceCard()
        }, 1500)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleAnswerSubmit = (answer: string) => {
    setUserAnswer(answer)
    if (isPro && answer.trim()) {
      setPhase('evaluating')
      if (currentCard) {
        evaluator.evaluate(currentCard.front, currentCard.back, answer, item.topicName)
      }
    } else {
      setFlipped(true)
      setPhase('self-rating')
    }
  }

  const handleAnswerSkip = () => {
    setFlipped(true)
    setPhase('self-rating')
  }

  // Feature 1: Keyboard shortcuts ref
  const handleRateRef = useRef(handleRate)
  handleRateRef.current = handleRate
  const phaseRef = useRef(phase)
  phaseRef.current = phase

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      // Space-to-flip only in self-rating phase (answering phase needs space for textarea)
      if (e.key === ' ' && !flipped && !explanationCtx && phaseRef.current === 'self-rating') {
        e.preventDefault()
        setFlipped(true)
        return
      }
      // 1-4 shortcuts only in self-rating phase (evaluated phase has its own keyboard handler via EvaluationResult)
      if (phaseRef.current !== 'self-rating') return
      if (!flipped || explanationCtx || isSubmitting || nextInterval !== null) return
      const keyMap: Record<string, number> = { '1': 1, '2': 3, '3': 4, '4': 5 }
      const quality = keyMap[e.key]
      if (quality) {
        e.preventDefault()
        handleRateRef.current(quality)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [flipped, explanationCtx, isSubmitting, nextInterval])

  // Early returns AFTER all hooks to respect Rules of Hooks
  if (cards.length === 0) return <p className="text-sm text-[var(--text-muted)]">{t('queue.loadingCards')}</p>

  if (!currentCard) {
    return (
      <div className="text-center py-4">
        <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
        <p className="text-sm font-medium text-[var(--text-heading)]">{t('queue.allCardsReviewed', { count: reviewedCount })}</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
        <span>{t('queue.cardOf', { current: currentIndex + 1, total: cards.length })}</span>
        <span>{t('queue.reviewedCount', { count: reviewedCount })}</span>
      </div>
      <div className="w-full h-1 rounded-full bg-[var(--bg-input)] overflow-hidden">
        <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${(currentIndex / cards.length) * 100}%` }} />
      </div>

      <div className="glass-card p-5">
        {/* Question always visible */}
        <p className="text-sm font-medium text-[var(--text-heading)] min-h-[40px]">
          <MathText>{currentCard.front}</MathText>
        </p>

        {/* Phase: answering — show question + AnswerInput */}
        {phase === 'answering' && (
          <div className="mt-3 pt-3 border-t border-[var(--border-card)]">
            <AnswerInput
              onSubmit={handleAnswerSubmit}
              onSkip={handleAnswerSkip}
              {...voiceProps}
            />
          </div>
        )}

        {/* Phase: evaluating — show disabled textarea + spinner */}
        {phase === 'evaluating' && (
          <div className="mt-3 pt-3 border-t border-[var(--border-card)]">
            <textarea
              value={userAnswer}
              disabled
              className="w-full min-h-[80px] rounded-lg border border-[var(--border-card)] bg-[var(--bg-input)] px-3 py-2.5 text-sm text-[var(--text-body)] opacity-50 resize-none"
              rows={3}
            />
            <div className="flex items-center justify-center gap-2 mt-2 text-sm text-[var(--text-muted)]">
              <Loader2 className="w-4 h-4 animate-spin" />
              {t('queue.evaluating', 'Evaluating your answer...')}
            </div>
          </div>
        )}

        {/* Phase: evaluated — show answer + EvaluationResult */}
        {phase === 'evaluated' && (
          <>
            {flipped && (
              <div className="mt-3 pt-3 border-t border-[var(--border-card)]">
                <p className="text-sm text-[var(--text-body)]">
                  <MathText>{currentCard.back}</MathText>
                </p>
              </div>
            )}
            <div className="mt-3 pt-3 border-t border-[var(--border-card)]">
              <EvaluationResult
                quality={evaluator.quality!}
                feedback={evaluator.feedback}
                onAccept={() => handleRate(evaluator.quality!)}
                onOverride={(q) => handleRate(q)}
              />
            </div>
          </>
        )}

        {/* Phase: self-rating — original flip+rate UI */}
        {phase === 'self-rating' && (
          <>
            <div onClick={() => !explanationCtx && setFlipped(!flipped)} className="cursor-pointer">
              {flipped ? (
                <div className="mt-3 pt-3 border-t border-[var(--border-card)]">
                  <p className="text-sm text-[var(--text-body)]">
                    <MathText>{currentCard.back}</MathText>
                  </p>
                </div>
              ) : (
                <p className="text-xs text-[var(--text-faint)] mt-3">{t('queue.tapToReveal')}</p>
              )}
            </div>

            {flipped && !explanationCtx && nextInterval === null && (
              <div className="flex gap-1.5 mt-4 pt-3 border-t border-[var(--border-card)]">
                {RATING_BUTTONS.map(btn => (
                  <button
                    key={btn.quality}
                    onClick={() => handleRate(btn.quality)}
                    disabled={isSubmitting}
                    className={`flex-1 px-2 py-2 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 ${btn.color}`}
                  >
                    <span className="text-[10px] opacity-50 mr-1">{btn.key}</span>{t(btn.labelKey)}
                  </button>
                ))}
              </div>
            )}

            {/* Feature 6: Next review interval feedback */}
            {nextInterval !== null && (
              <p className="text-center text-xs text-[var(--text-muted)] mt-3 animate-fade-in">
                {t('queue.nextReviewIn', { count: nextInterval })}
              </p>
            )}
          </>
        )}

        {/* Block B: Inline AI explanation after "Again" */}
        {explanationCtx && (
          <InlineAIExplanation
            content={`Question: ${explanationCtx.front}\nAnswer: ${explanationCtx.back}`}
            topicName={item.topicName}
            onDismiss={advanceCard}
            onRetry={onRetry ? () => { setExplanationCtx(null); onRetry(item) } : undefined}
            examProfileId={examProfileId}
            topicId={item.topicId}
          />
        )}
      </div>

      {reviewedCount > 0 && !explanationCtx && (
        <button
          onClick={() => onComplete(item.id)}
          className="w-full text-xs text-[var(--text-muted)] hover:text-[var(--text-body)] py-2 transition-colors"
        >
          {t('queue.finishEarly', { reviewed: reviewedCount, total: cards.length })}
        </button>
      )}
    </div>
  )
}

// ─── Exercise with self-assessment + inline AI on "Didn't Get It" ──────

const EXERCISE_RATINGS = [
  { score: 0.2, labelKey: 'queue.ratingDidntGetIt', color: 'bg-red-500/15 text-red-600 hover:bg-red-500/25' },
  { score: 0.5, labelKey: 'queue.ratingPartially', color: 'bg-orange-500/15 text-orange-600 hover:bg-orange-500/25' },
  { score: 0.9, labelKey: 'queue.ratingGotIt', color: 'bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/25' },
]

function ExerciseInline({
  item, profileId, onComplete, onRated, onRetry, examProfileId, isPro, voiceProps,
}: {
  item: QueueItem
  profileId: string | undefined
  onComplete: (itemId: string) => void
  onRated: (topicName: string, type: string, rating: 'struggled' | 'ok' | 'good') => void
  onRetry?: (item: QueueItem) => void
  examProfileId?: string
  isPro: boolean
  voiceProps: VoicePropsForAnswer
}) {
  const { t } = useTranslation()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [explanationCtx, setExplanationCtx] = useState<string | null>(null)
  const [rated, setRated] = useState(false)
  const [showSolution, setShowSolution] = useState(false)
  // AI active recall
  const [phase, setPhase] = useState<'answering' | 'grading' | 'graded' | 'self-rating'>('answering')
  const exerciseAI = useExerciseAI(examProfileId)

  const exercise = useLiveQuery(
    () => item.exerciseId ? db.exercises.get(item.exerciseId) : undefined,
    [item.exerciseId]
  )

  const examSource = useLiveQuery(
    () => exercise ? db.examSources.get(exercise.examSourceId) : undefined,
    [exercise?.examSourceId]
  )

  // Watch exerciseAI completion
  useEffect(() => {
    if (phase === 'grading' && exerciseAI.score !== null && !exerciseAI.isStreaming) {
      setPhase('graded')
    }
  }, [phase, exerciseAI.score, exerciseAI.isStreaming])

  // Fallback on quota exceeded
  useEffect(() => {
    if (phase === 'grading' && exerciseAI.quotaExceeded) {
      setPhase('self-rating')
    }
  }, [phase, exerciseAI.quotaExceeded])

  // Fallback on error (non-quota)
  useEffect(() => {
    if (phase === 'grading' && exerciseAI.error && !exerciseAI.isStreaming && !exerciseAI.quotaExceeded) {
      setPhase('self-rating')
    }
  }, [phase, exerciseAI.error, exerciseAI.isStreaming, exerciseAI.quotaExceeded])

  // Early return AFTER all hooks
  if (!exercise) return <p className="text-sm text-[var(--text-muted)]">{t('queue.loadingExercise')}</p>

  const dispatchAI = (prefill: string) => {
    window.dispatchEvent(new CustomEvent('open-chat-panel', {
      detail: { prefill, context: { topicId: item.topicId, topicName: item.topicName } }
    }))
  }

  const handleRate = async (score: number) => {
    if (!profileId || !item.exerciseId) return
    setIsSubmitting(true)
    try {
      await db.exerciseAttempts.put({
        id: crypto.randomUUID(), exerciseId: item.exerciseId,
        examProfileId: profileId, score, createdAt: new Date().toISOString(),
      })

      // Advance exercise SRS
      const quality = score <= 0.3 ? 1 : score <= 0.6 ? 3 : 5
      const { calculateSM2 } = await import('../lib/spacedRepetition')
      const srs = calculateSM2(quality, {
        id: exercise.id, front: '', back: '',
        easeFactor: exercise.easeFactor ?? 2.5,
        interval: exercise.interval ?? 0,
        repetitions: exercise.repetitions ?? 0,
        nextReviewDate: exercise.nextReviewDate ?? new Date().toISOString().slice(0, 10),
        lastRating: quality,
      })

      await db.exercises.update(item.exerciseId, {
        status: score >= 0.7 ? 'completed' : 'attempted',
        lastAttemptScore: score, attemptCount: exercise.attemptCount + 1,
        easeFactor: srs.easeFactor,
        interval: srs.interval,
        repetitions: srs.repetitions,
        nextReviewDate: srs.nextReviewDate,
      })
      if (item.topicId) await recomputeTopicMastery(item.topicId)

      if (item.exerciseId) {
        trackContentInteraction(item.exerciseId, score <= 0.3 ? 1 : score <= 0.6 ? 3 : 5, score >= 0.5).catch(() => {})
      }
      onRated(item.topicName, 'exercise', score <= 0.3 ? 'struggled' : score <= 0.6 ? 'ok' : 'good')

      if (score === 0.2) {
        setExplanationCtx(exercise.text)
      } else {
        setRated(true)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleAnswerSubmit = (answer: string) => {
    if (isPro && answer.trim() && exercise) {
      setPhase('grading')
      exerciseAI.checkAnswer(exercise, answer, [item.topicName])
    } else {
      setPhase('self-rating')
    }
  }

  const handleAnswerSkip = () => {
    setPhase('self-rating')
  }

  // AI graded: map score to SRS quality
  const aiQuality = exerciseAI.score !== null
    ? (exerciseAI.score >= 80 ? 5 : exerciseAI.score >= 50 ? 3 : 1)
    : 1

  const handleAIAccept = async () => {
    // useExerciseAI already updated exercise status, attempts, and mastery in DB
    // Just do session tracking + advance
    if (exerciseAI.score !== null) {
      const normalizedScore = exerciseAI.score / 100
      if (item.exerciseId) {
        trackContentInteraction(item.exerciseId, aiQuality, normalizedScore >= 0.5).catch(() => {})
      }
      onRated(item.topicName, 'exercise', aiQuality <= 2 ? 'struggled' : aiQuality <= 3 ? 'ok' : 'good')

      // Advance exercise SRS (useExerciseAI updated status/attempts but not SRS fields)
      if (profileId && item.exerciseId) {
        const { calculateSM2 } = await import('../lib/spacedRepetition')
        const srs = calculateSM2(aiQuality, {
          id: exercise.id, front: '', back: '',
          easeFactor: exercise.easeFactor ?? 2.5,
          interval: exercise.interval ?? 0,
          repetitions: exercise.repetitions ?? 0,
          nextReviewDate: exercise.nextReviewDate ?? new Date().toISOString().slice(0, 10),
          lastRating: aiQuality,
        })
        await db.exercises.update(item.exerciseId, {
          easeFactor: srs.easeFactor,
          interval: srs.interval,
          repetitions: srs.repetitions,
          nextReviewDate: srs.nextReviewDate,
        })
        if (item.topicId) await recomputeTopicMastery(item.topicId)
      }

      // Block B: Show AI explanation on bad score
      if (aiQuality === 1) {
        setExplanationCtx(exercise.text)
      } else {
        onComplete(item.id)
      }
    }
  }

  const handleAIOverride = async (overrideQuality: number) => {
    // Override: re-do SRS with overridden quality
    if (profileId && item.exerciseId) {
      const { calculateSM2 } = await import('../lib/spacedRepetition')
      const srs = calculateSM2(overrideQuality, {
        id: exercise.id, front: '', back: '',
        easeFactor: exercise.easeFactor ?? 2.5,
        interval: exercise.interval ?? 0,
        repetitions: exercise.repetitions ?? 0,
        nextReviewDate: exercise.nextReviewDate ?? new Date().toISOString().slice(0, 10),
        lastRating: overrideQuality,
      })
      await db.exercises.update(item.exerciseId, {
        easeFactor: srs.easeFactor,
        interval: srs.interval,
        repetitions: srs.repetitions,
        nextReviewDate: srs.nextReviewDate,
      })
      if (item.topicId) await recomputeTopicMastery(item.topicId)
    }
    if (item.exerciseId) {
      trackContentInteraction(item.exerciseId, overrideQuality, overrideQuality >= 3).catch(() => {})
    }
    onRated(item.topicName, 'exercise', overrideQuality <= 2 ? 'struggled' : overrideQuality <= 3 ? 'ok' : 'good')

    if (overrideQuality === 1) {
      setExplanationCtx(exercise.text)
    } else {
      onComplete(item.id)
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-medium text-[var(--text-muted)]">{examSource ? `${examSource.name}${examSource.year ? ' ' + examSource.year : ''} · ` : ''}Ex. {exercise.exerciseNumber}</span>
        <span className="text-xs text-[var(--text-faint)] flex items-center gap-0.5">· {t('queue.difficulty')}: {Array.from({ length: 5 }, (_, i) => <Star key={i} className={`w-3 h-3 ${i < exercise.difficulty ? 'text-amber-400 fill-amber-400' : 'text-[var(--text-faint)]'}`} />)}</span>
        <span className="flex-1" />
        <button
          onClick={async () => {
            if (item.exerciseId) {
              await db.exercises.update(item.exerciseId, { hidden: true })
              toast.success(t('queue.exerciseHidden'))
              onComplete(item.id)
            }
          }}
          className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-red-500 hover:bg-red-500/10"
          title={t('queue.hideExercise')}
        >
          <Flag className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="glass-card p-4 text-sm text-[var(--text-body)] whitespace-pre-wrap mb-4">
        <MathText>{exercise.text}</MathText>
      </div>

      {/* Phase: answering — show AnswerInput */}
      {phase === 'answering' && !explanationCtx && (
        <AnswerInput
          placeholder={t('queue.writeSolution', 'Write your solution...')}
          onSubmit={handleAnswerSubmit}
          onSkip={handleAnswerSkip}
          {...voiceProps}
        />
      )}

      {/* Phase: grading — show streaming feedback */}
      {phase === 'grading' && (
        <div className="space-y-2">
          {exerciseAI.feedback && (
            <div className="glass-card p-4 text-sm text-[var(--text-body)] whitespace-pre-wrap border-l-2 border-blue-400">
              <MathText>{exerciseAI.feedback}</MathText>
            </div>
          )}
          {exerciseAI.isStreaming && (
            <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
              <Loader2 className="w-4 h-4 animate-spin" />
              {t('queue.gradingAnswer', 'Grading your answer...')}
            </div>
          )}
        </div>
      )}

      {/* Phase: graded — show AI feedback + score + accept/override */}
      {phase === 'graded' && !explanationCtx && (
        <div className="space-y-3">
          {exerciseAI.feedback && (
            <div className="glass-card p-4 text-sm text-[var(--text-body)] whitespace-pre-wrap border-l-2 border-blue-400">
              <MathText>{exerciseAI.feedback}</MathText>
            </div>
          )}
          {exerciseAI.score !== null && (
            <div className="flex items-center gap-2">
              <span className={`text-sm font-bold px-2.5 py-1 rounded-lg ${
                exerciseAI.score >= 80 ? 'bg-emerald-500/10 text-emerald-600' :
                exerciseAI.score >= 50 ? 'bg-orange-500/10 text-orange-600' :
                'bg-red-500/10 text-red-600'
              }`}>
                {exerciseAI.score}/100
              </span>
            </div>
          )}
          {exercise.solutionText && (
            <div>
              <button
                onClick={() => setShowSolution(!showSolution)}
                className="text-xs text-[var(--accent-text)] hover:underline"
              >
                {showSolution ? t('queue.hideCorrection') : t('queue.showCorrection')}
              </button>
              {showSolution && (
                <div className="glass-card p-3 mt-1 text-sm text-[var(--text-body)] whitespace-pre-wrap border-l-2 border-emerald-500">
                  <MathText>{exercise.solutionText}</MathText>
                </div>
              )}
            </div>
          )}
          <EvaluationResult
            quality={aiQuality}
            feedback={exerciseAI.score !== null ? `Score: ${exerciseAI.score}/100` : ''}
            onAccept={handleAIAccept}
            onOverride={handleAIOverride}
          />
        </div>
      )}

      {/* Phase: self-rating — original flow */}
      {phase === 'self-rating' && !explanationCtx && !rated && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-[var(--text-muted)]">{t('queue.howDidYouDo')}</p>
          <div className="flex gap-2">
            {EXERCISE_RATINGS.map(btn => (
              <button
                key={btn.score}
                onClick={() => handleRate(btn.score)}
                disabled={isSubmitting}
                className={`flex-1 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 ${btn.color}`}
              >
                {t(btn.labelKey)}
              </button>
            ))}
          </div>
        </div>
      )}

      {phase === 'self-rating' && rated && !explanationCtx && (
        <div className="space-y-2 mt-3">
          {exercise.solutionText && (
            <div>
              <button
                onClick={() => setShowSolution(!showSolution)}
                className="text-xs text-[var(--accent-text)] hover:underline"
              >
                {showSolution ? t('queue.hideCorrection') : t('queue.showCorrection')}
              </button>
              {showSolution && (
                <div className="glass-card p-3 mt-1 text-sm text-[var(--text-body)] whitespace-pre-wrap border-l-2 border-emerald-500">
                  <MathText>{exercise.solutionText}</MathText>
                </div>
              )}
            </div>
          )}
          <div className="flex gap-3">
            {examSource?.documentId && (
              <Link
                to={`/read/${examSource.documentId}`}
                className="text-xs text-[var(--text-muted)] hover:text-[var(--accent-text)] flex items-center gap-1"
              >
                <ExternalLink className="w-3 h-3" /> {t('queue.viewInExam')}
              </Link>
            )}
            <button
              onClick={() => dispatchAI(`Help me understand this exercise:\n${exercise.text.slice(0, 500)}`)}
              className="text-xs text-[var(--text-muted)] hover:text-[var(--accent-text)] flex items-center gap-1"
            >
              <MessageCircle className="w-3 h-3" /> {t('queue.discussWithAI')}
            </button>
          </div>
          <button
            onClick={() => onComplete(item.id)}
            className="btn-primary text-sm px-4 py-2 mt-2"
          >
            {t('common.continue')}
          </button>
        </div>
      )}

      {explanationCtx && (
        <InlineAIExplanation
          content={explanationCtx}
          topicName={item.topicName}
          onDismiss={() => { setExplanationCtx(null); onComplete(item.id) }}
          onRetry={onRetry ? () => { setExplanationCtx(null); onRetry(item) } : undefined}
          examProfileId={examProfileId}
          topicId={item.topicId}
        />
      )}
    </div>
  )
}

// ─── Concept quiz with self-assessment + inline AI on "Couldn't Explain" ──────

const CONCEPT_RATINGS = [
  { quality: 1, labelKey: 'queue.ratingCouldntExplain', color: 'bg-red-500/15 text-red-600 hover:bg-red-500/25' },
  { quality: 3, labelKey: 'queue.ratingStruggled', color: 'bg-orange-500/15 text-orange-600 hover:bg-orange-500/25' },
  { quality: 5, labelKey: 'queue.ratingCouldExplain', color: 'bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/25' },
]

function ConceptQuizInline({
  item, profileId: _profileId, revealed, onReveal, onComplete, onRated, onRetry, examProfileId, isPro, voiceProps,
}: {
  item: QueueItem
  profileId: string | undefined
  revealed: boolean
  onReveal: () => void
  onComplete: (itemId: string) => void
  onRated: (topicName: string, type: string, rating: 'struggled' | 'ok' | 'good') => void
  onRetry?: (item: QueueItem) => void
  examProfileId?: string
  isPro: boolean
  voiceProps: VoicePropsForAnswer
}) {
  const { t } = useTranslation()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [explanationCtx, setExplanationCtx] = useState<string | null>(null)
  // AI active recall
  const [phase, setPhase] = useState<'answering' | 'evaluating' | 'evaluated' | 'self-rating'>('answering')
  const [userAnswer, setUserAnswer] = useState('')
  const evaluator = useAnswerEvaluator(examProfileId)

  const card = useLiveQuery(
    () => item.conceptCardId ? db.conceptCards.get(item.conceptCardId) : undefined,
    [item.conceptCardId]
  )

  // Watch evaluator completion
  useEffect(() => {
    if (phase === 'evaluating') {
      if (evaluator.quality !== null) {
        setPhase('evaluated')
      } else if (evaluator.error !== null) {
        setPhase('self-rating')
      }
    }
  }, [phase, evaluator.quality, evaluator.error])

  // Early return AFTER all hooks
  if (!card) return <p className="text-sm text-[var(--text-muted)]">{t('queue.loadingConcept')}</p>

  let keyPoints: string[] = []
  try { keyPoints = JSON.parse(card.keyPoints) } catch { /* ignore */ }

  const handleRate = async (quality: number) => {
    if (!item.topicId) return
    setIsSubmitting(true)
    try {
      await advanceTopicSRS(item.topicId, quality)
      await recomputeTopicMastery(item.topicId)

      // Card-level SRS
      if (item.conceptCardId && card) {
        const { calculateSM2 } = await import('../lib/spacedRepetition')
        const today = new Date().toISOString().slice(0, 10)
        const srs = calculateSM2(quality, {
          id: card.id, front: card.title, back: keyPoints.join('; '),
          easeFactor: card.easeFactor ?? 2.5,
          interval: card.interval ?? 0,
          repetitions: card.repetitions ?? 0,
          nextReviewDate: card.nextReviewDate ?? today,
          lastRating: quality,
        })
        await db.conceptCards.update(card.id, {
          easeFactor: srs.easeFactor,
          interval: srs.interval,
          repetitions: srs.repetitions,
          nextReviewDate: srs.nextReviewDate,
        })
      }

      if (item.conceptCardId) {
        trackContentInteraction(item.conceptCardId, quality, quality >= 3).catch(() => {})
      }
      onRated(item.topicName, 'concept-quiz', quality <= 1 ? 'struggled' : quality <= 3 ? 'ok' : 'good')

      if (quality === 1) {
        setExplanationCtx(`Concept: ${card.title}\nKey points: ${keyPoints.join('; ')}`)
      } else {
        onComplete(item.id)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleAnswerSubmit = (answer: string) => {
    setUserAnswer(answer)
    if (isPro && answer.trim()) {
      setPhase('evaluating')
      evaluator.evaluate(card.title, keyPoints.join('; '), answer, item.topicName)
    } else {
      onReveal()
      setPhase('self-rating')
    }
  }

  const handleAnswerSkip = () => {
    onReveal()
    setPhase('self-rating')
  }

  return (
    <div>
      <h3 className="font-medium text-[var(--text-heading)] mb-2"><MathText>{card.title}</MathText></h3>
      <p className="text-sm text-[var(--text-muted)] mb-3">{t('queue.canYouExplain')}</p>

      {/* Phase: answering — show AnswerInput */}
      {phase === 'answering' && !revealed && (
        <AnswerInput
          placeholder={t('queue.explainInOwnWords', 'Explain in your own words...')}
          onSubmit={handleAnswerSubmit}
          onSkip={handleAnswerSkip}
          {...voiceProps}
        />
      )}

      {/* Phase: evaluating — show spinner */}
      {phase === 'evaluating' && (
        <div className="space-y-2">
          <textarea
            value={userAnswer}
            disabled
            className="w-full min-h-[80px] rounded-lg border border-[var(--border-card)] bg-[var(--bg-input)] px-3 py-2.5 text-sm text-[var(--text-body)] opacity-50 resize-none"
            rows={3}
          />
          <div className="flex items-center justify-center gap-2 text-sm text-[var(--text-muted)]">
            <Loader2 className="w-4 h-4 animate-spin" />
            {t('queue.evaluating', 'Evaluating your answer...')}
          </div>
        </div>
      )}

      {/* Phase: evaluated — show key points (revealed) + EvaluationResult */}
      {phase === 'evaluated' && (
        <>
          <div className="glass-card p-4 space-y-1 mb-4">
            {keyPoints.map((point, i) => (
              <p key={i} className="text-sm text-[var(--text-body)]">• <MathText>{point}</MathText></p>
            ))}
            {card.example && (
              <p className="text-sm text-[var(--text-muted)] mt-2 pt-2 border-t border-[var(--border-card)]">
                {t('queue.example')} <MathText>{card.example}</MathText>
              </p>
            )}
          </div>
          <EvaluationResult
            quality={evaluator.quality!}
            feedback={evaluator.feedback}
            onAccept={() => handleRate(evaluator.quality!)}
            onOverride={(q) => handleRate(q)}
          />
        </>
      )}

      {/* Phase: self-rating — original reveal + rate flow */}
      {phase === 'self-rating' && (
        <>
          {!revealed ? (
            <button onClick={onReveal} className="btn-secondary text-sm px-4 py-2">
              {t('queue.revealKeyPoints')}
            </button>
          ) : (
            <>
              <div className="glass-card p-4 space-y-1 mb-4">
                {keyPoints.map((point, i) => (
                  <p key={i} className="text-sm text-[var(--text-body)]">• <MathText>{point}</MathText></p>
                ))}
                {card.example && (
                  <p className="text-sm text-[var(--text-muted)] mt-2 pt-2 border-t border-[var(--border-card)]">
                    {t('queue.example')} <MathText>{card.example}</MathText>
                  </p>
                )}
              </div>

              {!explanationCtx && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-[var(--text-muted)]">{t('queue.howWellExplain')}</p>
                  <div className="flex gap-2">
                    {CONCEPT_RATINGS.map(btn => (
                      <button
                        key={btn.quality}
                        onClick={() => handleRate(btn.quality)}
                        disabled={isSubmitting}
                        className={`flex-1 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 ${btn.color}`}
                      >
                        {t(btn.labelKey)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {explanationCtx && (
                <InlineAIExplanation
                  content={explanationCtx}
                  topicName={item.topicName}
                  onDismiss={() => { setExplanationCtx(null); onComplete(item.id) }}
                  onRetry={onRetry ? () => { setExplanationCtx(null); onRetry(item) } : undefined}
                  examProfileId={examProfileId}
                  topicId={item.topicId}
                />
              )}
            </>
          )}
        </>
      )}

      {/* Block B: Inline AI explanation (for evaluated phase after bad rating) */}
      {phase !== 'self-rating' && explanationCtx && (
        <InlineAIExplanation
          content={explanationCtx}
          topicName={item.topicName}
          onDismiss={() => { setExplanationCtx(null); onComplete(item.id) }}
          onRetry={onRetry ? () => { setExplanationCtx(null); onRetry(item) } : undefined}
          examProfileId={examProfileId}
          topicId={item.topicId}
        />
      )}
    </div>
  )
}
