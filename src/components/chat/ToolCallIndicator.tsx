import { Loader2 } from 'lucide-react'

const toolLabels: Record<string, string> = {
  getKnowledgeGraph: 'Reading knowledge graph...',
  getWeakTopics: 'Finding weak topics...',
  getReadinessScore: 'Computing readiness score...',
  getStudyStats: 'Fetching study stats...',
  getDueFlashcards: 'Checking due flashcards...',
  getUpcomingDeadlines: 'Checking deadlines...',
  generateQuestions: 'Preparing practice questions...',
  generateFlashcards: 'Creating flashcards...',
  logQuestionResult: 'Recording your answer...',
  updateTopicConfidence: 'Updating confidence...',
  createFlashcardDeck: 'Creating flashcard deck...',
  addAssignment: 'Adding assignment...',
  getStudyRecommendation: 'Building study plan...',
}

interface Props {
  toolName: string | null
}

export function ToolCallIndicator({ toolName }: Props) {
  if (!toolName) return null

  const label = toolLabels[toolName] ?? `Running ${toolName}...`

  return (
    <div className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--accent-text)]">
      <Loader2 className="w-3.5 h-3.5 animate-spin" />
      <span>{label}</span>
    </div>
  )
}
