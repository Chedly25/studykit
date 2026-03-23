import { Flag } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface QuestionFlagProps {
  flagged: boolean
  onToggle: () => void
}

export function QuestionFlag({ flagged, onToggle }: QuestionFlagProps) {
  const { t } = useTranslation()

  return (
    <button
      onClick={onToggle}
      title={t('practiceExam.flagQuestion')}
      className={`p-1.5 rounded-lg transition-colors ${
        flagged
          ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
          : 'text-[var(--text-muted)] hover:text-[var(--text-body)] hover:bg-[var(--bg-input)]'
      }`}
    >
      <Flag className="w-4 h-4" fill={flagged ? 'currentColor' : 'none'} />
    </button>
  )
}
