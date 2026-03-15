import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Send } from 'lucide-react'

const MAX_LENGTH = 4000

interface Props {
  onSend: (message: string) => void
  disabled?: boolean
  placeholder?: string
}

export function ChatInput({ onSend, disabled, placeholder }: Props) {
  const { t } = useTranslation()
  const [text, setText] = useState('')
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = 'auto'
      ref.current.style.height = Math.min(ref.current.scrollHeight, 150) + 'px'
    }
  }, [text])

  const handleSend = () => {
    const trimmed = text.trim()
    if (!trimmed || disabled || trimmed.length > MAX_LENGTH) return
    onSend(trimmed)
    setText('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex items-end gap-2 p-3 border-t border-[var(--border-card)] bg-[var(--bg-card)]">
      <textarea
        ref={ref}
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder ?? t('ai.typeMessage')}
        disabled={disabled}
        rows={1}
        className="flex-1 resize-none bg-[var(--bg-input)] border border-[var(--border-input)] rounded-lg px-3 py-2 text-sm text-[var(--text-body)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-text)]/30 disabled:opacity-50"
      />
      <div className="flex flex-col items-center gap-1 flex-shrink-0">
        {text.length > MAX_LENGTH * 0.8 && (
          <span className={`text-xs ${text.length > MAX_LENGTH ? 'text-red-400' : 'text-[var(--text-faint)]'}`}>
            {text.length}/{MAX_LENGTH}
          </span>
        )}
        <button
          onClick={handleSend}
          disabled={disabled || !text.trim() || text.trim().length > MAX_LENGTH}
          className="p-2 rounded-lg bg-[var(--accent-text)] text-white disabled:opacity-40 hover:opacity-90 transition-opacity"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
