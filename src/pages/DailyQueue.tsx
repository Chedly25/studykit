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
import { SkipForward, CheckCircle2, BookOpen, ListChecks, Zap, X, AlertTriangle, BarChart3, Lightbulb, RefreshCw, Link2, Sparkles } from 'lucide-react'
import { db } from '../db'
import { useExamProfile } from '../hooks/useExamProfile'
import { useKnowledgeGraph } from '../hooks/useKnowledgeGraph'
import { useDailyQueue } from '../hooks/useDailyQueue'
import { useStudySession } from '../hooks/useStudySession'
import { FlashcardReviewInline } from '../components/queue/FlashcardReviewInline'
import { ExerciseInline } from '../components/queue/ExerciseInline'
import { ConceptQuizInline } from '../components/queue/ConceptQuizInline'
import { ItemTypeIcon } from '../components/queue/ItemTypeIcon'
import type { VoicePropsForAnswer } from '../components/queue/types'
import { DailyCoachingBrief } from '../components/queue/DailyCoachingBrief'
import { CelebrationBanner } from '../components/CelebrationBanner'
import { FirstVisitHint } from '../components/FirstVisitHint'
import { SessionStartOverlay } from '../components/SessionStartOverlay'
import { SessionCompletionOverlay, type SessionCompletionData } from '../components/SessionCompletionOverlay'
import { decayedMastery } from '../lib/knowledgeGraph'
import { generateNotifications } from '../lib/notificationGenerator'
import { scheduleDailyReminder } from '../lib/pushNotifications'
import { checkAchievements, type AchievementDef } from '../lib/achievements'
import { showAchievementToast } from '../components/AchievementToast'
import { AchievementUnlockModal, MAJOR_ACHIEVEMENTS } from '../components/AchievementUnlockModal'
import { computeNudge, type SessionResult, type Nudge } from '../lib/queueNudges'
import { streamChat } from '../ai/client'
import { track } from '../lib/analytics'
import { EmptyState } from '../components/EmptyState'
import { BrandedLoader } from '../components/BrandedLoader'
import { useSubscription } from '../hooks/useSubscription'
import { useVoiceInput } from '../hooks/useVoiceInput'
import { useKeyboardShortcut } from '../lib/keyboard'

const SESSION_START_KEY = (profileId: string, date: string) => `session_start_${profileId}_${date}`
const CRAM_KEY = (profileId: string) => `cramMode_${profileId}`

type QueueItemType = 'flashcard-review' | 'exercise' | 'concept-quiz'

const TYPE_STYLES: Record<QueueItemType, { border: string; bg: string; icon: string; progressColor: string }> = {
  'flashcard-review': { border: 'border-l-4 border-[var(--color-tag-flashcard)]', bg: '', icon: 'text-[var(--color-tag-flashcard)]', progressColor: 'bg-[var(--color-tag-flashcard)]' },
  'exercise':         { border: 'border-l-4 border-[var(--color-warning-border)]', bg: '', icon: 'text-[var(--color-warning)]', progressColor: 'bg-[var(--color-warning)]' },
  'concept-quiz':     { border: 'border-l-4 border-[var(--color-info-border)]',   bg: '', icon: 'text-[var(--color-info)]',   progressColor: 'bg-[var(--color-info)]' },
}

