/**
 * Textarea for typing answers in the queue review flow.
 * Supports Ctrl+Enter / Cmd+Enter to submit.
 */
import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Send } from 'lucide-react'

interface Props {
  placeholder?: string
  onSubmit: (answer: string) => void
  onSkip?: () => void
  disabled?: boolean
  submitLabel?: string
}

export function AnswerInput({ placeholder, onSubmit, onSkip, disabled, submitLabel }: Props) {
  const { t } = useTranslation()
  const [value, setValue] = useState('')
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    // Auto-focus on mount
    const timer = setTimeout(() => ref.current?.focus(), 100)
    return () => clearTimeout(timer)
  }, [])

  const handleSubmit = () => {
    if (disabled) return
    onSubmit(value)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="space-y-2">
      <textarea
        ref={ref}
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder ?? t('queue.typeYourAnswer', 'Type your answer...')}
        disabled={disabled}
        className="w-full min-h-[80px] max-h-[200px] rounded-lg border border-[var(--border-card)] bg-[var(--bg-input)] px-3 py-2.5 text-sm text-[var(--text-body)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-text)] resize-y disabled:opacity-50"
        rows={3}
      />
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-[var(--text-faint)]">
          {t('queue.ctrlEnterHint', 'Ctrl+Enter to submit')}
        </span>
        <div className="flex gap-2">
          {onSkip && (
            <button
              onClick={onSkip}
              className="text-xs text-[var(--text-muted)] hover:text-[var(--text-body)] transition-colors"
            >
              {t('queue.skipToSelfRate', 'Skip — rate yourself')}
            </button>
          )}
          <button
            onClick={handleSubmit}
            disabled={disabled || !value.trim()}
            className="btn-primary text-sm px-4 py-1.5 flex items-center gap-1.5 disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            {submitLabel ?? t('queue.submitAnswer', 'Check my answer')}
          </button>
        </div>
      </div>
    </div>
  )
}
