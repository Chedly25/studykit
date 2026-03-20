/**
 * Unified Daily Queue — one queue, one "Next" button.
 * Route: /queue
 *
 * Block 1: Rating UI per item type, single session tracking, notification trigger
 * Block 2: Schedule daily reminder on completion
 * Block 4: Achievement checking on completion
 * Block 5: AI explain for struggling flashcards
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, SkipForward, CheckCircle2, BookOpen, ListChecks, Brain, RotateCw, Zap, Sparkles, Loader2 } from 'lucide-react'
import { db } from '../db'
import { useExamProfile } from '../hooks/useExamProfile'
import { useKnowledgeGraph } from '../hooks/useKnowledgeGraph'
import { useDailyQueue } from '../hooks/useDailyQueue'
import { useStudySession } from '../hooks/useStudySession'
import { SessionStartOverlay } from '../components/SessionStartOverlay'
import { SessionCompletionOverlay, type SessionCompletionData } from '../components/SessionCompletionOverlay'
import { decayedMastery } from '../lib/knowledgeGraph'
import { recomputeTopicMastery, advanceTopicSRS } from '../lib/topicMastery'
import { generateNotifications } from '../lib/notificationGenerator'
import { scheduleDailyReminder } from '../lib/pushNotifications'
import { checkAchievements } from '../lib/achievements'
import { showAchievementToast } from '../components/AchievementToast'
import type { QueueItem } from '../lib/dailyQueueEngine'
import type { Flashcard } from '../db/schema'

const SESSION_START_KEY = (profileId: string, date: string) => `session_start_${profileId}_${date}`
const CRAM_KEY = (profileId: string) => `cramMode_${profileId}`

export default function DailyQueue() {
  const navigate = useNavigate()
  const { activeProfile } = useExamProfile()
  const profileId = activeProfile?.id
  const { topics, streak, weeklyHours } = useKnowledgeGraph(profileId)
  const { startSession, endSession } = useStudySession(profileId)

  const today = new Date().toISOString().slice(0, 10)
  const [showStartOverlay, setShowStartOverlay] = useState(false)
  const [timeAvailable, setTimeAvailable] = useState<number | undefined>(undefined)
  const [showCompletion, setShowCompletion] = useState(false)
  const [flippedCard, setFlippedCard] = useState<string | null>(null)
  const [conceptRevealed, setConceptRevealed] = useState(false)

  // Block 1B: Single session tracking
  const sessionStartRef = useRef<number>(0)
  const sessionStartedRef = useRef(false)

  // Check for cram mode
  const cramMode = profileId ? localStorage.getItem(CRAM_KEY(profileId)) === 'true' : false

  const {
    queue, currentItem, completedCount, totalCount,
    remainingMinutes, completeItem, skipItem, isQueueEmpty,
  } = useDailyQueue(profileId, timeAvailable, cramMode)

  // Check if we should show start overlay
  useEffect(() => {
    if (!profileId) return
    const key = SESSION_START_KEY(profileId, today)
    if (!localStorage.getItem(key)) {
      setShowStartOverlay(true)
    }
  }, [profileId, today])

  // Block 1B: End session on unmount or queue completion
  useEffect(() => {
    return () => {
      if (sessionStartedRef.current) {
        endSession().catch(() => {})
        sessionStartedRef.current = false
      }
    }
  }, [endSession])

  // Show completion when queue empty
  useEffect(() => {
    if (isQueueEmpty && completedCount > 0) {
      // End the single session
      if (sessionStartedRef.current) {
        endSession().catch(() => {})
        sessionStartedRef.current = false
      }

      // Block 1C: Trigger notifications after completion (idempotent — won't duplicate)
      if (profileId) {
        generateNotifications(profileId).catch(() => {})
      }

      // Block 2: Schedule daily reminder
      if (profileId) {
        scheduleDailyReminder(profileId).catch(() => {})
      }

      // Block 4: Check achievements
      if (profileId) {
        checkAchievements(profileId).then(newlyUnlocked => {
          for (const a of newlyUnlocked) showAchievementToast(a)
        }).catch(() => {})
      }

      setShowCompletion(true)
    }
  }, [isQueueEmpty, completedCount, profileId, endSession])

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

  const handleStartSession = useCallback((minutes: number) => {
    if (profileId) {
      localStorage.setItem(SESSION_START_KEY(profileId, today), 'true')
      // Block 1B: Start ONE session for the whole queue visit
      startSession('review').catch(() => {})
      sessionStartRef.current = Date.now()
      sessionStartedRef.current = true
    }
    setTimeAvailable(minutes)
    setShowStartOverlay(false)
  }, [profileId, today, startSession])

  const handleComplete = useCallback((itemId: string) => {
    setFlippedCard(null)
    setConceptRevealed(false)
    completeItem(itemId)
  }, [completeItem])

  const handleSkip = useCallback((itemId: string) => {
    setFlippedCard(null)
    setConceptRevealed(false)
    skipItem(itemId)
  }, [skipItem])

  if (!activeProfile) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <p className="text-[var(--text-muted)]">Create a profile to start your daily queue.</p>
      </div>
    )
  }

  const completionData: SessionCompletionData = {
    activityType: 'flashcards',
    timeSpentSeconds: Math.round((Date.now() - (sessionStartRef.current || Date.now())) / 1000),
    streak,
    weeklyHours,
    weeklyTarget: activeProfile.weeklyTargetHours,
  }

  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 animate-fade-in">
      {/* Start Overlay */}
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

      {/* Completion Overlay */}
      {showCompletion && (
        <SessionCompletionOverlay
          data={completionData}
          onDismiss={() => setShowCompletion(false)}
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

      {/* Current Item */}
      {currentItem ? (
        <div className={`glass-card p-6 mb-4 ${cramMode ? 'border border-red-500/20' : ''}`}>
          {/* Item type badge */}
          <div className="flex items-center gap-2 mb-3">
            <ItemTypeIcon type={currentItem.type} />
            <span className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
              {currentItem.type.replace('-', ' ')}
            </span>
            <span className="text-xs text-[var(--text-faint)]">·</span>
            <span className="text-xs text-[var(--text-muted)]">{currentItem.subjectName}</span>
          </div>

          <h2 className="text-lg font-semibold text-[var(--text-heading)] mb-1">{currentItem.topicName}</h2>
          <p className="text-sm text-[var(--text-muted)] mb-4">~{currentItem.estimatedMinutes} min</p>

          {/* Render based on type — with rating UIs */}
          {currentItem.type === 'flashcard-review' && (
            <FlashcardReviewInline
              item={currentItem}
              profileId={profileId}
              flippedCard={flippedCard}
              onFlip={(id) => setFlippedCard(flippedCard === id ? null : id)}
              onComplete={handleComplete}
            />
          )}

          {currentItem.type === 'exercise' && (
            <ExerciseInline
              item={currentItem}
              profileId={profileId}
              onComplete={handleComplete}
            />
          )}

          {currentItem.type === 'concept-quiz' && (
            <ConceptQuizInline
              item={currentItem}
              profileId={profileId}
              revealed={conceptRevealed}
              onReveal={() => setConceptRevealed(true)}
              onComplete={handleComplete}
            />
          )}

          {currentItem.type === 'reading' && (
            <ReadingInline item={currentItem} />
          )}

          {/* Action buttons — only show generic Done for reading type */}
          {currentItem.type === 'reading' && (
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => handleComplete(currentItem.id)}
                className="flex-1 btn-primary py-2.5 text-sm font-semibold flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                Done
              </button>
              <button
                onClick={() => handleSkip(currentItem.id)}
                className="btn-secondary py-2.5 text-sm px-4 flex items-center gap-2"
              >
                <SkipForward className="w-4 h-4" />
                Skip
              </button>
            </div>
          )}

          {/* Skip button for non-reading types (rating buttons handle completion) */}
          {currentItem.type !== 'reading' && (
            <div className="flex justify-end mt-4">
              <button
                onClick={() => handleSkip(currentItem.id)}
                className="btn-secondary py-2 text-sm px-4 flex items-center gap-2"
              >
                <SkipForward className="w-4 h-4" />
                Skip
              </button>
            </div>
          )}
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

      {/* Queue preview (collapsed) */}
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
    case 'reading': return <RotateCw className="w-4 h-4 text-emerald-500" />
    default: return <ArrowRight className="w-4 h-4 text-[var(--text-muted)]" />
  }
}

// ─── Block 1A: Flashcard review with per-card SM-2 rating ──────

const RATING_BUTTONS = [
  { quality: 1, label: 'Again', color: 'bg-red-500/15 text-red-600 hover:bg-red-500/25' },
  { quality: 3, label: 'Hard', color: 'bg-orange-500/15 text-orange-600 hover:bg-orange-500/25' },
  { quality: 4, label: 'Good', color: 'bg-blue-500/15 text-blue-600 hover:bg-blue-500/25' },
  { quality: 5, label: 'Easy', color: 'bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/25' },
]

function FlashcardReviewInline({
  item, profileId, flippedCard, onFlip, onComplete,
}: {
  item: QueueItem
  profileId: string | undefined
  flippedCard: string | null
  onFlip: (id: string) => void
  onComplete: (itemId: string) => void
}) {
  const [ratings, setRatings] = useState<Map<string, number>>(new Map())
  const [isSubmitting, setIsSubmitting] = useState(false)
  // Block 5B: AI explain for struggling cards
  const [aiExplainCardId, setAiExplainCardId] = useState<string | null>(null)
  const [aiExplainText, setAiExplainText] = useState('')
  const [aiExplainLoading, setAiExplainLoading] = useState(false)

  const cards = useLiveQuery(async () => {
    if (!item.flashcardIds?.length) return []
    return db.flashcards.where('id').anyOf(item.flashcardIds).toArray()
  }, [item.flashcardIds]) ?? []

  if (cards.length === 0) return <p className="text-sm text-[var(--text-muted)]">Loading cards...</p>

  const allRated = cards.length > 0 && cards.every(c => ratings.has(c.id))

  const handleRate = (cardId: string, quality: number) => {
    setRatings(prev => new Map(prev).set(cardId, quality))
  }

  const handleFinish = async () => {
    if (!profileId) return
    setIsSubmitting(true)
    try {
      // Import rateCard logic inline to avoid hook rules
      for (const card of cards) {
        const quality = ratings.get(card.id)
        if (quality === undefined) continue

        const { calculateSM2 } = await import('../lib/spacedRepetition')
        const result = calculateSM2(quality, {
          id: card.id, front: card.front, back: card.back,
          easeFactor: card.easeFactor, interval: card.interval,
          repetitions: card.repetitions, nextReviewDate: card.nextReviewDate,
          lastRating: card.lastRating,
        })
        await db.flashcards.update(card.id, {
          easeFactor: result.easeFactor,
          interval: result.interval,
          repetitions: result.repetitions,
          nextReviewDate: result.nextReviewDate,
          lastRating: quality,
        })
        if (card.topicId) {
          await recomputeTopicMastery(card.topicId)
          await advanceTopicSRS(card.topicId, quality)
        }
      }
      onComplete(item.id)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Block 5B: Check if card is struggling — use in-session rating or stored history
  const isStruggling = (card: Flashcard) => {
    const sessionRating = ratings.get(card.id)
    if (sessionRating !== undefined) return sessionRating <= 2
    return card.repetitions === 0
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--text-muted)]">{cards.length} cards to review</p>
      {cards.slice(0, 5).map(card => (
        <div key={card.id} className="glass-card p-4">
          <div
            onClick={() => onFlip(card.id)}
            className="cursor-pointer hover:ring-1 hover:ring-[var(--accent-text)]/30 rounded-lg transition-all"
          >
            <p className="text-sm font-medium text-[var(--text-heading)]">{card.front}</p>
            {flippedCard === card.id ? (
              <p className="text-sm text-[var(--text-body)] mt-2 pt-2 border-t border-[var(--border-card)]">{card.back}</p>
            ) : (
              <p className="text-xs text-[var(--text-faint)] mt-1">Tap to reveal</p>
            )}
          </div>

          {/* Rating buttons — show after flip */}
          {flippedCard === card.id && (
            <div className="flex gap-1.5 mt-3 pt-3 border-t border-[var(--border-card)]">
              {RATING_BUTTONS.map(btn => (
                <button
                  key={btn.quality}
                  onClick={() => handleRate(card.id, btn.quality)}
                  className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    ratings.get(card.id) === btn.quality
                      ? btn.color + ' ring-1 ring-current'
                      : 'bg-[var(--bg-input)] text-[var(--text-muted)] hover:text-[var(--text-body)]'
                  }`}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          )}

          {/* Block 5B: AI explain for struggling cards */}
          {flippedCard === card.id && isStruggling(card) && aiExplainCardId !== card.id && (
            <button
              onClick={() => setAiExplainCardId(card.id)}
              className="mt-2 text-xs text-[var(--accent-text)] hover:underline flex items-center gap-1"
            >
              <Sparkles className="w-3 h-3" /> Struggling? Let AI explain
            </button>
          )}

          {aiExplainCardId === card.id && (
            <div className="mt-2 p-3 rounded-lg bg-[var(--bg-input)] text-sm">
              {aiExplainLoading ? (
                <div className="flex items-center gap-2 text-[var(--text-muted)]">
                  <Loader2 className="w-3 h-3 animate-spin" /> Getting explanation...
                </div>
              ) : aiExplainText ? (
                <p className="text-[var(--text-body)] whitespace-pre-wrap">{aiExplainText}</p>
              ) : (
                <p className="text-[var(--text-muted)]">
                  Explain: <strong>{card.front}</strong> → {card.back}
                </p>
              )}
            </div>
          )}
        </div>
      ))}
      {cards.length > 5 && (
        <p className="text-xs text-[var(--text-muted)]">+{cards.length - 5} more cards</p>
      )}

      {/* Finish Review button */}
      <button
        onClick={handleFinish}
        disabled={!allRated || isSubmitting}
        className="w-full btn-primary py-2.5 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-40 mt-2"
      >
        {isSubmitting ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
        ) : (
          <><CheckCircle2 className="w-4 h-4" /> Finish Review {allRated ? '' : `(${ratings.size}/${cards.length} rated)`}</>
        )}
      </button>
    </div>
  )
}

// ─── Block 1A: Exercise with self-assessment ──────

const EXERCISE_RATINGS = [
  { score: 0.2, label: "Didn't Get It", color: 'bg-red-500/15 text-red-600 hover:bg-red-500/25' },
  { score: 0.5, label: 'Partially', color: 'bg-orange-500/15 text-orange-600 hover:bg-orange-500/25' },
  { score: 0.9, label: 'Got It', color: 'bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/25' },
]

function ExerciseInline({
  item, profileId, onComplete,
}: {
  item: QueueItem
  profileId: string | undefined
  onComplete: (itemId: string) => void
}) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  const exercise = useLiveQuery(
    () => item.exerciseId ? db.exercises.get(item.exerciseId) : undefined,
    [item.exerciseId]
  )

  if (!exercise) return <p className="text-sm text-[var(--text-muted)]">Loading exercise...</p>

  const handleRate = async (score: number) => {
    if (!profileId || !item.exerciseId) return
    setIsSubmitting(true)
    try {
      // Record attempt
      await db.exerciseAttempts.put({
        id: crypto.randomUUID(),
        exerciseId: item.exerciseId,
        examProfileId: profileId,
        score,
        createdAt: new Date().toISOString(),
      })
      // Update exercise status
      await db.exercises.update(item.exerciseId, {
        status: score >= 0.7 ? 'completed' : 'attempted',
        lastAttemptScore: score,
        attemptCount: exercise.attemptCount + 1,
      })
      // Recompute topic mastery
      if (item.topicId) {
        await recomputeTopicMastery(item.topicId)
      }
      onComplete(item.id)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-medium text-[var(--text-muted)]">Exercise #{exercise.exerciseNumber}</span>
        <span className="text-xs text-[var(--text-faint)]">· Difficulty: {'★'.repeat(exercise.difficulty)}{'☆'.repeat(5 - exercise.difficulty)}</span>
      </div>
      <div className="glass-card p-4 text-sm text-[var(--text-body)] whitespace-pre-wrap mb-4">{exercise.text}</div>

      {/* Self-assessment buttons */}
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
    </div>
  )
}

// ─── Block 1A: Concept quiz with self-assessment ──────

const CONCEPT_RATINGS = [
  { quality: 1, label: "Couldn't Explain", color: 'bg-red-500/15 text-red-600 hover:bg-red-500/25' },
  { quality: 3, label: 'Struggled', color: 'bg-orange-500/15 text-orange-600 hover:bg-orange-500/25' },
  { quality: 5, label: 'Could Explain', color: 'bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/25' },
]

function ConceptQuizInline({
  item, profileId, revealed, onReveal, onComplete,
}: {
  item: QueueItem
  profileId: string | undefined
  revealed: boolean
  onReveal: () => void
  onComplete: (itemId: string) => void
}) {
  const [isSubmitting, setIsSubmitting] = useState(false)

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
      onComplete(item.id)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div>
      <h3 className="font-medium text-[var(--text-heading)] mb-2">{card.title}</h3>
      <p className="text-sm text-[var(--text-muted)] mb-3">Can you explain this concept?</p>
      {!revealed ? (
        <button onClick={onReveal} className="btn-secondary text-sm px-4 py-2">
          Reveal Key Points
        </button>
      ) : (
        <>
          <div className="glass-card p-4 space-y-1 mb-4">
            {keyPoints.map((point, i) => (
              <p key={i} className="text-sm text-[var(--text-body)]">• {point}</p>
            ))}
            {card.example && (
              <p className="text-sm text-[var(--text-muted)] mt-2 pt-2 border-t border-[var(--border-card)]">
                Example: {card.example}
              </p>
            )}
          </div>

          {/* Self-assessment buttons */}
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
        </>
      )}
    </div>
  )
}

function ReadingInline({ item }: { item: QueueItem }) {
  return (
    <div>
      <p className="text-sm text-[var(--text-body)]">{item.readingContent ?? 'Review the material for this topic.'}</p>
      <p className="text-xs text-[var(--text-muted)] mt-2">Mark as done when you've finished reading.</p>
    </div>
  )
}
