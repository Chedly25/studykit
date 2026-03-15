import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Brain, Settings } from 'lucide-react'
import { useExamProfile } from '../hooks/useExamProfile'
import { useKnowledgeGraph } from '../hooks/useKnowledgeGraph'
import { useAgent } from '../hooks/useAgent'
import { useTutorPreferences } from '../hooks/useTutorPreferences'
import { useSessionInsights } from '../hooks/useSessionInsights'
import { ChatMessageBubble } from '../components/chat/ChatMessage'
import { ChatInput } from '../components/chat/ChatInput'
import { ToolCallIndicator } from '../components/chat/ToolCallIndicator'
import { ChatHistory } from '../components/chat/ChatHistory'
import { TutorSettingsModal } from '../components/chat/TutorSettingsModal'
import { QuotaIndicator } from '../components/subscription/QuotaIndicator'
import { UpgradePrompt } from '../components/subscription/UpgradePrompt'
import { SourcesToggle } from '../components/sources/SourcesToggle'
import { useSources } from '../hooks/useSources'

export default function Chat() {
  const { t } = useTranslation()
  const { activeProfile } = useExamProfile()
  const profileId = activeProfile?.id
  const { subjects, topics, dailyLogs } = useKnowledgeGraph(profileId)

  const [sourcesEnabled, setSourcesEnabled] = useState(false)
  const { documentCount } = useSources(profileId)
  const { preferences, updatePreferences, resetToDefaults } = useTutorPreferences(profileId)
  const { recentInsights } = useSessionInsights(profileId)
  const [showSettings, setShowSettings] = useState(false)

  const {
    messages, isLoading, currentToolCall, streamingText, error,
    conversationId, quotaExceeded, messagesUsedToday,
    sendMessage, loadConversation, newConversation,
  } = useAgent({ profile: activeProfile, subjects, topics, dailyLogs, sourcesEnabled, tutorPreferences: preferences, sessionInsights: recentInsights })

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
        <h1 className="text-2xl font-bold text-[var(--text-heading)] mb-4">{t('ai.chat')}</h1>
        <p className="text-[var(--text-muted)] mb-6">{t('ai.createProfileFirst')}</p>
        <a href="/exam-profile" className="btn-primary px-6 py-2.5 inline-block">{t('profile.create')}</a>
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
          <div className="px-4 py-2 border-b border-[var(--border-card)] flex items-center justify-between">
            <span className="text-sm font-medium text-[var(--text-heading)]">{t('ai.chat')}</span>
            <div className="flex items-center gap-2">
              <SourcesToggle enabled={sourcesEnabled} onToggle={setSourcesEnabled} documentCount={documentCount} />
              <button
                onClick={() => setShowSettings(true)}
                className="p-1.5 rounded-lg hover:bg-[var(--bg-input)] text-[var(--text-muted)] transition-colors"
                title={t('ai.tutorSettings')}
              >
                <Settings className="w-4 h-4" />
              </button>
              <QuotaIndicator messagesUsedToday={messagesUsedToday} />
            </div>
          </div>
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="text-center py-12">
                <Brain className="w-10 h-10 text-[var(--accent-text)] mx-auto mb-3" />
                <h2 className="text-lg font-semibold text-[var(--text-heading)] mb-2">{t('ai.chat')}</h2>
                <p className="text-sm text-[var(--text-muted)] max-w-md mx-auto">
                  {t('ai.chatSubtitle')}
                </p>
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

          <ChatInput onSend={sendMessage} disabled={isLoading || quotaExceeded} placeholder={t('ai.typeMessage')} />
        </div>
      </div>

      {preferences && (
        <TutorSettingsModal
          open={showSettings}
          onClose={() => setShowSettings(false)}
          preferences={preferences}
          onUpdate={updatePreferences}
          onReset={resetToDefaults}
        />
      )}
    </div>
  )
}
