import { useMemo } from 'react'
import { Sparkles } from 'lucide-react'
import type { Topic } from '../../db/schema'
import type { SessionInsight } from '../../db/schema'

interface SessionSuggestionsProps {
  topic: Topic
  dueFlashcards: number
  sessionInsights: SessionInsight[]
  onSend: (message: string) => void
}

export function SessionSuggestions({ topic, dueFlashcards, sessionInsights, onSend }: SessionSuggestionsProps) {
  const suggestions = useMemo(() => {
    const chips: string[] = []
    const mastery = topic.mastery
    const name = topic.name

    // Check for open questions from last session on this topic
    const relevantInsight = sessionInsights.find(i => {
      try {
        const topics: string[] = JSON.parse(i.topicsCovered || '[]')
        return topics.some(t => t.toLowerCase().includes(name.toLowerCase()))
      } catch { return false }
    })

    if (relevantInsight) {
      try {
        const openQs: string[] = JSON.parse(relevantInsight.openQuestions || '[]')
        if (openQs.length > 0) {
          chips.push(`Continue: ${openQs[0]}`)
        }
      } catch { /* ignore */ }
    }

    // Mastery-based suggestions
    if (mastery < 0.3) {
      chips.push(`Explain ${name} from the basics`)
      chips.push('What are the key concepts I need to know?')
    } else if (mastery < 0.6) {
      chips.push(`Quiz me on ${name}`)
      chips.push('What are the common mistakes on this topic?')
    } else {
      chips.push('Test me with hard questions')
      chips.push('What edge cases should I know for the exam?')
    }

    if (dueFlashcards > 0) {
      chips.push(`Review my ${dueFlashcards} due flashcards`)
    }

    chips.push("What's most important for my exam?")

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
            onClick={() => onSend(chip)}
            className="px-3 py-2 rounded-xl text-sm bg-[var(--bg-input)] text-[var(--text-body)] hover:bg-[var(--accent-bg)] hover:text-[var(--accent-text)] transition-colors border border-[var(--border-card)]"
          >
            {chip}
          </button>
        ))}
      </div>
    </div>
  )
}
