import { useMemo } from 'react'
import { BookOpen, Check, HelpCircle } from 'lucide-react'
import { useConceptCards } from '../../hooks/useConceptCards'
import type { ConceptCard } from '../../db/schema'

interface CardsViewProps {
  examProfileId: string
  topicId: string
  onQuizMe?: (topic: string) => void
}

function CardItem({ card, onQuizMe }: { card: ConceptCard; onQuizMe?: (t: string) => void }) {
  const mastered = card.mastery >= 0.8
  let keyPoints: string[] = []
  try { keyPoints = JSON.parse(card.keyPoints) } catch { /* empty */ }

  return (
    <div className={`glass-card overflow-hidden transition-all ${mastered ? 'ring-1 ring-green-500/20' : ''}`}>
      <div className="h-1 bg-[var(--accent-text)]" />
      <div className="p-4">
        <div className="flex items-start gap-2 mb-2">
          <BookOpen className="w-4 h-4 text-[var(--accent-text)] mt-0.5 flex-shrink-0" />
          <h4 className="text-sm font-semibold text-[var(--text-heading)] flex-1">{card.title}</h4>
          {mastered && <Check className="w-4 h-4 text-green-500 flex-shrink-0" />}
        </div>

        <ul className="space-y-1 mb-3">
          {keyPoints.slice(0, 4).map((p, i) => (
            <li key={i} className="flex items-start gap-1.5 text-xs text-[var(--text-body)]">
              <span className="w-1 h-1 rounded-full bg-[var(--accent-text)] mt-1.5 flex-shrink-0" />
              {p}
            </li>
          ))}
        </ul>

        {card.example && (
          <div className="rounded bg-[var(--accent-bg)]/50 px-2.5 py-1.5 mb-3">
            <p className="text-[11px] text-[var(--text-body)] line-clamp-2">{card.example}</p>
          </div>
        )}

        {card.sourceReference && (
          <p className="text-[10px] text-[var(--text-muted)] mb-2">{card.sourceReference}</p>
        )}

        {onQuizMe && (
          <button
            onClick={() => onQuizMe(card.title)}
            className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium bg-[var(--bg-input)] text-[var(--text-muted)] hover:bg-[var(--accent-bg)] hover:text-[var(--accent-text)] transition-colors"
          >
            <HelpCircle className="w-3 h-3" /> Quiz me
          </button>
        )}
      </div>
    </div>
  )
}

export function CardsView({ examProfileId, topicId, onQuizMe }: CardsViewProps) {
  const { cards } = useConceptCards(examProfileId, topicId)

  const grouped = useMemo(() => {
    const newCards = cards.filter(c => c.mastery < 0.3)
    const learning = cards.filter(c => c.mastery >= 0.3 && c.mastery < 0.8)
    const mastered = cards.filter(c => c.mastery >= 0.8)
    return { newCards, learning, mastered }
  }, [cards])

  if (cards.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <BookOpen className="w-10 h-10 text-[var(--text-muted)] mx-auto mb-3" />
          <p className="text-sm text-[var(--text-muted)]">No concept cards yet.</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">Start chatting to build your knowledge board.</p>
        </div>
      </div>
    )
  }

  const renderGroup = (title: string, items: ConceptCard[], color: string) => {
    if (items.length === 0) return null
    return (
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <div className={`w-2 h-2 rounded-full ${color}`} />
          <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">{title} ({items.length})</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map(card => (
            <CardItem key={card.id} card={card} onQuizMe={onQuizMe} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-[960px] mx-auto">
        {renderGroup('New', grouped.newCards, 'bg-red-500')}
        {renderGroup('Learning', grouped.learning, 'bg-yellow-500')}
        {renderGroup('Mastered', grouped.mastered, 'bg-green-500')}
      </div>
    </div>
  )
}
