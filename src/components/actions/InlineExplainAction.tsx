/**
 * Inline action: explain a topic.
 *
 * For a given topicId + level, fetches the topic's concept card content
 * (if any) and streams an explanation via InlineAIExplanation. If no concept
 * content is available, falls back to explaining based on the topic name alone.
 *
 * Reuses the existing explanation prompt inside InlineAIExplanation — no new
 * prompt is introduced here. (If the explanation quality is insufficient for
 * "from basics" vs "deep", we'll iterate on the prompt in a separate session.)
 */
import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { X, Sparkles } from 'lucide-react'
import { db } from '../../db'
import { useExamProfile } from '../../hooks/useExamProfile'
import { InlineAIExplanation } from '../queue/InlineAIExplanation'

interface Props {
  topicId: string
  topicName: string
  level?: 'basics' | 'deep'
  onClose: () => void
}

export function InlineExplainAction({ topicId, topicName, level = 'basics', onClose }: Props) {
  const { activeProfile } = useExamProfile()
  const profileId = activeProfile?.id
  const [dismissed, setDismissed] = useState(false)

  // Load concept cards for this topic to give the explanation something to ground on
  const conceptCards = useLiveQuery(
    () => profileId
      ? db.conceptCards.where('examProfileId').equals(profileId).filter(c => c.topicId === topicId).toArray()
      : [],
    [profileId, topicId],
  ) ?? []

  // Build content: concatenate card titles + key points. If no cards, use topic name.
  const content = conceptCards.length > 0
    ? conceptCards
        .slice(0, 5)
        .map(c => {
          try {
            const keyPoints = JSON.parse(c.keyPoints) as string[]
            return `${c.title}\n${keyPoints.slice(0, 4).map(p => `- ${p}`).join('\n')}`
          } catch {
            return c.title
          }
        })
        .join('\n\n')
    : `Topic: ${topicName}`

  const framedTopic = level === 'basics' ? `${topicName} (from the basics)` : `${topicName} (deep dive)`

  // Reset dismissed state when the action changes
  useEffect(() => {
    setDismissed(false)
  }, [topicId, level])

  if (dismissed) {
    return null
  }

  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[var(--accent-text)]" />
          <p className="text-sm font-semibold text-[var(--text-heading)]">
            {level === 'basics' ? 'Foundation' : 'Deep dive'}: {topicName}
          </p>
        </div>
        <button onClick={onClose} className="p-1 text-[var(--text-muted)] hover:text-[var(--text-body)]">
          <X className="w-4 h-4" />
        </button>
      </div>
      <InlineAIExplanation
        content={content}
        topicName={framedTopic}
        onDismiss={() => { setDismissed(true); onClose() }}
        examProfileId={profileId}
        topicId={topicId}
      />
    </div>
  )
}
