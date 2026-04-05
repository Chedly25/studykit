/**
 * Modal shown before each section begins in a simulation exam.
 * Displays section name, time, question count, and instructions.
 * Timer does not start until "Begin Section" is clicked.
 */
import { useTranslation } from 'react-i18next'
import { Clock, FileText, ArrowRight } from 'lucide-react'

interface Props {
  sectionName: string
  sectionType: string
  sectionIndex: number
  totalSections: number
  timeAllocation: number
  questionCount: number
  instructions?: string
  onBegin: () => void
}

export function SectionInstructionsOverlay({
  sectionName, sectionType, sectionIndex, totalSections,
  timeAllocation, questionCount, instructions, onBegin,
}: Props) {
  const { t } = useTranslation()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="glass-card p-6 max-w-md w-full mx-4 space-y-4 animate-scale-in">
        <div>
          <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1">
            {t('practiceExam.sectionOf', 'Section {{current}} of {{total}}', { current: sectionIndex + 1, total: totalSections })}
          </p>
          <h2 className="text-xl font-bold text-[var(--text-heading)]">{sectionName}</h2>
        </div>

        <div className="flex gap-4 text-sm text-[var(--text-muted)]">
          <span className="flex items-center gap-1.5">
            <Clock className="w-4 h-4" /> {timeAllocation} min
          </span>
          <span className="flex items-center gap-1.5">
            <FileText className="w-4 h-4" /> {questionCount} {t('examFormat.questions')}
          </span>
          <span className="capitalize">{sectionType}</span>
        </div>

        {instructions && (
          <div className="p-3 rounded-lg bg-[var(--bg-input)] border-l-2 border-[var(--accent-text)]">
            <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-1">
              {t('examFormat.instructions')}
            </p>
            <p className="text-sm text-[var(--text-body)] leading-relaxed">{instructions}</p>
          </div>
        )}

        <button
          onClick={onBegin}
          className="btn-primary w-full py-3 text-sm font-semibold flex items-center justify-center gap-2"
        >
          {t('practiceExam.beginSection')} <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
