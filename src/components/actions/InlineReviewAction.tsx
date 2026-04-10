/**
 * Inline action: review flashcards for a topic.
 * Thin wrapper around the existing ReviewView session component.
 */
import { X } from 'lucide-react'
import { useExamProfile } from '../../hooks/useExamProfile'
import { ReviewView } from '../session/ReviewView'

interface Props {
  topicId?: string
  onClose: () => void
}

export function InlineReviewAction({ topicId, onClose }: Props) {
  const { activeProfile } = useExamProfile()

  if (!activeProfile || !topicId) {
    return (
      <div className="glass-card p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold text-[var(--text-heading)]">Review flashcards</p>
          <button onClick={onClose} className="p-1 text-[var(--text-muted)] hover:text-[var(--text-body)]">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-[var(--text-muted)]">
          No topic selected for review. Start a session first.
        </p>
      </div>
    )
  }

  return (
    <div className="glass-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border-card)]">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          Flashcard review
        </p>
        <button onClick={onClose} className="p-1 text-[var(--text-muted)] hover:text-[var(--text-body)]">
          <X className="w-4 h-4" />
        </button>
      </div>
      <ReviewView
        examProfileId={activeProfile.id}
        topicId={topicId}
        onDone={onClose}
      />
    </div>
  )
}
