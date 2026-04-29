import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { Loader2, Flag, ExternalLink, MessageCircle, Star } from 'lucide-react'
import { useKeyboardShortcut } from '../../lib/keyboard'
import { toast } from 'sonner'
import { db } from '../../db'
import { recomputeTopicMastery } from '../../lib/topicMastery'
import { useExerciseAI } from '../../hooks/useExerciseAI'
import { AnswerInput } from './AnswerInput'
import { EvaluationResult } from './EvaluationResult'
import { InlineAIExplanation } from './InlineAIExplanation'
import { MathText } from '../MathText'
import { trackContentInteraction } from '../../lib/effectivenessTracker'
import type { QueueItemHandlerProps } from './types'

const EXERCISE_RATINGS = [
  { score: 0.2, labelKey: 'queue.ratingDidntGetIt', color: 'bg-[var(--color-error-bg)] text-[var(--color-error)] hover:bg-[var(--color-error-bg)]' },
  { score: 0.5, labelKey: 'queue.ratingPartially', color: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)] hover:bg-[var(--color-warning-bg)]' },
  { score: 0.9, labelKey: 'queue.ratingGotIt', color: 'bg-[var(--color-success-bg)] text-[var(--color-success)] hover:bg-[var(--color-success-bg)]' },
]

export function ExerciseInline({
  item, profileId, onComplete, onRated, onRetry, examProfileId, isPro, voiceProps,
}: QueueItemHandlerProps) {
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

  // Keyboard shortcuts for exercise self-rating + continue
  const handleRateExRef = useRef<(score: number) => void>(() => {})
  const inExerciseRating = phase === 'self-rating' && !explanationCtx && !isSubmitting
  const canRateExercise = inExerciseRating && !rated
  const canContinueExercise = inExerciseRating && rated

  useKeyboardShortcut('1', () => handleRateExRef.current(0.2), {
    label: 'Rate: Wrong',
    scope: 'Exercise',
    enabled: canRateExercise,
  })
  useKeyboardShortcut('2', () => handleRateExRef.current(0.5), {
    label: 'Rate: Partial',
    scope: 'Exercise',
    enabled: canRateExercise,
  })
  useKeyboardShortcut('3', () => handleRateExRef.current(0.9), {
    label: 'Rate: Correct',
    scope: 'Exercise',
    enabled: canRateExercise,
  })
  useKeyboardShortcut('enter', () => onComplete(item.id), {
    label: 'Continue to next item',
    scope: 'Exercise',
    enabled: canContinueExercise,
  })

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
      const { calculateSM2 } = await import('../../lib/spacedRepetition')
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
  handleRateExRef.current = handleRate

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
        const { calculateSM2 } = await import('../../lib/spacedRepetition')
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
      const { calculateSM2 } = await import('../../lib/spacedRepetition')
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
        <span className="text-xs text-[var(--text-faint)] flex items-center gap-0.5">· {t('queue.difficulty')}: {Array.from({ length: 5 }, (_, i) => <Star key={i} className={`w-3 h-3 ${i < exercise.difficulty ? 'text-[var(--color-warning)] fill-[var(--color-warning)]' : 'text-[var(--text-faint)]'}`} />)}</span>
        <span className="flex-1" />
        <button
          onClick={async () => {
            if (item.exerciseId) {
              await db.exercises.update(item.exerciseId, { hidden: true })
              toast.success(t('queue.exerciseHidden'))
              onComplete(item.id)
            }
          }}
          className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--color-error)] hover:bg-[var(--color-error-bg)]"
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
          placeholder={t('queue.writeSolution')}
          onSubmit={handleAnswerSubmit}
          onSkip={handleAnswerSkip}
          {...voiceProps}
        />
      )}

      {/* Phase: grading — show streaming feedback */}
      {phase === 'grading' && (
        <div className="space-y-2">
          {exerciseAI.feedback && (
            <div className="glass-card p-4 text-sm text-[var(--text-body)] whitespace-pre-wrap border-l-2 border-[var(--color-info-border)]">
              <MathText>{exerciseAI.feedback}</MathText>
            </div>
          )}
          {exerciseAI.isStreaming && (
            <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
              <Loader2 className="w-4 h-4 animate-spin" />
              {t('queue.gradingAnswer')}
            </div>
          )}
        </div>
      )}

      {/* Phase: graded — show AI feedback + score + accept/override */}
      {phase === 'graded' && !explanationCtx && (
        <div className="space-y-3">
          {exerciseAI.feedback && (
            <div className="glass-card p-4 text-sm text-[var(--text-body)] whitespace-pre-wrap border-l-2 border-[var(--color-info-border)]">
              <MathText>{exerciseAI.feedback}</MathText>
            </div>
          )}
          {exerciseAI.score !== null && (
            <div className="flex items-center gap-2">
              <span className={`text-sm font-bold px-2.5 py-1 rounded-lg ${
                exerciseAI.score >= 80 ? 'bg-[var(--color-success-bg)] text-[var(--color-success)]' :
                exerciseAI.score >= 50 ? 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]' :
                'bg-[var(--color-error-bg)] text-[var(--color-error)]'
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
                <div className="glass-card p-3 mt-1 text-sm text-[var(--text-body)] whitespace-pre-wrap border-l-2 border-[var(--color-success-border)]">
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
            {EXERCISE_RATINGS.map((btn, idx) => (
              <button
                key={btn.score}
                onClick={() => handleRate(btn.score)}
                disabled={isSubmitting}
                className={`flex-1 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 ${btn.color}`}
              >
                <span className="text-[10px] opacity-50 mr-1">{idx + 1}</span>{t(btn.labelKey)}
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
                <div className="glass-card p-3 mt-1 text-sm text-[var(--text-body)] whitespace-pre-wrap border-l-2 border-[var(--color-success-border)]">
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
            {t('common.continue')} <span className="text-[10px] opacity-60 ml-1">Enter</span>
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
