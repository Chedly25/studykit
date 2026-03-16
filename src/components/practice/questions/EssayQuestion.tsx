import { useTranslation } from 'react-i18next'

interface EssayQuestionProps {
  value?: string
  readOnly?: boolean
  onChange: (value: string) => void
}

export function EssayQuestion({
  value = '',
  readOnly,
  onChange,
}: EssayQuestionProps) {
  const { t } = useTranslation()
  const wordCount = value.trim() ? value.trim().split(/\s+/).length : 0

  return (
    <div className="space-y-2">
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={readOnly}
        placeholder={t('ai.typeAnswer')}
        rows={8}
        className={`input-field w-full resize-y min-h-[160px] ${readOnly ? 'opacity-80' : ''}`}
      />
      <div className="text-xs text-[var(--text-muted)] text-right">
        {wordCount} words
      </div>
    </div>
  )
}
