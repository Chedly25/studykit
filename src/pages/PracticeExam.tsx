import { useState, useRef, useEffect } from 'react'
import { Brain, Play, BarChart3 } from 'lucide-react'
import { useExamProfile } from '../hooks/useExamProfile'
import { useKnowledgeGraph } from '../hooks/useKnowledgeGraph'
import { useAgent } from '../hooks/useAgent'
import { ChatMessageBubble } from '../components/chat/ChatMessage'
import { ChatInput } from '../components/chat/ChatInput'
import { ToolCallIndicator } from '../components/chat/ToolCallIndicator'

export default function PracticeExam() {
  const { activeProfile } = useExamProfile()
  const profileId = activeProfile?.id
  const { subjects, topics, dailyLogs, weakTopics } = useKnowledgeGraph(profileId)

  const {
    messages, isLoading, currentToolCall, streamingText, error,
    sendMessage,
  } = useAgent({ profile: activeProfile, subjects, topics, dailyLogs })

  const [started, setStarted] = useState(false)
  const [questionCount, setQuestionCount] = useState(10)
  const [focusSubject, setFocusSubject] = useState<string>('')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, streamingText])

  if (!activeProfile) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <h1 className="text-2xl font-bold text-[var(--text-heading)] mb-4">Practice Exam</h1>
        <p className="text-[var(--text-muted)]">Create an exam profile first.</p>
        <a href="/exam-profile" className="btn-primary px-6 py-2.5 mt-4 inline-block">Create Profile</a>
      </div>
    )
  }

  const handleStart = () => {
    setStarted(true)
    const subjectNote = focusSubject ? ` focusing on ${focusSubject}` : ' covering my weakest topics'
    sendMessage(
      `Generate a practice exam with ${questionCount} questions${subjectNote} in the format of my ${activeProfile.examType} exam. Present one question at a time. After I answer each one, tell me if I'm right, explain why, and log the result. Then show the next question. At the end, give me a summary of my performance.`
    )
  }

  // Setup screen
  if (!started) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 animate-fade-in">
        <div className="text-center mb-8">
          <BarChart3 className="w-12 h-12 text-[var(--accent-text)] mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-[var(--text-heading)] mb-2">Practice Exam</h1>
          <p className="text-[var(--text-muted)]">
            AI-generated questions in your exam's format, targeting your weak areas.
          </p>
        </div>

        <div className="glass-card p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--text-body)] mb-1">Number of Questions</label>
            <input
              type="range"
              min={5}
              max={50}
              step={5}
              value={questionCount}
              onChange={e => setQuestionCount(Number(e.target.value))}
              className="w-full accent-[var(--accent-text)]"
            />
            <div className="text-center text-lg font-semibold text-[var(--accent-text)]">{questionCount}</div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-body)] mb-1">Focus Area (optional)</label>
            <select
              value={focusSubject}
              onChange={e => setFocusSubject(e.target.value)}
              className="select-field w-full"
            >
              <option value="">Auto (weakest topics)</option>
              {subjects.map(s => (
                <option key={s.id} value={s.name}>{s.name} — {Math.round(s.mastery * 100)}%</option>
              ))}
            </select>
          </div>

          {weakTopics.length > 0 && (
            <div className="text-xs text-[var(--text-muted)]">
              Weak areas: {weakTopics.slice(0, 3).map(t => t.name).join(', ')}
            </div>
          )}

          <button onClick={handleStart} className="btn-primary px-6 py-2.5 w-full flex items-center justify-center gap-2">
            <Play className="w-4 h-4" /> Start Practice Exam
          </button>
        </div>
      </div>
    )
  }

  // Active exam
  return (
    <div className="max-w-3xl mx-auto px-4 py-4 animate-fade-in flex flex-col" style={{ height: 'calc(100vh - 8rem)' }}>
      <div className="glass-card flex-1 flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--border-card)] flex items-center gap-2">
          <Brain className="w-4 h-4 text-[var(--accent-text)]" />
          <span className="text-sm font-medium text-[var(--text-heading)]">Practice Exam</span>
          <span className="text-xs text-[var(--text-muted)]">&middot; {questionCount} questions</span>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
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

        <ChatInput onSend={sendMessage} disabled={isLoading} placeholder="Type your answer..." />
      </div>
    </div>
  )
}
