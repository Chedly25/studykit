import { useState, useEffect } from 'react'
import { Loader2, X } from 'lucide-react'
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
  onCancel?: () => void
}

export function ToolCallIndicator({ toolName, onCancel }: Props) {
  const { t } = useTranslation()
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    setElapsed(0)
    if (!toolName) return
    const interval = setInterval(() => setElapsed(s => s + 1), 1000)
    return () => clearInterval(interval)
  }, [toolName])

  if (!toolName) return null

  const key = `ai.toolCalls.${toolName}`
  const translated = t(key)
  const label = translated !== key ? translated : (toolLabels[toolName] ?? t('ai.toolCalls.default'))

  return (
    <div className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-[var(--accent-bg)]">
      <Loader2 className="w-4 h-4 animate-spin text-[var(--accent-text)]" />
      <span className="text-sm text-[var(--accent-text)]">
        {label}{elapsed > 0 ? ` (${elapsed}s)` : ''}
      </span>
      {onCancel && (
        <button
          onClick={onCancel}
          className="p-0.5 rounded-full hover:bg-[var(--accent-text)]/10 text-[var(--accent-text)] transition-colors"
          title="Cancel"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}
