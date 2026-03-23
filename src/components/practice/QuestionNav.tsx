import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface QuestionNavProps {
  currentIndex: number
  totalQuestions: number
  answeredIds: Set<string>
  questionIds: string[]
  onNavigate: (index: number) => void
  flaggedIds?: Set<string>
}

export function QuestionNav({
  currentIndex,
  totalQuestions,
  answeredIds,
  questionIds,
  onNavigate,
  flaggedIds,
}: QuestionNavProps) {
  useTranslation()

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => onNavigate(currentIndex - 1)}
        disabled={currentIndex <= 0}
        className="p-2 rounded-lg border border-[var(--border-card)] text-[var(--text-body)] hover:bg-[var(--bg-input)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      <div className="flex items-center gap-1 flex-wrap justify-center">
        {questionIds.map((id, i) => {
          const isCurrent = i === currentIndex
          const isAnswered = answeredIds.has(id)
          const isFlagged = flaggedIds?.has(id) ?? false

          return (
            <button
              key={id}
              onClick={() => onNavigate(i)}
              className={`w-8 h-8 rounded-full text-xs font-medium transition-all ${
                isCurrent
                  ? 'bg-[var(--accent-text)] text-white scale-110'
                  : isAnswered
                  ? 'bg-[var(--accent-bg)] text-[var(--accent-text)] border border-[var(--accent-text)]'
                  : 'border border-[var(--border-card)] text-[var(--text-muted)] hover:border-[var(--text-muted)]'
              }${isFlagged ? ' ring-2 ring-amber-400' : ''}`}
            >
              {i + 1}
            </button>
          )
        })}
      </div>

      <button
        onClick={() => onNavigate(currentIndex + 1)}
        disabled={currentIndex >= totalQuestions - 1}
        className="p-2 rounded-lg border border-[var(--border-card)] text-[var(--text-body)] hover:bg-[var(--bg-input)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  )
}
