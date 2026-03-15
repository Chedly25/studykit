import { useRef, useEffect } from 'react'
import { Brain } from 'lucide-react'
import { useExamProfile } from '../hooks/useExamProfile'
import { useKnowledgeGraph } from '../hooks/useKnowledgeGraph'
import { useAgent } from '../hooks/useAgent'
import { ChatMessageBubble } from '../components/chat/ChatMessage'
import { ChatInput } from '../components/chat/ChatInput'
import { ToolCallIndicator } from '../components/chat/ToolCallIndicator'
import { ChatHistory } from '../components/chat/ChatHistory'

export default function Chat() {
  const { activeProfile } = useExamProfile()
  const profileId = activeProfile?.id
  const { subjects, topics, dailyLogs } = useKnowledgeGraph(profileId)

  const {
    messages, isLoading, currentToolCall, streamingText, error,
    conversationId,
    sendMessage, loadConversation, newConversation,
  } = useAgent({ profile: activeProfile, subjects, topics, dailyLogs })

  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, streamingText])

  if (!activeProfile) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <Brain className="w-12 h-12 text-[var(--accent-text)] mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-[var(--text-heading)] mb-4">StudiesKit AI</h1>
        <p className="text-[var(--text-muted)] mb-6">Create an exam profile to start chatting with your AI tutor.</p>
        <a href="/exam-profile" className="btn-primary px-6 py-2.5 inline-block">Create Profile</a>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-4 animate-fade-in flex flex-col" style={{ height: 'calc(100vh - 8rem)' }}>
      <div className="flex gap-4 flex-1 min-h-0">
        {/* Sidebar */}
        <div className="w-56 flex-shrink-0 glass-card overflow-hidden hidden md:block">
          <ChatHistory
            examProfileId={profileId!}
            activeConversationId={conversationId}
            onSelect={loadConversation}
            onNew={newConversation}
          />
        </div>

        {/* Chat area */}
        <div className="flex-1 flex flex-col glass-card overflow-hidden">
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="text-center py-12">
                <Brain className="w-10 h-10 text-[var(--accent-text)] mx-auto mb-3" />
                <h2 className="text-lg font-semibold text-[var(--text-heading)] mb-2">StudiesKit AI</h2>
                <p className="text-sm text-[var(--text-muted)] max-w-md mx-auto">
                  I know your exam profile and knowledge graph. Ask me about your weak topics, request practice questions, or get a study plan.
                </p>
                <div className="flex flex-wrap justify-center gap-2 mt-4">
                  {['What should I study today?', 'Quiz me on my weakest topic', 'Create flashcards for my weakest area'].map(q => (
                    <button
                      key={q}
                      onClick={() => sendMessage(q)}
                      className="text-xs px-3 py-1.5 rounded-full bg-[var(--accent-bg)] text-[var(--accent-text)] hover:opacity-80 transition-opacity"
                    >
                      {q}
                    </button>
                  ))}
                </div>
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

          <ChatInput onSend={sendMessage} disabled={isLoading} />
        </div>
      </div>
    </div>
  )
}
