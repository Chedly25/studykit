import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Lightbulb, BookOpen } from 'lucide-react'
import { useExamProfile } from '../hooks/useExamProfile'
import { useKnowledgeGraph } from '../hooks/useKnowledgeGraph'
import { useAgent } from '../hooks/useAgent'
import { ChatMessageBubble } from '../components/chat/ChatMessage'
import { ChatInput } from '../components/chat/ChatInput'
import { ToolCallIndicator } from '../components/chat/ToolCallIndicator'
import { QuotaIndicator } from '../components/subscription/QuotaIndicator'
import { UpgradePrompt } from '../components/subscription/UpgradePrompt'

export default function ExplainBack() {
  const { t } = useTranslation()
  const { activeProfile } = useExamProfile()
  const profileId = activeProfile?.id
  const { subjects, topics, dailyLogs, weakTopics, getTopicsForSubject } = useKnowledgeGraph(profileId)

  const {
    messages, isLoading, currentToolCall, streamingText, error,
    isExplainBack, quotaExceeded, messagesUsedToday,
    sendMessage, startExplainBackMode,
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
        <h1 className="text-2xl font-bold text-[var(--text-heading)] mb-4">{t('ai.explainBack')}</h1>
        <p className="text-[var(--text-muted)]">{t('ai.createProfileFirst')}</p>
        <a href="/exam-profile" className="btn-primary px-6 py-2.5 mt-4 inline-block">Create Profile</a>
      </div>
    )
  }

  // Topic selection view
  if (!isExplainBack) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8 animate-fade-in">
        <div className="text-center mb-8">
          <Lightbulb className="w-12 h-12 text-[var(--accent-text)] mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-[var(--text-heading)] mb-2">{t('ai.explainBack')}</h1>
          <p className="text-[var(--text-muted)]">
            {t('ai.explainBackSubtitle')}
          </p>
        </div>

        {/* Quick start with weak topics */}
        {weakTopics.length > 0 && (
          <div className="glass-card p-4 mb-6">
            <h2 className="font-semibold text-[var(--text-heading)] mb-3 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-[var(--accent-text)]" /> {t('ai.weakAreas')}
            </h2>
            <div className="flex flex-wrap gap-2">
              {weakTopics.slice(0, 5).map(t => (
                <button
                  key={t.id}
                  onClick={() => startExplainBackMode!(t.name)}
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
          <h2 className="font-semibold text-[var(--text-heading)] mb-3">{t('ai.selectTopic')}</h2>
          <select
            value={selectedTopic}
            onChange={e => setSelectedTopic(e.target.value)}
            className="select-field w-full mb-3"
          >
            <option value="">{t('ai.chooseTopic')}</option>
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
            onClick={() => selectedTopic && startExplainBackMode!(selectedTopic)}
            disabled={!selectedTopic}
            className="btn-primary px-6 py-2 w-full disabled:opacity-40"
          >
            {t('ai.startSession')}
          </button>
        </div>
      </div>
    )
  }

  // Explain-back session active
  return (
    <div className="max-w-3xl mx-auto px-4 py-4 animate-fade-in flex flex-col" style={{ height: 'calc(100vh - 8rem)' }}>
      <div className="glass-card flex-1 flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--border-card)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-[var(--accent-text)]" />
            <span className="text-sm font-medium text-[var(--text-heading)]">{t('ai.explainBack')}</span>
            <span className="text-xs text-[var(--text-muted)]">&middot; Teach to learn</span>
          </div>
          <QuotaIndicator messagesUsedToday={messagesUsedToday} />
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && !isLoading && (
            <div className="text-center py-6 text-sm text-[var(--text-muted)]">
              {t('ai.explainInstructions')}
            </div>
          )}

          {messages.map((msg, i) => (
            <ChatMessageBubble key={i} message={msg} />
          ))}

          {streamingText && (
            <ChatMessageBubble message={{ role: 'assistant', content: streamingText }} />
          )}

          <ToolCallIndicator toolName={currentToolCall} />

          {quotaExceeded ? (
            <UpgradePrompt messagesUsed={messagesUsedToday} />
          ) : error ? (
            <div className="text-sm text-red-500 bg-red-500/10 rounded-lg p-3">{error}</div>
          ) : null}
        </div>

        <ChatInput
          onSend={sendMessage}
          disabled={isLoading || quotaExceeded}
          placeholder={t('ai.typeAnswer')}
        />
      </div>
    </div>
  )
}
