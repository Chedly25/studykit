import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Send, Loader2, X, Lightbulb, Bot } from 'lucide-react'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

interface PlanChatLaneProps {
  messages: ChatMessage[]
  isLoading: boolean
  streamingText: string
  currentToolCall: string | null
  suggestions: string[]
  onSend: (text: string) => void
  onDismissSuggestion: (index: number) => void
}

export function PlanChatLane({
  messages, isLoading, streamingText, currentToolCall,
  suggestions, onSend, onDismissSuggestion,
}: PlanChatLaneProps) {
  const { t } = useTranslation()
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingText])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return
    onSend(input.trim())
    setInput('')
  }

  const quickActions = [
    t('wizard.chatHint1', 'No Wednesdays'),
    t('wizard.chatHint2', 'More practice exams'),
    t('wizard.chatHint3', 'Focus on weakest topics'),
  ]

  return (
    <div className="glass-card p-3">
      {/* Suggestion bubbles */}
      {suggestions.length > 0 && (
        <div className="space-y-2 mb-3">
          {suggestions.map((suggestion, i) => (
            <div
              key={i}
              className="flex items-start gap-2 p-2.5 rounded-lg bg-[var(--color-warning-bg)] border border-[var(--color-warning-border)]"
            >
              <Lightbulb className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-[var(--text-body)] flex-1">{suggestion}</p>
              <button
                onClick={() => onDismissSuggestion(i)}
                className="p-0.5 rounded hover:bg-amber-500/20 text-amber-600"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Chat messages */}
      {messages.length > 0 && (
        <div className="lg:max-h-[60vh] max-h-48 overflow-y-auto space-y-2 mb-3 scroll-smooth">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <Bot className="w-4 h-4 text-[var(--accent-text)] flex-shrink-0 mt-1" />
              )}
              <div
                className={`max-w-[80%] rounded-lg px-3 py-1.5 text-xs ${
                  msg.role === 'user'
                    ? 'bg-[var(--accent-text)] text-white'
                    : 'bg-[var(--bg-input)] text-[var(--text-body)]'
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {/* Streaming text */}
          {(isLoading && streamingText) && (
            <div className="flex gap-2 justify-start">
              <Bot className="w-4 h-4 text-[var(--accent-text)] flex-shrink-0 mt-1" />
              <div className="max-w-[80%] rounded-lg px-3 py-1.5 text-xs bg-[var(--bg-input)] text-[var(--text-body)]">
                {streamingText}
              </div>
            </div>
          )}

          {/* Tool call indicator */}
          {isLoading && currentToolCall && !streamingText && (
            <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>{currentToolCall === 'suggestChange' ? 'Thinking...' : `Updating plan...`}</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      )}

      {/* Quick action chips — show when no messages */}
      {messages.length === 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {quickActions.map((action, i) => (
            <button
              key={i}
              onClick={() => onSend(action)}
              className="px-2.5 py-1 rounded-lg text-[10px] font-medium bg-[var(--bg-input)] text-[var(--text-muted)] hover:bg-[var(--accent-bg)] hover:text-[var(--accent-text)] transition-colors"
            >
              {action}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={t('wizard.chatPlaceholder', 'Tell me how to adjust your plan...')}
          disabled={isLoading}
          className="flex-1 bg-[var(--bg-input)] border border-[var(--border-card)] rounded-lg px-3 py-2 text-sm text-[var(--text-body)] placeholder:text-[var(--text-muted)]/50 focus:outline-none focus:ring-1 focus:ring-[var(--accent-text)] disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!input.trim() || isLoading}
          className="p-2 rounded-lg bg-[var(--accent-text)] text-white disabled:opacity-40 hover:opacity-90 transition-opacity"
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </form>
    </div>
  )
}
