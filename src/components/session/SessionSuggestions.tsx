import { useMemo } from 'react'
import { Sparkles } from 'lucide-react'
import type { Topic } from '../../db/schema'
import type { SessionInsight } from '../../db/schema'
import type { InlineAction } from '../actions/types'

/**
 * A chip is either a structured action (opens an inline widget) or a question
 * (sends a message into chat). The split is deliberate: most "suggestions"
 * are actions that should produce real UI, not chat prompts.
 */
type Chip =
  | { kind: 'action'; label: string; action: InlineAction }
  | { kind: 'question'; label: string; message: string }

interface SessionSuggestionsProps {
  topic: Topic
  dueFlashcards: number
  sessionInsights: SessionInsight[]
  /** Called when the student picks a structured action chip. */
  onAction: (action: InlineAction) => void
  /** Called when the student picks a question chip (sends to chat). */
  onSend: (message: string) => void
}

export function SessionSuggestions({ topic, dueFlashcards, sessionInsights, onAction, onSend }: SessionSuggestionsProps) {
  const suggestions = useMemo(() => {
    const chips: Chip[] = []
    const mastery = topic.mastery
    const name = topic.name
    const topicId = topic.id

    // Check for open questions from last session on this topic — these stay as chat questions
    const relevantInsight = sessionInsights.find(i => {
      try {
        const topics: string[] = JSON.parse(i.conceptsDiscussed || '[]')
        return topics.some(t => t.toLowerCase().includes(name.toLowerCase()))
      } catch { return false }
    })

    if (relevantInsight) {
      try {
        const openQs: string[] = JSON.parse(relevantInsight.openQuestions || '[]')
        if (openQs.length > 0) {
          chips.push({ kind: 'question', label: `Continue: ${openQs[0]}`, message: `Continue: ${openQs[0]}` })
        }
      } catch { /* ignore */ }
    }

    // Mastery-based suggestions — mostly structured actions
    if (mastery < 0.3) {
      chips.push({
        kind: 'action',
        label: `Explain ${name} from the basics`,
        action: { type: 'explain-topic', topicId, topicName: name, level: 'basics' },
      })
      chips.push({ kind: 'question', label: 'What are the key concepts I need to know?', message: 'What are the key concepts I need to know?' })
    } else if (mastery < 0.6) {
      chips.push({
        kind: 'action',
        label: `Quiz me on ${name}`,
        action: { type: 'quiz-topic', topicId, topicName: name, difficulty: 'medium' },
      })
      chips.push({
        kind: 'action',
        label: 'What are the common mistakes on this topic?',
        action: { type: 'common-mistakes', topicId, topicName: name },
      })
    } else {
      chips.push({
        kind: 'action',
        label: 'Test me with hard questions',
        action: { type: 'quiz-topic', topicId, topicName: name, difficulty: 'hard' },
      })
      chips.push({ kind: 'question', label: 'What edge cases should I know for the exam?', message: 'What edge cases should I know for the exam?' })
    }

    if (dueFlashcards > 0) {
      chips.push({
        kind: 'action',
        label: `Review my ${dueFlashcards} due flashcards`,
        action: { type: 'review-flashcards', topicId, count: dueFlashcards },
      })
    }

    chips.push({ kind: 'question', label: "What's most important for my exam?", message: "What's most important for my exam?" })

    return chips.slice(0, 6)
  }, [topic, dueFlashcards, sessionInsights])

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div className="w-12 h-12 rounded-full bg-[var(--accent-bg)] flex items-center justify-center mb-4">
        <Sparkles className="w-6 h-6 text-[var(--accent-text)]" />
      </div>
      <h2 className="text-lg font-semibold text-[var(--text-heading)] mb-1">{topic.name}</h2>
      <p className="text-sm text-[var(--text-muted)] mb-6">
        {topic.mastery < 0.3
          ? 'Ready to build your foundation?'
          : topic.mastery < 0.6
          ? 'Let\u2019s strengthen your understanding.'
          : 'Time to push deeper.'}
      </p>
      <div className="flex flex-wrap justify-center gap-2 max-w-lg">
        {suggestions.map((chip, i) => (
          <button
            key={i}
            onClick={() => chip.kind === 'action' ? onAction(chip.action) : onSend(chip.message)}
            className="px-3 py-2 rounded-xl text-sm bg-[var(--bg-input)] text-[var(--text-body)] hover:bg-[var(--accent-bg)] hover:text-[var(--accent-text)] transition-colors border border-[var(--border-card)]"
          >
            {chip.label}
          </button>
        ))}
      </div>
    </div>
  )
}
