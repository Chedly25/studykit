/**
 * Embedded chat pane for the document reader.
 * Uses useAgent with sourcesEnabled for full document context.
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { X, Sparkles, Loader2 } from 'lucide-react'
import { useExamProfile } from '../../hooks/useExamProfile'
import { useKnowledgeGraph } from '../../hooks/useKnowledgeGraph'
import { useAgent } from '../../hooks/useAgent'
import { ChatMessageBubble } from '../chat/ChatMessage'
import { ChatInput } from '../chat/ChatInput'
import { ToolCallIndicator } from '../chat/ToolCallIndicator'
import { ChatContextProvider } from '../chat/ChatContext'
import { UpgradePrompt } from '../subscription/UpgradePrompt'

interface Props {
  documentId: string
  documentTitle: string
  prefill?: string
  onPrefillConsumed: () => void
  onClose: () => void
}

export function ReaderChatPane({ documentId, documentTitle, prefill, onPrefillConsumed, onClose }: Props) {
  const { activeProfile } = useExamProfile()
  const profileId = activeProfile?.id
  const { subjects, topics, dailyLogs } = useKnowledgeGraph(profileId)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [inputPrefill, setInputPrefill] = useState<string | undefined>()

  const {
    messages, isLoading, currentToolCall, streamingText, error,
    quotaExceeded, sendMessage, cancel,
  } = useAgent({
    profile: activeProfile,
    subjects,
    topics,
    dailyLogs,
    sourcesEnabled: true,
  })

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, streamingText])

  // Handle prefill from parent
  useEffect(() => {
    if (prefill) {
      setInputPrefill(prefill)
      onPrefillConsumed()
    }
  }, [prefill, onPrefillConsumed])

  const handleSend = useCallback(async (message: string) => {
    const contextMessage = `[Reading: "${documentTitle}"]\n\n${message}`
    await sendMessage(contextMessage)
  }, [sendMessage, documentTitle])

  return (
    <div className="flex flex-col h-full border-l border-[var(--border-card)] bg-[var(--bg-card)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-card)]">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[var(--accent-text)]" />
          <span className="text-sm font-medium text-[var(--text-heading)]">AI Assistant</span>
        </div>
        <button onClick={onClose} className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-body)] hover:bg-[var(--bg-input)] transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <ChatContextProvider>
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {messages.length === 0 && !isLoading && (
            <div className="text-center py-8">
              <Sparkles className="w-8 h-8 text-[var(--accent-text)] mx-auto mb-3 opacity-30" />
              <p className="text-sm text-[var(--text-muted)]">Select text in the PDF and click "Ask AI" to get help.</p>
              <p className="text-xs text-[var(--text-faint)] mt-1">Or type a question about this document.</p>
            </div>
          )}

          {messages.map((msg, i) => (
            <ChatMessageBubble key={msg.id || i} message={msg} />
          ))}

          {streamingText && (
            <ChatMessageBubble
              message={{ role: 'assistant', content: streamingText }}
              isStreaming
            />
          )}

          {currentToolCall && <ToolCallIndicator toolName={currentToolCall} />}

          {error && (
            <div className="text-sm text-red-500 bg-red-500/10 rounded-lg p-3">
              {error}
            </div>
          )}

          {quotaExceeded && <UpgradePrompt />}
        </div>
      </ChatContextProvider>

      {/* Input */}
      <div className="p-3 border-t border-[var(--border-card)]">
        <ChatInput
          onSend={handleSend}
          disabled={isLoading || !activeProfile || quotaExceeded}
          placeholder="Ask about this document..."
          initialValue={inputPrefill}
          onInitialValueConsumed={() => setInputPrefill(undefined)}
        />
      </div>
    </div>
  )
}
