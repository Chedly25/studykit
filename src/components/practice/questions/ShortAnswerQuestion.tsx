import { useTranslation } from 'react-i18next'

interface ShortAnswerQuestionProps {
  value?: string
  correctAnswer?: string
  isCorrect?: boolean
  readOnly?: boolean
  onChange: (value: string) => void
}

export function ShortAnswerQuestion({
  value = '',
  correctAnswer,
  isCorrect,
  readOnly,
  onChange,
}: ShortAnswerQuestionProps) {
  const { t } = useTranslation()
  const showResults = readOnly && correctAnswer !== undefined

  return (
    <div className="space-y-2">
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={readOnly}
        placeholder={t('ai.typeAnswer')}
        className={`input-field w-full ${
          showResults
            ? (isCorrect ?? value.trim().toLowerCase() === correctAnswer.trim().toLowerCase())
              ? 'border-[var(--color-success-border)] bg-[var(--color-success-bg)]'
              : 'border-[var(--color-error-border)] bg-[var(--color-error-bg)]'
            : ''
        }`}
      />
      <div className="text-xs text-[var(--text-muted)] text-right">
        {value.length} characters
      </div>
      {showResults && (
        <div className="text-sm text-[var(--text-muted)]">
          Correct answer: <span className="font-medium text-[var(--color-success)] ">{correctAnswer}</span>
        </div>
      )}
    </div>
  )
}
