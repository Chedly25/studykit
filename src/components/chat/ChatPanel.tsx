import { useRef, useEffect } from 'react'
import { X, Brain } from 'lucide-react'
import { useExamProfile } from '../../hooks/useExamProfile'
import { useKnowledgeGraph } from '../../hooks/useKnowledgeGraph'
import { useAgent } from '../../hooks/useAgent'
import { ChatMessageBubble } from './ChatMessage'
import { ChatInput } from './ChatInput'
import { ToolCallIndicator } from './ToolCallIndicator'
import { ChatHistory } from './ChatHistory'

interface Props {
  open: boolean
  onClose: () => void
}

export function ChatPanel({ open, onClose }: Props) {
  const { activeProfile } = useExamProfile()
  const profileId = activeProfile?.id
  const { subjects, topics, dailyLogs } = useKnowledgeGraph(profileId)

  const {
    messages, isLoading, currentToolCall, streamingText, error,
    conversationId, isSocratic,
    sendMessage, loadConversation, newConversation,
  } = useAgent({ profile: activeProfile, subjects, topics, dailyLogs })

  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, streamingText])

  if (!open) return null

  return (
    <div className="fixed right-0 top-0 bottom-0 w-full sm:w-[400px] bg-[var(--bg-card)] border-l border-[var(--border-card)] z-50 flex flex-col shadow-2xl animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-card)]">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-[var(--accent-text)]" />
          <span className="font-semibold text-[var(--text-heading)] text-sm">
            {isSocratic ? 'Socratic Mode' : 'StudiesKit AI'}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-[var(--bg-input)] text-[var(--text-muted)] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Chat History */}
      {profileId && (
        <ChatHistory
          examProfileId={profileId}
          activeConversationId={conversationId}
          onSelect={loadConversation}
          onNew={newConversation}
        />
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {!activeProfile && (
          <div className="text-center text-sm text-[var(--text-muted)] py-8">
            Create an exam profile to start chatting with StudiesKit AI.
          </div>
        )}

        {messages.map((msg, i) => (
          <ChatMessageBubble key={i} message={msg} />
        ))}

        {streamingText && (
          <ChatMessageBubble message={{ role: 'assistant', content: streamingText }} />
        )}

        <ToolCallIndicator toolName={currentToolCall} />

        {error && (
          <div className="text-sm text-red-500 bg-red-500/10 rounded-lg p-3">{error}</div>
        )}
      </div>

      {/* Input */}
      <ChatInput onSend={sendMessage} disabled={isLoading || !activeProfile} />
    </div>
  )
}
