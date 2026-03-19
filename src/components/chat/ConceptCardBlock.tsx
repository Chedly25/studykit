import { useState, useEffect } from 'react'
import { BookOpen, Check, HelpCircle } from 'lucide-react'
import { db } from '../../db'
import { MathText } from '../MathText'
import type { ConceptCard } from '../../db/schema'

interface ConceptCardBlockProps {
  cardId: string
  onQuizMe?: (topic: string) => void
}

export function ConceptCardBlock({ cardId, onQuizMe }: ConceptCardBlockProps) {
  const [card, setCard] = useState<ConceptCard | null>(null)
  const [mastered, setMastered] = useState(false)

  useEffect(() => {
    db.conceptCards.get(cardId).then(c => {
      if (c) {
        setCard(c)
        setMastered(c.mastery >= 0.8)
      }
    })
  }, [cardId])

  if (!card) {
    return (
      <div className="my-3 glass-card p-4 animate-pulse">
        <div className="h-4 bg-[var(--bg-input)] rounded w-1/3 mb-3" />
        <div className="h-3 bg-[var(--bg-input)] rounded w-full mb-2" />
        <div className="h-3 bg-[var(--bg-input)] rounded w-2/3" />
      </div>
    )
  }

  let keyPoints: string[] = []
  let connections: string[] = []
  try { keyPoints = JSON.parse(card.keyPoints) } catch { /* empty */ }
  try { connections = JSON.parse(card.relatedCardIds) } catch { /* empty */ }

  const handleGotIt = async () => {
    setMastered(true)
    await db.conceptCards.update(cardId, { mastery: 1, updatedAt: new Date().toISOString() })
  }

  return (
    <div className={`my-3 glass-card overflow-hidden transition-all ${mastered ? 'ring-1 ring-green-500/30' : ''}`}>
      {/* Accent bar */}
      <div className="h-1 bg-[var(--accent-text)]" />

      <div className="p-4">
        {/* Header */}
        <div className="flex items-start gap-2 mb-3">
          <div className="p-1.5 rounded-lg bg-[var(--accent-bg)] flex-shrink-0">
            <BookOpen className="w-4 h-4 text-[var(--accent-text)]" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-[var(--text-heading)]">{card.title}</h4>
            {card.sourceReference && (
              <span className="text-[10px] text-[var(--text-muted)]">{card.sourceReference}</span>
            )}
          </div>
          {mastered && <Check className="w-4 h-4 text-green-500 flex-shrink-0" />}
        </div>

        {/* Key points */}
        <ul className="space-y-1.5 mb-3">
          {keyPoints.map((point, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-[var(--text-body)]">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-text)] mt-1.5 flex-shrink-0" />
              <MathText>{point}</MathText>
            </li>
          ))}
        </ul>

        {/* Example */}
        {card.example && (
          <div className="rounded-lg bg-[var(--accent-bg)]/50 border border-[var(--accent-text)]/10 px-3 py-2 mb-3">
            <p className="text-xs text-[var(--text-body)]"><MathText>{card.example}</MathText></p>
          </div>
        )}

        {/* Connections */}
        {connections.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {connections.map((conn, i) => (
              <span
                key={i}
                className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--bg-input)] text-[var(--text-muted)]"
              >
                {conn}
              </span>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2 border-t border-[var(--border-card)]">
          {!mastered && (
            <button
              onClick={handleGotIt}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-green-500/10 text-green-600 hover:bg-green-500/20 transition-colors"
            >
              <Check className="w-3 h-3" /> Got it
            </button>
          )}
          {onQuizMe && (
            <button
              onClick={() => onQuizMe(card.title)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-[var(--bg-input)] text-[var(--text-muted)] hover:bg-[var(--accent-bg)] hover:text-[var(--accent-text)] transition-colors"
            >
              <HelpCircle className="w-3 h-3" /> Quiz me
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
