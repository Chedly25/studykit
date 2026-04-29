import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { Loader2 } from 'lucide-react'
import { db } from '../../db'
import { recomputeTopicMastery, advanceTopicSRS } from '../../lib/topicMastery'
import { useAnswerEvaluator } from '../../hooks/useAnswerEvaluator'
import { AnswerInput } from './AnswerInput'
import { EvaluationResult } from './EvaluationResult'
import { InlineAIExplanation } from './InlineAIExplanation'
import { MathText } from '../MathText'
import { trackContentInteraction } from '../../lib/effectivenessTracker'
import { useKeyboardShortcut } from '../../lib/keyboard'
import type { QueueItemHandlerProps } from './types'

const CONCEPT_RATINGS = [
  { quality: 1, labelKey: 'queue.ratingCouldntExplain', color: 'bg-[var(--color-error-bg)] text-[var(--color-error)] hover:bg-[var(--color-error-bg)]' },
  { quality: 3, labelKey: 'queue.ratingStruggled', color: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)] hover:bg-[var(--color-warning-bg)]' },
  { quality: 5, labelKey: 'queue.ratingCouldExplain', color: 'bg-[var(--color-success-bg)] text-[var(--color-success)] hover:bg-[var(--color-success-bg)]' },
]

export function ConceptQuizInline({
  item, profileId: _profileId, onComplete, onRated, onRetry, examProfileId, isPro, voiceProps,
}: QueueItemHandlerProps) {
  const { t } = useTranslation()
  const [revealed, setRevealed] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [explanationCtx, setExplanationCtx] = useState<string | null>(null)
  // AI active recall
  const [phase, setPhase] = useState<'answering' | 'evaluating' | 'evaluated' | 'self-rating'>('answering')
  const [userAnswer, setUserAnswer] = useState('')
  const evaluator = useAnswerEvaluator(examProfileId)

  // Reset revealed state when item changes
  useEffect(() => {
    setRevealed(false)
  }, [item.id])

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

  // Keyboard shortcuts for concept quiz self-rating
  const handleRateCqRef = useRef<((q: number) => void) | null>(null)
  const canRateConcept = phase === 'self-rating' && revealed && !explanationCtx && !isSubmitting

  useKeyboardShortcut('1', () => handleRateCqRef.current?.(1), {
    label: "Rate: Couldn't explain",
    scope: 'Concept Quiz',
    enabled: canRateConcept,
  })
  useKeyboardShortcut('2', () => handleRateCqRef.current?.(3), {
    label: 'Rate: Struggled',
    scope: 'Concept Quiz',
    enabled: canRateConcept,
  })
  useKeyboardShortcut('3', () => handleRateCqRef.current?.(5), {
    label: 'Rate: Could explain',
    scope: 'Concept Quiz',
    enabled: canRateConcept,
  })

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
        const { calculateSM2 } = await import('../../lib/spacedRepetition')
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
  handleRateCqRef.current = handleRate

  const handleAnswerSubmit = (answer: string) => {
    setUserAnswer(answer)
    if (isPro && answer.trim()) {
      setPhase('evaluating')
      evaluator.evaluate(card.title, keyPoints.join('; '), answer, item.topicName)
    } else {
      setRevealed(true)
      setPhase('self-rating')
    }
  }

  const handleAnswerSkip = () => {
    setRevealed(true)
    setPhase('self-rating')
  }

  return (
    <div>
      <h3 className="font-medium text-[var(--text-heading)] mb-2"><MathText>{card.title}</MathText></h3>
      <p className="text-sm text-[var(--text-muted)] mb-3">{t('queue.canYouExplain')}</p>

      {/* Phase: answering — show AnswerInput */}
      {phase === 'answering' && !revealed && (
        <AnswerInput
          placeholder={t('queue.explainInOwnWords')}
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
            {t('queue.evaluating')}
          </div>
        </div>
      )}

      {/* Phase: evaluated — show key points (revealed) + EvaluationResult */}
      {phase === 'evaluated' && (
        <>
          <div className="glass-card p-4 space-y-1 mb-4">
            {keyPoints.map((point, i) => (
              <p key={`point-${i}`} className="text-sm text-[var(--text-body)]">• <MathText>{point}</MathText></p>
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
            <button onClick={() => setRevealed(true)} className="btn-secondary text-sm px-4 py-2">
              {t('queue.revealKeyPoints')}
            </button>
          ) : (
            <>
              <div className="glass-card p-4 space-y-1 mb-4">
                {keyPoints.map((point, i) => (
                  <p key={`point-${i}`} className="text-sm text-[var(--text-body)]">• <MathText>{point}</MathText></p>
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
                    {CONCEPT_RATINGS.map((btn, idx) => (
                      <button
                        key={btn.quality}
                        onClick={() => handleRate(btn.quality)}
                        disabled={isSubmitting}
                        className={`flex-1 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 ${btn.color}`}
                      >
                        <span className="text-[10px] opacity-50 mr-1">{idx + 1}</span>{t(btn.labelKey)}
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
