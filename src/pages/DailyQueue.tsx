/**
 * Unified Daily Queue — one queue, one "Next" button.
 * Route: /queue
 *
 * Block A: Fixed session time tracking
 * Block B: Inline AI explanations after bad ratings
 * Block C: Post-queue AI debrief
 * Block E: Local nudges between items
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import { ArrowRight, SkipForward, CheckCircle2, BookOpen, ListChecks, Brain, Zap, Loader2, X, Flag } from 'lucide-react'
import { toast } from 'sonner'
import { db } from '../db'
import { useExamProfile } from '../hooks/useExamProfile'
import { useKnowledgeGraph } from '../hooks/useKnowledgeGraph'
import { useDailyQueue } from '../hooks/useDailyQueue'
import { useStudySession } from '../hooks/useStudySession'
import { SessionStartOverlay } from '../components/SessionStartOverlay'
import { SessionCompletionOverlay, type SessionCompletionData } from '../components/SessionCompletionOverlay'
import { InlineAIExplanation } from '../components/queue/InlineAIExplanation'
import { decayedMastery } from '../lib/knowledgeGraph'
import { recomputeTopicMastery, advanceTopicSRS } from '../lib/topicMastery'
import { generateNotifications } from '../lib/notificationGenerator'
import { scheduleDailyReminder } from '../lib/pushNotifications'
import { checkAchievements } from '../lib/achievements'
import { showAchievementToast } from '../components/AchievementToast'
import { computeNudge, type SessionResult, type Nudge } from '../lib/queueNudges'
import { streamChat } from '../ai/client'
import { MathText } from '../components/MathText'
import type { QueueItem } from '../lib/dailyQueueEngine'

const SESSION_START_KEY = (profileId: string, date: string) => `session_start_${profileId}_${date}`
const CRAM_KEY = (profileId: string) => `cramMode_${profileId}`

export default function DailyQueue() {
  const navigate = useNavigate()
  const { getToken } = useAuth()
  const { activeProfile } = useExamProfile()
  const profileId = activeProfile?.id
  const { topics, streak, weeklyHours } = useKnowledgeGraph(profileId)
  const { startSession, endSession } = useStudySession(profileId)

  const today = new Date().toISOString().slice(0, 10)
  const [showStartOverlay, setShowStartOverlay] = useState(false)
  const [timeAvailable, setTimeAvailable] = useState<number | undefined>(undefined)
  const [showCompletion, setShowCompletion] = useState(false)
  const [conceptRevealed, setConceptRevealed] = useState(false)

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
    remainingMinutes, completeItem, skipItem, isQueueEmpty,
  } = useDailyQueue(profileId, timeAvailable, cramMode)

  // Show start overlay on first visit today
  useEffect(() => {
    if (!profileId) return
    const key = SESSION_START_KEY(profileId, today)
    if (!localStorage.getItem(key)) {
      setShowStartOverlay(true)
    }
  }, [profileId, today])

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
      if (sessionStartedRef.current) {
        setFinalTimeSpent(Math.round((Date.now() - sessionStartRef.current) / 1000))
        endSession().catch(() => {})
        sessionStartedRef.current = false
      }

      if (profileId) {
        generateNotifications(profileId).catch(() => {})
        scheduleDailyReminder(profileId).catch(() => {})
        checkAchievements(profileId).then(newlyUnlocked => {
          for (const a of newlyUnlocked) showAchievementToast(a)
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
            const prompt = `Student just completed ${results.length} study items.\n` +
              (struggled.length > 0 ? `Struggled with: ${[...new Set(struggled)].join(', ')}.\n` : '') +
              (good.length > 0 ? `Did well on: ${[...new Set(good)].join(', ')}.\n` : '') +
              `Give a 3-5 sentence coaching debrief. Be specific, encouraging, and actionable. If they struggled, explain the key insight briefly.`

            let text = ''
            await streamChat({
              messages: [{ role: 'user', content: prompt }],
              system: 'You are a study coach giving a brief post-session debrief. Be warm, specific, and actionable. Use LaTeX $...$ for math if relevant.',
              tools: [],
              authToken: token,
              onToken: (t) => { text += t; setAiDebrief(text) },
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

  const masteryDropTopics = topics
    .filter(t => t.mastery >= 0.4 && decayedMastery(t) < t.mastery - 0.05)
    .map(t => ({ name: t.name, drop: Math.round((t.mastery - decayedMastery(t)) * 100) }))
    .slice(0, 3)

  // Block E: Record a rating result and compute nudge
  const recordResult = useCallback((topicName: string, type: string, rating: 'struggled' | 'ok' | 'good') => {
    sessionResults.current.push({ topicName, type, rating })
    const nudge = computeNudge({
      completedTopicName: topicName,
      completedCount: completedCount + 1,
      totalCount,
      sessionResults: sessionResults.current,
      streak,
    })
    setCurrentNudge(nudge)
  }, [completedCount, totalCount, streak])

  const handleStartSession = useCallback((minutes: number) => {
    if (profileId) {
      localStorage.setItem(SESSION_START_KEY(profileId, today), 'true')
    }
    setTimeAvailable(minutes)
    setShowStartOverlay(false)
  }, [profileId, today])

  const handleComplete = useCallback((itemId: string) => {
    setConceptRevealed(false)
    completeItem(itemId)
  }, [completeItem])

  const handleSkip = useCallback((itemId: string) => {
    setConceptRevealed(false)
    setCurrentNudge(null)
    skipItem(itemId)
  }, [skipItem])

  if (!activeProfile) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <p className="text-[var(--text-muted)]">Create a profile to start your daily queue.</p>
      </div>
    )
  }

  const struggled = sessionResults.current.filter(r => r.rating === 'struggled')
  const nextRecommendation = struggled.length > 0
    ? {
        topicName: struggled[0].topicName,
        action: 'Chat with AI',
        reason: `You struggled with ${struggled[0].topicName} — get help to solidify this concept`,
        linkTo: '#open-chat',
      }
    : undefined

  const completionData: SessionCompletionData = {
    activityType: 'flashcards',
    timeSpentSeconds: finalTimeSpent,
    streak,
    weeklyHours,
    weeklyTarget: activeProfile.weeklyTargetHours,
    nextRecommendation,
  }

  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 animate-fade-in">
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
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-heading)] flex items-center gap-2">
            Today's Queue
            {cramMode && (
              <span className="text-xs font-bold text-red-500 bg-red-500/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                <Zap className="w-3 h-3" /> CRAM MODE
              </span>
            )}
          </h1>
          <p className="text-sm text-[var(--text-muted)]">
            {completedCount}/{totalCount} completed · ~{remainingMinutes} min left
            {elapsedMinutes > 0 && <span> · {elapsedMinutes}m elapsed</span>}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full h-2 rounded-full bg-[var(--bg-input)] mb-6 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${cramMode ? 'bg-red-500' : 'bg-[var(--accent-text)]'}`}
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Block E: Nudge banner */}
      {currentNudge && (
        <div className="glass-card p-3 mb-4 flex items-center gap-2 text-sm animate-fade-in">
          <span className="text-base">
            {currentNudge.type === 'reinforcement' ? '🔄' : currentNudge.type === 'progress' ? '📊' : '✨'}
          </span>
          <span className="text-[var(--text-body)] flex-1">{currentNudge.text}</span>
          <button onClick={() => setCurrentNudge(null)} className="text-[var(--text-muted)] hover:text-[var(--text-body)]">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Current Item */}
      {currentItem ? (
        <div className={`glass-card p-6 mb-4 ${cramMode ? 'border border-red-500/20' : ''}`}>
          <div className="flex items-center gap-2 mb-3">
            <ItemTypeIcon type={currentItem.type} />
            <span className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
              {currentItem.type.replace('-', ' ')}
            </span>
            <span className="text-xs text-[var(--text-faint)]">·</span>
            <span className="text-xs text-[var(--text-muted)]">{currentItem.subjectName}</span>
          </div>

          <h2 className="text-lg font-semibold text-[var(--text-heading)] mb-1">{currentItem.topicName}</h2>
          {currentItem.reason && (
            <p className="text-xs text-[var(--text-faint)] mb-1 italic">{currentItem.reason}</p>
          )}
          <p className="text-sm text-[var(--text-muted)] mb-4">~{currentItem.estimatedMinutes} min</p>

          {currentItem.type === 'flashcard-review' && (
            <FlashcardReviewInline
              item={currentItem}
              profileId={profileId}
              onComplete={handleComplete}
              onRated={recordResult}
              examProfileId={profileId}
            />
          )}

          {currentItem.type === 'exercise' && (
            <ExerciseInline
              item={currentItem}
              profileId={profileId}
              onComplete={handleComplete}
              onRated={recordResult}
              examProfileId={profileId}
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
              examProfileId={profileId}
            />
          )}

          {/* Skip button */}
          <div className="flex justify-end mt-4">
            <button
              onClick={() => handleSkip(currentItem.id)}
              className="btn-secondary py-2 text-sm px-4 flex items-center gap-2"
            >
              <SkipForward className="w-4 h-4" />
              Skip
            </button>
          </div>
        </div>
      ) : queue.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-[var(--text-heading)] mb-2">
            {completedCount > 0 ? 'All done for today!' : 'No items in queue'}
          </h2>
          <p className="text-sm text-[var(--text-muted)] mb-4">
            {completedCount > 0
              ? `You completed ${completedCount} items. Great work!`
              : 'Add flashcards, exercises, or concept cards to build your queue.'
            }
          </p>
          <button onClick={() => navigate('/dashboard')} className="btn-primary px-6 py-2 text-sm">
            Back to Dashboard
          </button>
        </div>
      ) : null}

      {/* Queue preview */}
      {queue.length > 1 && currentItem && (
        <details className="glass-card overflow-hidden">
          <summary className="px-4 py-3 text-sm font-medium text-[var(--text-muted)] cursor-pointer hover:bg-[var(--bg-input)]/30">
            Up next ({queue.length - completedCount - 1} remaining)
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
    case 'flashcard-review': return <BookOpen className="w-4 h-4 text-blue-500" />
    case 'exercise': return <ListChecks className="w-4 h-4 text-orange-500" />
    case 'concept-quiz': return <Brain className="w-4 h-4 text-purple-500" />
    default: return <ArrowRight className="w-4 h-4 text-[var(--text-muted)]" />
  }
}

