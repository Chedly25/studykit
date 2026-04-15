import { useState, useRef, useEffect } from 'react'
import { Scale, Send, Loader2, Trash2 } from 'lucide-react'
import { useLegalChat } from '../hooks/useLegalChat'
import { LegalMessageBubble } from '../components/legal/LegalMessageBubble'
import { LegalArticlesPanel } from '../components/legal/LegalArticlesPanel'

const SUGGESTIONS = [
  'Quelles sont les conditions de validité d\'un contrat ?',
  'Quelles sont les peines encourues pour un vol aggravé ?',
  'Un employeur peut-il licencier sans cause réelle et sérieuse ?',
  'Quels sont les droits du locataire en cas de logement insalubre ?',
]

export default function LegalChat() {
  const [input, setInput] = useState('')
  const [articlesOpen, setArticlesOpen] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const {
    messages,
    isLoading,
    streamingText,
    currentToolCall,
    lastArticles,
    sendMessage,
    cancel,
    clear,
  } = useLegalChat()

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingText])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return
    sendMessage(input.trim())
    setInput('')
    setArticlesOpen(false)
  }

  const handleSuggestion = (text: string) => {
    sendMessage(text)
    setArticlesOpen(false)
  }

  // Extract displayable messages (skip tool_use/tool_result blocks)
  const displayMessages = messages.filter(m => {
    if (typeof m.content === 'string') return true
    if (Array.isArray(m.content)) {
      return m.content.some(b => b.type === 'text')
    }
    return false
  }).map(m => {
    const text = typeof m.content === 'string'
      ? m.content
      : (m.content as Array<{ type: string; text?: string }>).filter(b => b.type === 'text').map(b => b.text ?? '').join('')
    return { role: m.role as 'user' | 'assistant', text }
  }).filter(m => m.text.trim())

  const hasMessages = displayMessages.length > 0 || streamingText

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-card)]">
        <div className="flex items-center gap-3">
          <Scale className="w-5 h-5 text-[var(--accent-text)]" />
          <div>
            <h1 className="text-lg font-semibold text-[var(--text-heading)]">Recherche juridique</h1>
            <p className="text-xs text-[var(--text-muted)]">15 codes français — 65 000 articles</p>
          </div>
        </div>
        {hasMessages && (
          <button onClick={clear} className="p-2 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-muted)]" title="Nouvelle recherche">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        {!hasMessages ? (
          <div className="flex flex-col items-center justify-center h-full gap-8">
            <div className="text-center">
              <Scale className="w-12 h-12 mx-auto mb-4 text-[var(--text-muted)] opacity-40" />
              <h2 className="text-xl font-semibold text-[var(--text-heading)] mb-2">Posez votre question de droit</h2>
              <p className="text-sm text-[var(--text-muted)] max-w-md">
                Recherche sémantique dans le Code civil, Code pénal, Code du travail, Code de commerce et 11 autres codes français.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
              {SUGGESTIONS.map((s, i) => (
                <button
                  key={i}
                  onClick={() => handleSuggestion(s)}
                  className="text-left text-sm px-4 py-3 rounded-xl border border-[var(--border-card)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {displayMessages.map((m, i) => (
              <LegalMessageBubble key={i} role={m.role} content={m.text} />
            ))}
            {streamingText && (
              <LegalMessageBubble role="assistant" content={streamingText} />
            )}
            {isLoading && !streamingText && currentToolCall && (
              <div className="flex items-center gap-2 text-sm text-[var(--text-muted)] px-4 py-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                {currentToolCall === 'searchLegalCodes'
                  ? 'Recherche dans les codes français...'
                  : currentToolCall === 'createFlashcardDeck'
                    ? 'Création des flashcards...'
                    : 'Traitement...'}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Articles panel */}
      {lastArticles.length > 0 && !isLoading && (
        <div className="px-4 pb-2">
          <LegalArticlesPanel
            articles={lastArticles}
            open={articlesOpen}
            onToggle={() => setArticlesOpen(!articlesOpen)}
          />
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="px-4 pb-4 pt-2">
        <div className="flex items-center gap-2 p-2 rounded-xl border border-[var(--border-card)] bg-[var(--bg-card)] focus-within:border-[var(--accent-text)] transition-colors">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ex : Quelles sont les conditions de validité d'un contrat ?"
            className="flex-1 bg-transparent px-2 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
            disabled={isLoading}
          />
          {isLoading ? (
            <button type="button" onClick={cancel} className="p-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20">
              <X className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              className="p-2 rounded-lg bg-[var(--accent-bg)] text-[var(--accent-text)] disabled:opacity-30 hover:opacity-90 transition-opacity"
            >
              <Send className="w-4 h-4" />
            </button>
          )}
        </div>
      </form>
    </div>
  )
}

function X({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18" /><path d="m6 6 12 12" />
    </svg>
  )
}
