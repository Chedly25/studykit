import { BookOpen, ListChecks, Brain, ArrowRight } from 'lucide-react'

export function ItemTypeIcon({ type }: { type: string }) {
  switch (type) {
    case 'flashcard-review': return <BookOpen className="w-4 h-4 text-[var(--color-tag-flashcard)]" />
    case 'exercise': return <ListChecks className="w-4 h-4 text-[var(--color-warning)]" />
    case 'concept-quiz': return <Brain className="w-4 h-4 text-[var(--color-info)]" />
    default: return <ArrowRight className="w-4 h-4 text-[var(--text-muted)]" />
  }
}