// ─── Flashcard review (one card at a time + inline AI on "Again") ──────

const RATING_BUTTONS = [
  { quality: 1, label: 'Again', key: '1', color: 'bg-red-500/15 text-red-600 hover:bg-red-500/25' },
  { quality: 3, label: 'Hard', key: '2', color: 'bg-orange-500/15 text-orange-600 hover:bg-orange-500/25' },
  { quality: 4, label: 'Good', key: '3', color: 'bg-blue-500/15 text-blue-600 hover:bg-blue-500/25' },
  { quality: 5, label: 'Easy', key: '4', color: 'bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/25' },
]

function FlashcardReviewInline({
  item, profileId, onComplete, onRated, examProfileId,
}: {
  item: QueueItem
  profileId: string | undefined
  onComplete: (itemId: string) => void
  onRated: (topicName: string, type: string, rating: 'struggled' | 'ok' | 'good') => void
  examProfileId?: string
}) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [reviewedCount, setReviewedCount] = useState(0)
  // Block B: AI explanation after "Again"
  const [explanationCtx, setExplanationCtx] = useState<{ front: string; back: string } | null>(null)
  // Feature 6: Next review interval
  const [nextInterval, setNextInterval] = useState<number | null>(null)

  const cards = useLiveQuery(async () => {
    if (!item.flashcardIds?.length) return []
    return db.flashcards.where('id').anyOf(item.flashcardIds).toArray()
  }, [item.flashcardIds]) ?? []

  if (cards.length === 0) return <p className="text-sm text-[var(--text-muted)]">Loading cards...</p>

  const currentCard = cards[currentIndex]
  if (!currentCard) {
    return (
      <div className="text-center py-4">
        <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
        <p className="text-sm font-medium text-[var(--text-heading)]">All {reviewedCount} cards reviewed!</p>
      </div>
    )
  }

  const advanceCard = () => {
    setExplanationCtx(null)
    if (currentIndex + 1 >= cards.length) {
      onComplete(item.id)
    } else {
      setCurrentIndex(prev => prev + 1)
      setFlipped(false)
    }
  }

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

  // Feature 1: Keyboard shortcuts ref
  const handleRateRef = useRef(handleRate)
  handleRateRef.current = handleRate

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === ' ' && !flipped && !explanationCtx) {
        e.preventDefault()
        setFlipped(true)
        return
      }
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

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
        <span>Card {currentIndex + 1} of {cards.length}</span>
        <span>{reviewedCount} reviewed</span>
      </div>
      <div className="w-full h-1 rounded-full bg-[var(--bg-input)] overflow-hidden">
        <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${(currentIndex / cards.length) * 100}%` }} />
      </div>

      <div className="glass-card p-5">
        <div onClick={() => !explanationCtx && setFlipped(!flipped)} className="cursor-pointer min-h-[80px]">
          <p className="text-sm font-medium text-[var(--text-heading)]">
            <MathText>{currentCard.front}</MathText>
          </p>
          {flipped ? (
            <div className="mt-3 pt-3 border-t border-[var(--border-card)]">
              <p className="text-sm text-[var(--text-body)]">
                <MathText>{currentCard.back}</MathText>
              </p>
            </div>
          ) : (
            <p className="text-xs text-[var(--text-faint)] mt-3">Tap or press Space to reveal</p>
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
                <span className="text-[10px] opacity-50 mr-1">{btn.key}</span>{btn.label}
              </button>
            ))}
          </div>
        )}

        {/* Feature 6: Next review interval feedback */}
        {nextInterval !== null && (
          <p className="text-center text-xs text-[var(--text-muted)] mt-3 animate-fade-in">
            Next review in {nextInterval} day{nextInterval !== 1 ? 's' : ''}
          </p>
        )}

        {/* Block B: Inline AI explanation after "Again" */}
        {explanationCtx && (
          <InlineAIExplanation
            content={`Question: ${explanationCtx.front}\nAnswer: ${explanationCtx.back}`}
            topicName={item.topicName}
            onDismiss={advanceCard}
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
          Finish early ({reviewedCount}/{cards.length} reviewed)
        </button>
      )}
    </div>
  )
}

// ─── Exercise with self-assessment + inline AI on "Didn't Get It" ──────

const EXERCISE_RATINGS = [
  { score: 0.2, label: "Didn't Get It", color: 'bg-red-500/15 text-red-600 hover:bg-red-500/25' },
  { score: 0.5, label: 'Partially', color: 'bg-orange-500/15 text-orange-600 hover:bg-orange-500/25' },
  { score: 0.9, label: 'Got It', color: 'bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/25' },
]

function ExerciseInline({
  item, profileId, onComplete, onRated, examProfileId,
}: {
  item: QueueItem
  profileId: string | undefined
  onComplete: (itemId: string) => void
  onRated: (topicName: string, type: string, rating: 'struggled' | 'ok' | 'good') => void
  examProfileId?: string
}) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [explanationCtx, setExplanationCtx] = useState<string | null>(null)

  const exercise = useLiveQuery(
    () => item.exerciseId ? db.exercises.get(item.exerciseId) : undefined,
    [item.exerciseId]
  )

  if (!exercise) return <p className="text-sm text-[var(--text-muted)]">Loading exercise...</p>

  const handleRate = async (score: number) => {
    if (!profileId || !item.exerciseId) return
    setIsSubmitting(true)
    try {
      await db.exerciseAttempts.put({
        id: crypto.randomUUID(), exerciseId: item.exerciseId,
        examProfileId: profileId, score, createdAt: new Date().toISOString(),
      })
      await db.exercises.update(item.exerciseId, {
        status: score >= 0.7 ? 'completed' : 'attempted',
        lastAttemptScore: score, attemptCount: exercise.attemptCount + 1,
      })
      if (item.topicId) await recomputeTopicMastery(item.topicId)

      onRated(item.topicName, 'exercise', score <= 0.3 ? 'struggled' : score <= 0.6 ? 'ok' : 'good')

      if (score === 0.2) {
        setExplanationCtx(exercise.text)
      } else {
        onComplete(item.id)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-medium text-[var(--text-muted)]">Exercise #{exercise.exerciseNumber}</span>
        <span className="text-xs text-[var(--text-faint)]">· Difficulty: {'★'.repeat(exercise.difficulty)}{'☆'.repeat(5 - exercise.difficulty)}</span>
        <span className="flex-1" />
        <button
          onClick={async () => {
            if (item.exerciseId) {
              await db.exercises.update(item.exerciseId, { hidden: true })
              toast.success('Exercise hidden')
              onComplete(item.id)
            }
          }}
          className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-red-500 hover:bg-red-500/10"
          title="Hide this exercise"
        >
          <Flag className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="glass-card p-4 text-sm text-[var(--text-body)] whitespace-pre-wrap mb-4">
        <MathText>{exercise.text}</MathText>
      </div>

      {!explanationCtx && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-[var(--text-muted)]">How did you do?</p>
          <div className="flex gap-2">
            {EXERCISE_RATINGS.map(btn => (
              <button
                key={btn.score}
                onClick={() => handleRate(btn.score)}
                disabled={isSubmitting}
                className={`flex-1 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 ${btn.color}`}
              >
                {btn.label}
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
          examProfileId={examProfileId}
          topicId={item.topicId}
        />
      )}
    </div>
  )
}

// ─── Concept quiz with self-assessment + inline AI on "Couldn't Explain" ──────

const CONCEPT_RATINGS = [
  { quality: 1, label: "Couldn't Explain", color: 'bg-red-500/15 text-red-600 hover:bg-red-500/25' },
  { quality: 3, label: 'Struggled', color: 'bg-orange-500/15 text-orange-600 hover:bg-orange-500/25' },
  { quality: 5, label: 'Could Explain', color: 'bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/25' },
]

function ConceptQuizInline({
  item, profileId, revealed, onReveal, onComplete, onRated, examProfileId,
}: {
  item: QueueItem
  profileId: string | undefined
  revealed: boolean
  onReveal: () => void
  onComplete: (itemId: string) => void
  onRated: (topicName: string, type: string, rating: 'struggled' | 'ok' | 'good') => void
  examProfileId?: string
}) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [explanationCtx, setExplanationCtx] = useState<string | null>(null)

  const card = useLiveQuery(
    () => item.conceptCardId ? db.conceptCards.get(item.conceptCardId) : undefined,
    [item.conceptCardId]
  )

  if (!card) return <p className="text-sm text-[var(--text-muted)]">Loading concept...</p>

  let keyPoints: string[] = []
  try { keyPoints = JSON.parse(card.keyPoints) } catch { /* ignore */ }

  const handleRate = async (quality: number) => {
    if (!item.topicId) return
    setIsSubmitting(true)
    try {
      await advanceTopicSRS(item.topicId, quality)
      await recomputeTopicMastery(item.topicId)

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

  return (
    <div>
      <h3 className="font-medium text-[var(--text-heading)] mb-2"><MathText>{card.title}</MathText></h3>
      <p className="text-sm text-[var(--text-muted)] mb-3">Can you explain this concept?</p>
      {!revealed ? (
        <button onClick={onReveal} className="btn-secondary text-sm px-4 py-2">
          Reveal Key Points
        </button>
      ) : (
        <>
          <div className="glass-card p-4 space-y-1 mb-4">
            {keyPoints.map((point, i) => (
              <p key={i} className="text-sm text-[var(--text-body)]">• <MathText>{point}</MathText></p>
            ))}
            {card.example && (
              <p className="text-sm text-[var(--text-muted)] mt-2 pt-2 border-t border-[var(--border-card)]">
                Example: <MathText>{card.example}</MathText>
              </p>
            )}
          </div>

          {!explanationCtx && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-[var(--text-muted)]">How well could you explain it?</p>
              <div className="flex gap-2">
                {CONCEPT_RATINGS.map(btn => (
                  <button
                    key={btn.quality}
                    onClick={() => handleRate(btn.quality)}
                    disabled={isSubmitting}
                    className={`flex-1 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 ${btn.color}`}
                  >
                    {btn.label}
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
              examProfileId={examProfileId}
              topicId={item.topicId}
            />
          )}
        </>
      )}
    </div>
  )
}
