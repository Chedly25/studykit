import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { db } from '../../db'
import { recomputeTopicMastery, advanceTopicSRS } from '../../lib/topicMastery'
import { useAnswerEvaluator } from '../../hooks/useAnswerEvaluator'
import { AnswerInput } from './AnswerInput'
import { EvaluationResult } from './EvaluationResult'
import { InlineAIExplanation } from './InlineAIExplanation'
import { MathText } from '../MathText'
import { trackContentInteraction } from '../../lib/effectivenessTracker'
import type { QueueItemHandlerProps } from './types'

const RATING_BUTTONS = [
  { quality: 1, labelKey: 'queue.ratingAgain', key: '1', color: 'bg-red-500/15 text-red-600 hover:bg-red-500/25' },
  { quality: 3, labelKey: 'queue.ratingHard', key: '2', color: 'bg-orange-500/15 text-orange-600 hover:bg-orange-500/25' },
  { quality: 4, labelKey: 'queue.ratingGood', key: '3', color: 'bg-blue-500/15 text-blue-600 hover:bg-blue-500/25' },
  { quality: 5, labelKey: 'queue.ratingEasy', key: '4', color: 'bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/25' },
]

export function FlashcardReviewInline({
  item, profileId, onComplete, onRated, onRetry, examProfileId, isPro, voiceProps,
}: QueueItemHandlerProps) {
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
      const { calculateSM2 } = await import('../../lib/spacedRepetition')
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
              {t('queue.evaluating')}
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
