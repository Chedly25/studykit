import { Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

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
  searchSources: 'Searching your sources...',
  getDocumentContent: 'Reading document...',
  listSources: 'Listing your sources...',
  getCalibrationData: 'Analyzing confidence calibration...',
  getErrorPatterns: 'Analyzing error patterns...',
  generateStudyPlan: 'Generating your study plan...',
  getStudyPlan: 'Loading your study plan...',
}

interface Props {
  toolName: string | null
}

export function ToolCallIndicator({ toolName }: Props) {
  const { t } = useTranslation()

  if (!toolName) return null

  const key = `ai.toolCalls.${toolName}`
  const translated = t(key)
  const label = translated !== key ? translated : (toolLabels[toolName] ?? t('ai.toolCalls.default'))

  return (
    <div className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-[var(--accent-bg)]">
      <Loader2 className="w-4 h-4 animate-spin text-[var(--accent-text)]" />
      <span className="text-sm text-[var(--accent-text)]">{label}</span>
    </div>
  )
}
