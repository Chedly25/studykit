import { CheckCircle, XCircle } from 'lucide-react'

interface TrueFalseQuestionProps {
  selectedAnswer?: string
  correctAnswer?: string
  readOnly?: boolean
  onSelect: (answer: string) => void
}

export function TrueFalseQuestion({
  selectedAnswer,
  correctAnswer,
  readOnly,
  onSelect,
}: TrueFalseQuestionProps) {
  const showResults = readOnly && correctAnswer !== undefined

  const buttons = [
    { label: 'True', value: 'true' },
    { label: 'False', value: 'false' },
  ]

  return (
    <div className="grid grid-cols-2 gap-3">
      {buttons.map(({ label, value }) => {
        const isSelected = selectedAnswer?.toLowerCase() === value
        const isCorrect = showResults && correctAnswer?.toLowerCase() === value
        const isWrongSelected = showResults && isSelected && !isCorrect

        return (
          <button
            key={value}
            onClick={() => !readOnly && onSelect(value)}
            disabled={readOnly}
            className={`px-6 py-4 rounded-lg border text-base font-medium transition-all ${
              isCorrect
                ? 'border-[var(--color-success-border)] bg-[var(--color-success-bg)] text-[var(--color-success)] '
                : isWrongSelected
                ? 'border-[var(--color-error-border)] bg-[var(--color-error-bg)] text-[var(--color-error)] '
                : isSelected
                ? 'border-[var(--accent-text)] bg-[var(--accent-bg)] text-[var(--accent-text)]'
                : 'border-[var(--border-card)] text-[var(--text-body)] hover:border-[var(--text-muted)]'
            } ${readOnly ? 'cursor-default' : 'cursor-pointer'}`}
          >
            {label}
            {isCorrect && <CheckCircle className="inline w-4 h-4 ml-2" />}
            {isWrongSelected && <XCircle className="inline w-4 h-4 ml-2" />}
          </button>
        )
      })}
    </div>
  )
}
