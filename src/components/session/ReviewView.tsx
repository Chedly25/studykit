import { useState, useMemo } from 'react'
import { BookOpen, Check, X, ArrowRight, Trophy } from 'lucide-react'
import { useConceptCards } from '../../hooks/useConceptCards'

interface ReviewViewProps {
  examProfileId: string
  topicId: string
  onDone: () => void
}

export function ReviewView({ examProfileId, topicId, onDone }: ReviewViewProps) {
  const { cards, updateMastery } = useConceptCards(examProfileId, topicId)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [reviewed, setReviewed] = useState(0)
  const [completed, setCompleted] = useState(false)

  // Prioritize cards by lowest mastery
  const sortedCards = useMemo(() =>
    [...cards].sort((a, b) => a.mastery - b.mastery),
    [cards]
  )

  if (cards.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <BookOpen className="w-10 h-10 text-[var(--text-muted)] mx-auto mb-3" />
          <p className="text-sm text-[var(--text-muted)]">No concept cards to review.</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">Build your knowledge board in the chat first.</p>
          <button onClick={onDone} className="btn-primary px-4 py-1.5 text-sm mt-4">
            Back to chat
          </button>
        </div>
      </div>
    )
  }

  if (completed) {
    const pct = Math.round((reviewed / sortedCards.length) * 100)
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <Trophy className="w-12 h-12 text-[var(--color-warning)] mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-[var(--text-heading)] mb-1">Review complete!</h3>
          <p className="text-sm text-[var(--text-muted)]">{reviewed} of {sortedCards.length} cards reviewed ({pct}%)</p>
          <button onClick={onDone} className="btn-primary px-6 py-2 mt-4">
            Back to chat
          </button>
        </div>
      </div>
    )
  }

  const card = sortedCards[currentIndex]
  if (!card) {
    setCompleted(true)
    return null
  }

  let keyPoints: string[] = []
  try { keyPoints = JSON.parse(card.keyPoints) } catch { /* empty */ }

  const handleRate = async (remembered: boolean) => {
    const newMastery = remembered
      ? Math.min(1, card.mastery + 0.2)
      : Math.max(0, card.mastery - 0.1)
    await updateMastery(card.id, newMastery)
    setReviewed(r => r + 1)
    setFlipped(false)
    if (currentIndex + 1 >= sortedCards.length) {
      setCompleted(true)
    } else {
      setCurrentIndex(i => i + 1)
    }
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6">
      {/* Progress */}
      <div className="w-full max-w-md mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-[var(--text-muted)]">{currentIndex + 1} of {sortedCards.length}</span>
          <button onClick={onDone} className="text-xs text-[var(--text-muted)] hover:text-[var(--text-body)]">
            Done
          </button>
        </div>
        <div className="w-full h-1.5 rounded-full bg-[var(--bg-input)] overflow-hidden">
          <div
            className="h-full rounded-full bg-[var(--accent-text)] transition-all"
            style={{ width: `${((currentIndex) / sortedCards.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Card */}
      <div
        className="w-full max-w-md glass-card overflow-hidden cursor-pointer transition-all hover:ring-1 hover:ring-[var(--accent-text)]/20"
        onClick={() => setFlipped(!flipped)}
      >
        <div className="h-1 bg-[var(--accent-text)]" />
        <div className="p-6">
          {!flipped ? (
            // Front: title only
            <div className="text-center py-8">
              <BookOpen className="w-8 h-8 text-[var(--accent-text)] mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-[var(--text-heading)]">{card.title}</h3>
              <p className="text-xs text-[var(--text-muted)] mt-2">Tap to reveal key points</p>
            </div>
          ) : (
            // Back: full content
            <div>
              <h4 className="text-sm font-semibold text-[var(--text-heading)] mb-3">{card.title}</h4>
              <ul className="space-y-1.5 mb-3">
                {keyPoints.map((p, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-[var(--text-body)]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-text)] mt-1.5 flex-shrink-0" />
                    {p}
                  </li>
                ))}
              </ul>
              {card.example && (
                <div className="rounded-lg bg-[var(--accent-bg)]/50 px-3 py-2">
                  <p className="text-xs text-[var(--text-body)]">{card.example}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Rating buttons (only when flipped) */}
      {flipped && (
        <div className="flex gap-3 mt-4">
          <button
            onClick={() => handleRate(false)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-[var(--color-error-bg)] text-[var(--color-error)] hover:bg-[var(--color-error-bg)] transition-colors"
          >
            <X className="w-4 h-4" /> Didn't know
          </button>
          <button
            onClick={() => handleRate(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-[var(--color-success-bg)] text-[var(--color-success)] hover:bg-[var(--color-success-bg)] transition-colors"
          >
            <Check className="w-4 h-4" /> Got it
          </button>
          <button
            onClick={() => {
              setFlipped(false)
              if (currentIndex + 1 >= sortedCards.length) {
                setCompleted(true)
              } else {
                setCurrentIndex(i => i + 1)
              }
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-[var(--bg-input)] text-[var(--text-muted)] hover:bg-[var(--accent-bg)] transition-colors"
          >
            <ArrowRight className="w-4 h-4" /> Skip
          </button>
        </div>
      )}
    </div>
  )
}
