import { BookOpen, ListChecks, Brain, ArrowRight } from 'lucide-react'

export function ItemTypeIcon({ type }: { type: string }) {
  switch (type) {
    case 'flashcard-review': return <BookOpen className="w-4 h-4 text-purple-500" />
    case 'exercise': return <ListChecks className="w-4 h-4 text-orange-500" />
    case 'concept-quiz': return <Brain className="w-4 h-4 text-blue-500" />
    default: return <ArrowRight className="w-4 h-4 text-[var(--text-muted)]" />
  }
}
