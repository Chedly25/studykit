import { CheckCircle, XCircle } from 'lucide-react'

interface MCQQuestionProps {
  options: string[]
  selectedAnswer?: string
  correctAnswer?: string
  correctOptionIndex?: number
  readOnly?: boolean
  onSelect: (answer: string) => void
}

export function MCQQuestion({
  options,
  selectedAnswer,
  correctAnswer,
  correctOptionIndex,
  readOnly,
  onSelect,
}: MCQQuestionProps) {
  const showResults = readOnly && correctAnswer !== undefined

  return (
    <div className="space-y-2">
      {options.map((opt, i) => {
        const letter = String.fromCharCode(65 + i)
        const isSelected = selectedAnswer === opt
        const isCorrectOption = showResults && (
          correctOptionIndex !== undefined ? i === correctOptionIndex : opt === correctAnswer
        )
        const isWrongSelected = showResults && isSelected && !isCorrectOption

        return (
          <button
            key={i}
            onClick={() => !readOnly && onSelect(opt)}
            disabled={readOnly}
            className={`w-full text-left px-4 py-3 rounded-lg border text-sm transition-all ${
              isCorrectOption
                ? 'border-[var(--color-success-border)] bg-[var(--color-success-bg)] text-[var(--color-success)] '
                : isWrongSelected
                ? 'border-[var(--color-error-border)] bg-[var(--color-error-bg)] text-[var(--color-error)] '
                : isSelected
                ? 'border-[var(--accent-text)] bg-[var(--accent-bg)] text-[var(--accent-text)]'
                : 'border-[var(--border-card)] text-[var(--text-body)] hover:border-[var(--text-muted)]'
            } ${readOnly ? 'cursor-default' : 'cursor-pointer'}`}
          >
            <span className="font-medium mr-2">{letter}.</span>
            {opt}
            {isCorrectOption && <CheckCircle className="inline w-4 h-4 ml-2" />}
            {isWrongSelected && <XCircle className="inline w-4 h-4 ml-2" />}
          </button>
        )
      })}
    </div>
  )
}
