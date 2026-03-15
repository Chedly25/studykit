import { useState, useRef, useEffect } from 'react'
import { Brain, BookOpen } from 'lucide-react'
import { useExamProfile } from '../hooks/useExamProfile'
import { useKnowledgeGraph } from '../hooks/useKnowledgeGraph'
import { useAgent } from '../hooks/useAgent'
import { ChatMessageBubble } from '../components/chat/ChatMessage'
import { ChatInput } from '../components/chat/ChatInput'
import { ToolCallIndicator } from '../components/chat/ToolCallIndicator'

export default function SocraticMode() {
  const { activeProfile } = useExamProfile()
  const profileId = activeProfile?.id
  const { subjects, topics, dailyLogs, weakTopics, getTopicsForSubject } = useKnowledgeGraph(profileId)

  const {
    messages, isLoading, currentToolCall, streamingText, error,
    isSocratic, sendMessage, startSocraticMode,
  } = useAgent({ profile: activeProfile, subjects, topics, dailyLogs })

  const [selectedTopic, setSelectedTopic] = useState<string>('')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, streamingText])

  if (!activeProfile) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <h1 className="text-2xl font-bold text-[var(--text-heading)] mb-4">Socratic Mode</h1>
        <p className="text-[var(--text-muted)]">Create an exam profile first.</p>
        <a href="/exam-profile" className="btn-primary px-6 py-2.5 mt-4 inline-block">Create Profile</a>
      </div>
    )
  }

  // Topic selection view
  if (!isSocratic) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8 animate-fade-in">
        <div className="text-center mb-8">
          <Brain className="w-12 h-12 text-[var(--accent-text)] mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-[var(--text-heading)] mb-2">Socratic Mode</h1>
          <p className="text-[var(--text-muted)]">
            The AI will teach you through questions, not answers. Choose a topic to begin.
          </p>
        </div>

        {/* Quick start with weak topics */}
        {weakTopics.length > 0 && (
          <div className="glass-card p-4 mb-6">
            <h2 className="font-semibold text-[var(--text-heading)] mb-3 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-[var(--accent-text)]" /> Recommended (Your Weakest)
            </h2>
            <div className="flex flex-wrap gap-2">
              {weakTopics.slice(0, 5).map(t => (
                <button
                  key={t.id}
                  onClick={() => startSocraticMode(t.name)}
                  className="px-3 py-1.5 rounded-full text-sm bg-[var(--accent-bg)] text-[var(--accent-text)] hover:opacity-80 transition-opacity"
                >
                  {t.name} ({Math.round(t.mastery * 100)}%)
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Full topic list */}
        <div className="glass-card p-4">
          <h2 className="font-semibold text-[var(--text-heading)] mb-3">All Topics</h2>
          <select
            value={selectedTopic}
            onChange={e => setSelectedTopic(e.target.value)}
            className="select-field w-full mb-3"
          >
            <option value="">Choose a topic...</option>
            {subjects.map(s => (
              <optgroup key={s.id} label={s.name}>
                {getTopicsForSubject(s.id).map(t => (
                  <option key={t.id} value={t.name}>
                    {t.name} — {Math.round(t.mastery * 100)}% mastery
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <button
            onClick={() => selectedTopic && startSocraticMode(selectedTopic)}
            disabled={!selectedTopic}
            className="btn-primary px-6 py-2 w-full disabled:opacity-40"
          >
            Start Socratic Session
          </button>
        </div>
      </div>
    )
  }

  // Socratic session active
  return (
    <div className="max-w-3xl mx-auto px-4 py-4 animate-fade-in flex flex-col" style={{ height: 'calc(100vh - 8rem)' }}>
      <div className="glass-card flex-1 flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--border-card)] flex items-center gap-2">
          <Brain className="w-4 h-4 text-[var(--accent-text)]" />
          <span className="text-sm font-medium text-[var(--text-heading)]">Socratic Mode</span>
          <span className="text-xs text-[var(--text-muted)]">&middot; Learning through questions</span>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && !isLoading && (
            <div className="text-center py-6 text-sm text-[var(--text-muted)]">
              Starting Socratic session... The AI will begin asking you questions.
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

        <ChatInput
          onSend={sendMessage}
          disabled={isLoading}
          placeholder="Type your answer..."
        />
      </div>
    </div>
  )
}
