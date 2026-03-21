/**
 * Embedded chat pane for the document reader.
 * Uses useAgent with sourcesEnabled for full document context.
 * Persists conversation per document via localStorage.
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { X, Sparkles, Loader2 } from 'lucide-react'
import { useExamProfile } from '../../hooks/useExamProfile'
import { useKnowledgeGraph } from '../../hooks/useKnowledgeGraph'
import { useAgent } from '../../hooks/useAgent'
import { ChatMessageBubble } from '../chat/ChatMessage'
import { ChatInput, type ContextPill } from '../chat/ChatInput'
import { ToolCallIndicator } from '../chat/ToolCallIndicator'
import { ChatContextProvider } from '../chat/ChatContext'
import { UpgradePrompt } from '../subscription/UpgradePrompt'

interface Props {
  documentId: string
  documentTitle: string
  selectionContext?: { text: string; pageNumber: number; documentTitle: string } | null
  onSelectionContextConsumed: () => void
  onClose: () => void
}

const CONV_KEY = (docId: string) => `reader_conv_${docId}`

export function ReaderChatPane({ documentId, documentTitle, selectionContext, onSelectionContextConsumed, onClose }: Props) {
  const { activeProfile } = useExamProfile()
  const profileId = activeProfile?.id
  const { subjects, topics, dailyLogs } = useKnowledgeGraph(profileId)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [contextPills, setContextPills] = useState<ContextPill[]>([])
  const restoredRef = useRef(false)

  const agent = useAgent({
    profile: activeProfile,
    subjects,
    topics,
    dailyLogs,
    sourcesEnabled: true,
  })

  const { messages, isLoading, currentToolCall, streamingText, error, quotaExceeded, conversationId, sendMessage, cancel, loadConversation } = agent

  // Cancel in-flight requests on unmount
  useEffect(() => {
    return () => { cancel() }
  }, [cancel])

  // Restore conversation for this document on mount
  useEffect(() => {
    if (restoredRef.current) return
    restoredRef.current = true
    const savedConvId = localStorage.getItem(CONV_KEY(documentId))
    if (savedConvId) {
      loadConversation(savedConvId).catch(() => {
        // Conversation may have been deleted — clear stale reference
        localStorage.removeItem(CONV_KEY(documentId))
      })
    }
  }, [documentId, loadConversation])

  // Persist conversation ID when it changes
  useEffect(() => {
    if (conversationId) {
      localStorage.setItem(CONV_KEY(documentId), conversationId)
    }
  }, [conversationId, documentId])

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, streamingText])

  // Convert selection context to a context pill
  useEffect(() => {
    if (selectionContext) {
      const truncTitle = selectionContext.documentTitle.length > 20
        ? selectionContext.documentTitle.slice(0, 17) + '...'
        : selectionContext.documentTitle
      const pill: ContextPill = {
        id: crypto.randomUUID(),
        label: `${truncTitle} · p.${selectionContext.pageNumber}`,
        content: `From page ${selectionContext.pageNumber} of "${selectionContext.documentTitle}":\n\n"${selectionContext.text}"`,
      }
      setContextPills([pill])
      onSelectionContextConsumed()
    }
  }, [selectionContext, onSelectionContextConsumed])

  const handleSend = useCallback(async (message: string) => {
    let fullMessage = message
    if (contextPills.length > 0) {
      // Prepend context with markers so ChatMessageBubble renders it as a pill
      // Format: <<CTX:label>>content<</CTX>>
      const contextBlock = contextPills.map(p =>
        `<<CTX:${p.label}>>${p.content}<</CTX>>`
      ).join('\n')
      fullMessage = `${contextBlock}\n${message}`
      setContextPills([])
    }
    await sendMessage(fullMessage)
  }, [sendMessage, contextPills])

  const handleRemoveContextPill = useCallback((id: string) => {
    setContextPills(prev => prev.filter(p => p.id !== id))
  }, [])

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
          contextPills={contextPills}
          onRemoveContextPill={handleRemoveContextPill}
        />
      </div>
    </div>
  )
}
