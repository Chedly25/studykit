/**
 * CompanionWidget — the ambient CRFPA companion UI.
 *
 * Modes:
 * - `embedded`: takes up layout space (used on /accueil right panel)
 * - `floating`: FAB that expands (used on exercise pages)
 *
 * Design principles:
 * - Warm, not corporate. The companion feels like a person.
 * - Proactive: shows suggestions before the user asks.
 * - Contextual: knows where you are and what you're doing.
 * - Non-intrusive: can be collapsed to a pill.
 */

import { useState, useRef, useEffect } from 'react'
import { X, Send, MessageCircle, Sparkles } from 'lucide-react'
import { useCompanion } from '../../hooks/useCompanion'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { CompanionSuggestion } from '../../hooks/useCompanion'

interface Props {
  examProfileId: string | undefined
  currentPage?: string
  currentExerciseType?: 'syllogisme' | 'plan' | 'fiche' | 'commentaire' | 'cas-pratique' | 'synthese' | 'grand-oral' | null
  currentExerciseTask?: string
  mode?: 'embedded' | 'floating'
}

export function CompanionWidget({
  examProfileId,
  currentPage,
  currentExerciseType,
  currentExerciseTask,
  mode = 'embedded',
}: Props) {
  const [expanded, setExpanded] = useState(mode === 'embedded')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const companion = useCompanion({
    examProfileId,
    currentPage,
    currentExerciseType,
    currentExerciseTask,
  })

  const { messages, isLoading, streamingText, error, suggestions, sendMessage, cancel, clearConversation } = companion

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingText])

  // Focus input when expanded
  useEffect(() => {
    if (expanded) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [expanded])

  const handleSend = (text: string) => {
    if (!text.trim() || isLoading) return
    sendMessage(text)
  }

  // Collapsed pill (floating mode only)
  if (mode === 'floating' && !expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="fixed bottom-20 right-4 z-30 flex items-center gap-2 pl-3 pr-4 py-2.5 rounded-full bg-[var(--accent-text)] text-white shadow-lg hover:scale-105 active:scale-95 transition-transform"
      >
        <MessageCircle className="w-4 h-4" />
        <span className="text-sm font-medium">Le Prof</span>
        {suggestions.length > 0 && (
          <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
        )}
      </button>
    )
  }

  const hasMessages = messages.length > 0 || streamingText

  return (
    <div className={`flex flex-col bg-[var(--bg-card)] border border-[var(--border-card)] rounded-2xl overflow-hidden shadow-sm ${
      mode === 'floating'
        ? 'fixed bottom-20 right-4 z-30 w-[380px] max-w-[calc(100vw-2rem)] max-h-[600px]'
        : 'h-full'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-card)] bg-[var(--accent-bg)]/30">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-[var(--accent-text)]/10 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-[var(--accent-text)]" />
          </div>
          <div>
            <div className="text-sm font-semibold text-[var(--text-heading)]">Le Prof</div>
            <div className="text-[10px] text-[var(--text-muted)]">
              {isLoading ? 'Réfléchit...' : 'Ton répétiteur CRFPA'}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {hasMessages && (
            <button
              onClick={clearConversation}
              className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text-body)] px-2 py-1 rounded transition-colors"
              title="Nouvelle conversation"
            >
              Effacer
            </button>
          )}
          {mode === 'floating' && (
            <button
              onClick={() => setExpanded(false)}
              className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-muted)] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
        {!hasMessages ? (
          <EmptyState suggestions={suggestions} onSuggestion={handleSend} />
        ) : (
          <>
            {messages.map((msg) => {
              if (msg.role === 'user') {
                const text = typeof msg.content === 'string'
                  ? msg.content
                  : ''
                return (
                  <div key={msg.id} className="flex justify-end">
                    <div className="bg-[var(--accent-text)] text-white px-3.5 py-2.5 rounded-2xl rounded-br-md max-w-[85%] text-sm">
                      {text}
                    </div>
                  </div>
                )
              }
              const text = typeof msg.content === 'string'
                ? msg.content
                : ''
              return (
                <div key={msg.id} className="flex justify-start gap-2">
                  <div className="w-6 h-6 rounded-full bg-[var(--accent-bg)] flex items-center justify-center shrink-0 mt-0.5">
                    <Sparkles className="w-3 h-3 text-[var(--accent-text)]" />
                  </div>
                  <div className="bg-[var(--bg-input)] px-3.5 py-2.5 rounded-2xl rounded-bl-md max-w-[85%] text-sm text-[var(--text-body)] leading-relaxed">
                    <MarkdownContent>{text}</MarkdownContent>
                  </div>
                </div>
              )
            })}
            {streamingText && (
              <div className="flex justify-start gap-2">
                <div className="w-6 h-6 rounded-full bg-[var(--accent-bg)] flex items-center justify-center shrink-0 mt-0.5">
                  <Sparkles className="w-3 h-3 text-[var(--accent-text)]" />
                </div>
                <div className="bg-[var(--bg-input)] px-3.5 py-2.5 rounded-2xl rounded-bl-md max-w-[85%] text-sm text-[var(--text-body)] leading-relaxed">
                  <MarkdownContent>{streamingText}</MarkdownContent>
                  <span className="inline-block w-1.5 h-4 bg-[var(--text-muted)] ml-0.5 animate-pulse rounded-sm align-text-bottom" />
                </div>
              </div>
            )}
            {error && (
              <div className="flex justify-center">
                <div className="bg-[var(--color-error-bg)] border border-[var(--color-error-border)] text-[var(--color-error)] px-3 py-2 rounded-xl text-xs max-w-[90%]">
                  {error}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Suggestions */}
      {suggestions.length > 0 && !isLoading && (
        <div className="px-4 pb-2 flex gap-2 overflow-x-auto scrollbar-hide">
          {suggestions.map((s) => (
            <button
              key={s.id}
              onClick={() => s.prompt ? handleSend(s.prompt) : inputRef.current?.focus()}
              className="shrink-0 text-xs px-3 py-1.5 rounded-full border border-[var(--border-card)] bg-[var(--bg-input)] text-[var(--text-body)] hover:border-[var(--accent-text)] hover:text-[var(--accent-text)] transition-colors"
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="px-4 pb-3 pt-2 border-t border-[var(--border-card)]">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            const text = inputRef.current?.value ?? ''
            if (text.trim()) {
              handleSend(text)
              if (inputRef.current) inputRef.current.value = ''
            }
          }}
          className="flex items-end gap-2"
        >
          <input
            ref={inputRef}
            type="text"
            placeholder="Demande au Prof..."
            disabled={isLoading}
            className="flex-1 bg-[var(--bg-input)] border border-[var(--border-card)] rounded-xl px-3.5 py-2.5 text-sm text-[var(--text-body)] placeholder:text-[var(--text-faint)] focus:outline-none focus:border-[var(--accent-text)] disabled:opacity-50"
          />
          {isLoading ? (
            <button
              type="button"
              onClick={cancel}
              className="p-2.5 rounded-xl bg-[var(--color-error-bg)] text-[var(--color-error)] hover:opacity-90 transition-opacity shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="submit"
              className="p-2.5 rounded-xl bg-[var(--accent-text)] text-white hover:opacity-90 transition-opacity shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          )}
        </form>
      </div>
    </div>
  )
}

// ─── Subcomponents ─────────────────────────────────────────────────

function EmptyState({ suggestions, onSuggestion }: { suggestions: CompanionSuggestion[]; onSuggestion: (text: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="w-10 h-10 rounded-full bg-[var(--accent-bg)] flex items-center justify-center mb-3">
        <Sparkles className="w-5 h-5 text-[var(--accent-text)]" />
      </div>
      <p className="text-sm font-medium text-[var(--text-heading)] mb-1">Le Prof est là</p>
      <p className="text-xs text-[var(--text-muted)] mb-4 max-w-[200px]">
        Je connais ton parcours, tes forces et tes points à travailler. Que veux-tu aborder ?
      </p>
      <div className="flex flex-col gap-2 w-full max-w-[240px]">
        {suggestions.map((s) => (
          <button
            key={s.id}
            onClick={() => s.prompt ? onSuggestion(s.prompt) : undefined}
            className="text-left text-xs px-3 py-2 rounded-lg border border-[var(--border-card)] bg-[var(--bg-input)] text-[var(--text-body)] hover:border-[var(--accent-text)] hover:text-[var(--accent-text)] transition-colors"
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function MarkdownContent({ children }: { children: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => <p className="mb-1.5 last:mb-0">{children}</p>,
        ul: ({ children }) => <ul className="list-disc pl-4 mb-1.5 space-y-0.5">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal pl-4 mb-1.5 space-y-0.5">{children}</ol>,
        li: ({ children }) => <li>{children}</li>,
        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
        h1: ({ children }) => <p className="font-bold text-sm mb-1">{children}</p>,
        h2: ({ children }) => <p className="font-bold text-xs mb-1">{children}</p>,
        h3: ({ children }) => <p className="font-semibold text-xs mb-1">{children}</p>,
        hr: () => <hr className="my-2 border-[var(--border-card)]" />,
        a: ({ href, children }) => <a href={href} className="text-[var(--accent-text)] underline" target="_blank" rel="noopener noreferrer">{children}</a>,
        code: ({ children }) => <code className="bg-[var(--bg-card)] px-1 py-0.5 rounded text-[10px]">{children}</code>,
      }}
    >
      {children}
    </ReactMarkdown>
  )
}
