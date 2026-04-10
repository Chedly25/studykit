/**
 * Inline action: explain an exercise (and optionally show reference solution).
 *
 * Uses InlineAIExplanation with the exercise text as content. If a solution
 * is available, it's appended so the AI can ground its explanation.
 */
import { useState, useEffect } from 'react'
import { X, BookOpen } from 'lucide-react'
import { useExamProfile } from '../../hooks/useExamProfile'
import { InlineAIExplanation } from '../queue/InlineAIExplanation'

interface Props {
  exerciseId: string
  exerciseText: string
  topicName: string
  solutionText?: string
  onClose: () => void
}

export function InlineExerciseExplainAction({ exerciseId, exerciseText, topicName, solutionText, onClose }: Props) {
  const { activeProfile } = useExamProfile()
  const profileId = activeProfile?.id
  const [dismissed, setDismissed] = useState(false)

  // Reset when switching exercise
  useEffect(() => {
    setDismissed(false)
  }, [exerciseId])

  if (dismissed) {
    return null
  }

  const content = solutionText
    ? `Exercise:\n${exerciseText}\n\nReference solution:\n${solutionText}`
    : `Exercise:\n${exerciseText}`

  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-[var(--accent-text)]" />
          <p className="text-sm font-semibold text-[var(--text-heading)]">Exercise walkthrough</p>
        </div>
        <button onClick={onClose} className="p-1 text-[var(--text-muted)] hover:text-[var(--text-body)]">
          <X className="w-4 h-4" />
        </button>
      </div>
      <InlineAIExplanation
        content={content}
        topicName={topicName}
        onDismiss={() => { setDismissed(true); onClose() }}
        examProfileId={profileId}
      />
    </div>
  )
}
