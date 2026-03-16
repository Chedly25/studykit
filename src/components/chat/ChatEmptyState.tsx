import { useTranslation } from 'react-i18next'
import { Brain, BookOpen, Target, FileText, Calendar, HelpCircle, Zap } from 'lucide-react'

interface SuggestionChip {
  icon: React.ReactNode
  label: string
  subtitle?: string
  prompt: string
}

interface Props {
  suggestions: SuggestionChip[]
  onSend: (prompt: string) => void
}

export function ChatEmptyState({ suggestions, onSend }: Props) {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="w-12 h-12 rounded-2xl bg-[var(--accent-bg)] flex items-center justify-center mb-5">
        <Brain className="w-7 h-7 text-[var(--accent-text)]" />
      </div>
      <h2 className="text-2xl font-[family-name:var(--font-display)] font-bold text-[var(--text-heading)] mb-2 text-center">
        {t('ai.emptyStateGreeting')}
      </h2>
      <p className="text-[var(--text-muted)] mb-8 text-center">
        {t('ai.emptyStateSubtitle')}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg">
        {suggestions.map((chip, i) => (
          <button
            key={i}
            onClick={() => onSend(chip.prompt)}
            className="glass-card glass-card-hover cursor-pointer px-4 py-3 text-left flex items-start gap-3"
          >
            <div className="text-[var(--accent-text)] mt-0.5 flex-shrink-0">
              {chip.icon}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium text-[var(--text-heading)] truncate">{chip.label}</div>
              {chip.subtitle && (
                <div className="text-xs text-[var(--text-muted)] mt-0.5">{chip.subtitle}</div>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

// Icon mapping for suggestion generation
export const suggestionIcons = {
  helpWith: <BookOpen className="w-4 h-4" />,
  review: <Target className="w-4 h-4" />,
  explainSource: <FileText className="w-4 h-4" />,
  studyPlan: <Calendar className="w-4 h-4" />,
  focusToday: <Zap className="w-4 h-4" />,
  quizWeak: <HelpCircle className="w-4 h-4" />,
}
