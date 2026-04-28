import { Check, BookOpen } from 'lucide-react'
import { useConceptCards } from '../../hooks/useConceptCards'

interface ConceptCardStripProps {
  examProfileId: string
  topicId: string
  onSelectCard?: (cardId: string) => void
}

export function ConceptCardStrip({ examProfileId, topicId, onSelectCard }: ConceptCardStripProps) {
  const { cards } = useConceptCards(examProfileId, topicId)

  if (cards.length === 0) return null

  return (
    <div className="px-4 py-2 border-b border-[var(--border-card)]">
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
        <span className="text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wider flex-shrink-0">
          <BookOpen className="w-3 h-3 inline mr-1" />
          {cards.length} concepts
        </span>
        {cards.map(card => {
          const mastered = card.mastery >= 0.8
          return (
            <button
              key={card.id}
              onClick={() => onSelectCard?.(card.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors flex-shrink-0 ${
                mastered
                  ? 'bg-[var(--color-success-bg)] text-[var(--color-success)]'
                  : 'bg-[var(--bg-input)] text-[var(--text-body)] hover:bg-[var(--accent-bg)] hover:text-[var(--accent-text)]'
              }`}
            >
              {mastered && <Check className="w-3 h-3" />}
              <span className="truncate max-w-[120px]">{card.title}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