export default function DailyQueue() {
  return (
    <Suspense fallback={<BrandedLoader compact />}>
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
  const getTokenRef = useRef(getToken)
  getTokenRef.current = getToken

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
            const token = await getTokenRef.current()
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
              messages: [{ id: crypto.randomUUID(), role: 'user', content: prompt }],
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
  }, [isQueueEmpty, completedCount, profileId])

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
    completeItem(itemId)
  }, [completeItem])

  const handleSkip = useCallback((itemId: string) => {
    setCurrentNudge(null)
    skipItem(itemId)
  }, [skipItem])

  // Skip current item
  useKeyboardShortcut(
    's',
    () => {
      if (currentItem) handleSkip(currentItem.id)
    },
    {
      label: 'Skip current item',
      scope: 'Daily Queue',
      enabled: !!currentItem && !showCompletion && !showStartOverlay,
    },
  )

  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  // Compute colored progress segments from session results
  // Note: reads sessionResults.current (ref) — recomputes via completedCount dep which changes in sync with ref
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
      {profileId && !showStartOverlay && (
        <FirstVisitHint
          hintKey="queue"
          profileId={profileId}
          icon={ListChecks}
          title={t('hints.queueTitle')}
          description={t('hints.queueDescription')}
        />
      )}
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
              const struggledNames = [...new Set(struggled.map(r => r.topicName))]
              const deltaLines = masteryDeltas
                .map(d => `${d.topicName}: ${Math.round(d.before * 100)}% → ${Math.round(d.after * 100)}%`)
                .slice(0, 5)
              window.dispatchEvent(new CustomEvent('open-chat-panel', {
                detail: {
                  context: {
                    topicName: 'session debrief',
                    score: `${completedCount}/${totalCount} items completed`,
                    ...(struggledNames.length > 0 ? { weakTopics: struggledNames.join(', ') } : {}),
                    ...(deltaLines.length > 0 ? { question: `Can you help me understand these mastery changes and what to focus on next? ${deltaLines.join('; ')}` } : {}),
                  },
                },
              }))
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
          coachInsight.urgency === 'urgent' ? 'border-l-4 border-[var(--color-error-border)]' :
          coachInsight.urgency === 'attention' ? 'border-l-4 border-[var(--color-warning-border)]' : ''
        }`}>
          <span className="shrink-0">
            {coachInsight.urgency === 'urgent' ? <AlertTriangle className="w-4 h-4 text-[var(--color-error)]" /> : coachInsight.urgency === 'attention' ? <BarChart3 className="w-4 h-4 text-[var(--color-warning)]" /> : <Lightbulb className="w-4 h-4 text-[var(--color-info)]" />}
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
              <span className="text-xs font-bold text-[var(--color-error)] bg-[var(--color-error-bg)] px-2 py-0.5 rounded-full flex items-center gap-1">
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
            <div key={`seg-${i}`} className={`h-full transition-all duration-500 ${seg.color}`} style={{ width: `${seg.pct}%` }} />
          ))
        ) : (
          <div
            className={`h-full rounded-full transition-all duration-500 ${cramMode ? 'bg-[var(--color-error)]' : 'bg-[var(--accent-text)]'}`}
            style={{ width: `${progressPct}%` }}
          />
        )}
      </div>

      {/* Block E: Nudge banner */}
      {currentNudge && (
        <div className="glass-card p-3 mb-4 flex items-center gap-2 text-sm animate-fade-in">
          <span className="shrink-0">
            {currentNudge.type === 'reinforcement' ? <RefreshCw className="w-4 h-4 text-[var(--color-info)]" /> : currentNudge.type === 'progress' ? <BarChart3 className="w-4 h-4 text-[var(--accent-text)]" /> : currentNudge.type === 'connection' ? <Link2 className="w-4 h-4 text-[var(--color-tag-flashcard)]" /> : <Sparkles className="w-4 h-4 text-[var(--accent-text)]" />}
          </span>
          <span className="text-[var(--text-body)] flex-1">{currentNudge.text}</span>
          <button onClick={() => setCurrentNudge(null)} className="text-[var(--text-muted)] hover:text-[var(--text-body)]">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Current Item */}
      {currentItem ? (
        <div className={`glass-card p-6 mb-4 ${TYPE_STYLES[currentItem.type as QueueItemType]?.border ?? ''} ${cramMode ? 'border border-[var(--color-error-border)]' : ''}`}>
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
              <span className="text-[10px] opacity-50">S</span>
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
                      {t('queue.takePracticeExam')}
                    </button>
                  )}
                  <button onClick={() => navigate('/analytics')} className="btn-secondary w-full py-2 text-sm">
                    {t('queue.viewProgress')}
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

