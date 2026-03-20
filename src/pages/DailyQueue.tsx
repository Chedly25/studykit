/**
 * Unified Daily Queue — one queue, one "Next" button.
 * Route: /queue
 */
import { useState, useEffect, useCallback } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, SkipForward, CheckCircle2, BookOpen, ListChecks, Brain, RotateCw, Zap } from 'lucide-react'
import { db } from '../db'
import { useExamProfile } from '../hooks/useExamProfile'
import { useKnowledgeGraph } from '../hooks/useKnowledgeGraph'
import { useDailyQueue } from '../hooks/useDailyQueue'
import { useStudySession } from '../hooks/useStudySession'
import { SessionStartOverlay } from '../components/SessionStartOverlay'
import { SessionCompletionOverlay, type SessionCompletionData } from '../components/SessionCompletionOverlay'
import { decayedMastery } from '../lib/knowledgeGraph'
import type { QueueItem } from '../lib/dailyQueueEngine'

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
  const [sessionStartTime, setSessionStartTime] = useState(0)
  const [flippedCard, setFlippedCard] = useState<string | null>(null)
  const [conceptRevealed, setConceptRevealed] = useState(false)

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

  // Start session tracking
  useEffect(() => {
    if (currentItem && profileId) {
      setSessionStartTime(Date.now())
      startSession('review', undefined, currentItem.topicId).catch(() => {})
    }
  }, [currentItem?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Show completion when queue empty
  useEffect(() => {
    if (isQueueEmpty && completedCount > 0) {
      endSession().catch(() => {})
      setShowCompletion(true)
    }
  }, [isQueueEmpty, completedCount]) // eslint-disable-line react-hooks/exhaustive-deps

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
    }
    setTimeAvailable(minutes)
    setShowStartOverlay(false)
  }, [profileId, today])

  const handleComplete = useCallback((itemId: string) => {
    endSession().catch(() => {})
    setFlippedCard(null)
    setConceptRevealed(false)
    completeItem(itemId)
  }, [completeItem, endSession])

  const handleSkip = useCallback((itemId: string) => {
    endSession().catch(() => {})
    setFlippedCard(null)
    setConceptRevealed(false)
    skipItem(itemId)
  }, [skipItem, endSession])

  if (!activeProfile) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <p className="text-[var(--text-muted)]">Create a profile to start your daily queue.</p>
      </div>
    )
  }

  const completionData: SessionCompletionData = {
    activityType: 'flashcards',
    timeSpentSeconds: Math.round((Date.now() - (sessionStartTime || Date.now())) / 1000),
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

          {/* Render based on type */}
          {currentItem.type === 'flashcard-review' && (
            <FlashcardReviewInline
              item={currentItem}
              flippedCard={flippedCard}
              onFlip={(id) => setFlippedCard(flippedCard === id ? null : id)}
            />
          )}

          {currentItem.type === 'exercise' && (
            <ExerciseInline item={currentItem} />
          )}

          {currentItem.type === 'concept-quiz' && (
            <ConceptQuizInline
              item={currentItem}
              revealed={conceptRevealed}
              onReveal={() => setConceptRevealed(true)}
            />
          )}

          {currentItem.type === 'reading' && (
            <ReadingInline item={currentItem} />
          )}

          {/* Action buttons */}
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

function FlashcardReviewInline({ item, flippedCard, onFlip }: { item: QueueItem; flippedCard: string | null; onFlip: (id: string) => void }) {
  const cards = useLiveQuery(async () => {
    if (!item.flashcardIds?.length) return []
    return db.flashcards.where('id').anyOf(item.flashcardIds).toArray()
  }, [item.flashcardIds]) ?? []

  if (cards.length === 0) return <p className="text-sm text-[var(--text-muted)]">Loading cards...</p>

  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--text-muted)]">{cards.length} cards to review</p>
      {cards.slice(0, 5).map(card => (
        <div
          key={card.id}
          onClick={() => onFlip(card.id)}
          className="glass-card p-4 cursor-pointer hover:ring-1 hover:ring-[var(--accent-text)]/30 transition-all"
        >
          <p className="text-sm font-medium text-[var(--text-heading)]">{card.front}</p>
          {flippedCard === card.id && (
            <p className="text-sm text-[var(--text-body)] mt-2 pt-2 border-t border-[var(--border-card)]">{card.back}</p>
          )}
          {flippedCard !== card.id && (
            <p className="text-xs text-[var(--text-faint)] mt-1">Tap to reveal</p>
          )}
        </div>
      ))}
      {cards.length > 5 && (
        <p className="text-xs text-[var(--text-muted)]">+{cards.length - 5} more cards</p>
      )}
    </div>
  )
}

function ExerciseInline({ item }: { item: QueueItem }) {
  const exercise = useLiveQuery(
    () => item.exerciseId ? db.exercises.get(item.exerciseId) : undefined,
    [item.exerciseId]
  )

  if (!exercise) return <p className="text-sm text-[var(--text-muted)]">Loading exercise...</p>

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-medium text-[var(--text-muted)]">Exercise #{exercise.exerciseNumber}</span>
        <span className="text-xs text-[var(--text-faint)]">· Difficulty: {'★'.repeat(exercise.difficulty)}{'☆'.repeat(5 - exercise.difficulty)}</span>
      </div>
      <div className="glass-card p-4 text-sm text-[var(--text-body)] whitespace-pre-wrap">{exercise.text}</div>
    </div>
  )
}

function ConceptQuizInline({ item, revealed, onReveal }: { item: QueueItem; revealed: boolean; onReveal: () => void }) {
  const card = useLiveQuery(
    () => item.conceptCardId ? db.conceptCards.get(item.conceptCardId) : undefined,
    [item.conceptCardId]
  )

  if (!card) return <p className="text-sm text-[var(--text-muted)]">Loading concept...</p>

  let keyPoints: string[] = []
  try { keyPoints = JSON.parse(card.keyPoints) } catch { /* ignore */ }

  return (
    <div>
      <h3 className="font-medium text-[var(--text-heading)] mb-2">{card.title}</h3>
      <p className="text-sm text-[var(--text-muted)] mb-3">Can you explain this concept?</p>
      {!revealed ? (
        <button onClick={onReveal} className="btn-secondary text-sm px-4 py-2">
          Reveal Key Points
        </button>
      ) : (
        <div className="glass-card p-4 space-y-1">
          {keyPoints.map((point, i) => (
            <p key={i} className="text-sm text-[var(--text-body)]">• {point}</p>
          ))}
          {card.example && (
            <p className="text-sm text-[var(--text-muted)] mt-2 pt-2 border-t border-[var(--border-card)]">
              Example: {card.example}
            </p>
          )}
        </div>
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
