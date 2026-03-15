import { useState, useRef, useEffect } from 'react'
import { Send } from 'lucide-react'

interface Props {
  onSend: (message: string) => void
  disabled?: boolean
  placeholder?: string
}

export function ChatInput({ onSend, disabled, placeholder = 'Ask anything about your exam prep...' }: Props) {
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
    if (!trimmed || disabled) return
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
        placeholder={placeholder}
        disabled={disabled}
        rows={1}
        className="flex-1 resize-none bg-[var(--bg-input)] border border-[var(--border-input)] rounded-lg px-3 py-2 text-sm text-[var(--text-body)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-text)]/30 disabled:opacity-50"
      />
      <button
        onClick={handleSend}
        disabled={disabled || !text.trim()}
        className="p-2 rounded-lg bg-[var(--accent-text)] text-white disabled:opacity-40 hover:opacity-90 transition-opacity flex-shrink-0"
      >
        <Send className="w-4 h-4" />
      </button>
    </div>
  )
}
