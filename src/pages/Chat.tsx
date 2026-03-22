import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@clerk/clerk-react'
import { Brain, Settings, PanelLeftClose, PanelLeft, Upload, Lightbulb, GraduationCap } from 'lucide-react'
import { useExamProfile } from '../hooks/useExamProfile'
import { useKnowledgeGraph } from '../hooks/useKnowledgeGraph'
import { useAgent } from '../hooks/useAgent'
import { useTutorPreferences } from '../hooks/useTutorPreferences'
import { useSessionInsights } from '../hooks/useSessionInsights'
import { useStudentModel } from '../hooks/useStudentModel'
import { useAttachments } from '../hooks/useAttachments'
import { ChatMessageBubble } from '../components/chat/ChatMessage'
import { ChatInput } from '../components/chat/ChatInput'
import { ToolCallIndicator } from '../components/chat/ToolCallIndicator'
import { ChatHistory } from '../components/chat/ChatHistory'
import { ChatEmptyState, suggestionIcons } from '../components/chat/ChatEmptyState'
import { TutorSettingsModal } from '../components/chat/TutorSettingsModal'
import { ChatContextProvider } from '../components/chat/ChatContext'
import { QuotaIndicator } from '../components/subscription/QuotaIndicator'
import { UpgradePrompt } from '../components/subscription/UpgradePrompt'
import { SourcesToggle } from '../components/sources/SourcesToggle'
import { AttachmentSavePrompt } from '../components/chat/AttachmentSavePrompt'
import { useSources } from '../hooks/useSources'
import type { ChatAttachment } from '../hooks/useAttachments'

const SIDEBAR_KEY = 'studykit_chat_sidebar'

export default function Chat() {
  const { t } = useTranslation()
  const { getToken } = useAuth()
  const { activeProfile } = useExamProfile()
  const profileId = activeProfile?.id
  const { subjects, topics, dailyLogs, weakTopics, strongTopics, dueTopics } = useKnowledgeGraph(profileId)

  const [sourcesEnabled, setSourcesEnabled] = useState(false)
  const { documents, documentCount } = useSources(profileId)
  const { preferences, updatePreferences, resetToDefaults } = useTutorPreferences(profileId)
  const { recentInsights } = useSessionInsights(profileId)
  const { studentModel, conversationSummaries } = useStudentModel(profileId)
  const [showSettings, setShowSettings] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    try { return localStorage.getItem(SIDEBAR_KEY) !== 'closed' } catch { return true }
  })
  const [isDragging, setIsDragging] = useState(false)

  const {
    attachments, addFiles, removeAttachment, clearAttachments, isParsing, getRelevantChunks,
  } = useAttachments()

  const {
    messages, isLoading, currentToolCall, streamingText, error,
    conversationId, quotaExceeded, messagesUsedToday,
    sendMessage, cancel, loadConversation, newConversation,
  } = useAgent({ profile: activeProfile, subjects, topics, dailyLogs, sourcesEnabled, tutorPreferences: preferences, sessionInsights: recentInsights, studentModel, conversationSummaries })

  const scrollRef = useRef<HTMLDivElement>(null)
  const [pendingSaveAttachments, setPendingSaveAttachments] = useState<ChatAttachment[] | null>(null)

  // Persist sidebar state
  useEffect(() => {
    try { localStorage.setItem(SIDEBAR_KEY, sidebarOpen ? 'open' : 'closed') } catch {}
  }, [sidebarOpen])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, streamingText])

  const handleSend = useCallback(async (message: string, sentAttachments?: ChatAttachment[]) => {
    // Convert legacy mode triggers to natural messages (router handles approach automatically)
    let actualMessage = message
    if (message.startsWith('__socratic__:')) {
      const topicName = message.slice('__socratic__:'.length)
      actualMessage = `Quiz me on ${topicName} — test my understanding with questions.`
    } else if (message.startsWith('__explainback__:')) {
      const topicName = message.slice('__explainback__:'.length)
      actualMessage = `Let me explain what I know about ${topicName}. Check if my understanding is correct.`
    }

    let attachmentContext: { chunks: Array<{ content: string; documentTitle: string; chunkIndex: number }> } | undefined

    if (sentAttachments && sentAttachments.length > 0) {
      const chunks = getRelevantChunks(message, 5)
      if (chunks.length > 0) {
        attachmentContext = { chunks }
      }
      setPendingSaveAttachments([...sentAttachments])
      clearAttachments()
    }

    await sendMessage(actualMessage, attachmentContext)
  }, [sendMessage, getRelevantChunks, clearAttachments])

  // Drag-and-drop handlers
  const dragCounter = useRef(0)
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    dragCounter.current++
    if (e.dataTransfer.types.includes('Files')) setIsDragging(true)
  }, [])
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    dragCounter.current--
    if (dragCounter.current === 0) setIsDragging(false)
  }, [])
  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault() }, [])
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    dragCounter.current = 0
    setIsDragging(false)
    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) addFiles(files)
  }, [addFiles])

  // Suggestion chips
  const suggestions = useMemo(() => {
    const chips: { icon: React.ReactNode; label: string; subtitle?: string; prompt: string }[] = []

    // Up to 2 weak topics
    for (const topic of weakTopics.slice(0, 2)) {
      chips.push({
        icon: suggestionIcons.helpWith,
        label: t('ai.suggestHelpWith', { topic: topic.name }),
        subtitle: t('ai.mastery', { percent: Math.round(topic.decayedMastery * 100) }),
        prompt: t('ai.suggestHelpWith', { topic: topic.name }),
      })
    }

    // 1 due-for-review topic
    if (dueTopics.length > 0) {
      chips.push({
        icon: suggestionIcons.review,
        label: t('ai.suggestReview', { topic: dueTopics[0].name }),
        subtitle: t('ai.dueForReview'),
        prompt: t('ai.suggestReview', { topic: dueTopics[0].name }),
      })
    }

    // 1 source-based
    if (documents && documents.length > 0) {
      chips.push({
        icon: suggestionIcons.explainSource,
        label: t('ai.suggestExplainSource', { source: documents[0].title }),
        prompt: t('ai.suggestExplainSource', { source: documents[0].title }),
      })
    }

    // Socratic mode for weak topics
    for (const topic of weakTopics.slice(0, 1)) {
      if (chips.length >= 8) break
      chips.push({
        icon: <Lightbulb className="w-4 h-4" />,
        label: `Socratic: ${topic.name}`,
        subtitle: 'Learn through guided questions',
        prompt: `__socratic__:${topic.name}`,
      })
    }

    // Explain-back mode for strong topics
    for (const topic of strongTopics.slice(0, 1)) {
      if (chips.length >= 8) break
      chips.push({
        icon: <GraduationCap className="w-4 h-4" />,
        label: `Explain Back: ${topic.name}`,
        subtitle: 'Test your understanding',
        prompt: `__explainback__:${topic.name}`,
      })
    }

    // Fill to 6 with general suggestions
    const general = [
      { icon: suggestionIcons.studyPlan, label: t('ai.suggestStudyPlan'), prompt: t('ai.suggestStudyPlan') },
      { icon: suggestionIcons.focusToday, label: t('ai.suggestFocusToday'), prompt: t('ai.suggestFocusToday') },
      { icon: suggestionIcons.quizWeak, label: t('ai.suggestQuizWeak'), prompt: t('ai.suggestQuizWeak') },
    ]
    for (const g of general) {
      if (chips.length >= 8) break
      chips.push(g)
    }

    return chips
  }, [weakTopics, strongTopics, dueTopics, documents, t])

  if (!activeProfile) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="text-center px-4">
          <Brain className="w-12 h-12 text-[var(--accent-text)] mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-[var(--text-heading)] mb-4">{t('ai.chat')}</h1>
          <p className="text-[var(--text-muted)] mb-6">{t('ai.createProfileFirst')}</p>
          <a href="/exam-profile" className="btn-primary px-6 py-2.5 inline-block">{t('profile.create')}</a>
        </div>
      </div>
    )
  }

  return (
    <div
      className="h-[calc(100vh-4rem)] flex"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Collapsible sidebar */}
      <div
        className={`chat-sidebar hidden md:flex flex-col bg-[var(--bg-card)] border-r border-[var(--border-card)] ${sidebarOpen ? 'w-[280px]' : 'w-0'}`}
      >
        {sidebarOpen && profileId && (
          <ChatHistory
            examProfileId={profileId}
            activeConversationId={conversationId}
            onSelect={loadConversation}
            onNew={newConversation}
          />
        )}
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col relative bg-[var(--bg-body)] min-w-0">
        {/* Header bar */}
        <div className="px-4 py-2 border-b border-[var(--border-card)] flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-1.5 rounded-lg hover:bg-[var(--bg-input)] text-[var(--text-muted)] transition-colors hidden md:flex"
              title={t('ai.toggleSidebar')}
            >
              {sidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeft className="w-4 h-4" />}
            </button>
            <span className="text-sm font-medium text-[var(--text-heading)]">{t('ai.chat')}</span>
          </div>
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

        {/* Messages scroll area */}
        <ChatContextProvider value={{ examProfileId: profileId, getToken }}>
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <div className="max-w-[740px] mx-auto w-full px-6 py-6">
            {messages.length === 0 && !streamingText ? (
              <ChatEmptyState suggestions={suggestions} onSend={(prompt) => handleSend(prompt)} />
            ) : (
              <div className="space-y-6">
                {messages.map((msg, i) => (
                  <ChatMessageBubble key={i} message={msg} />
                ))}

                {streamingText && (
                  <ChatMessageBubble
                    message={{ role: 'assistant', content: streamingText }}
                    isStreaming
                  />
                )}

                <ToolCallIndicator toolName={currentToolCall} onCancel={cancel} />

                {quotaExceeded ? (
                  <UpgradePrompt messagesUsed={messagesUsedToday} />
                ) : error ? (
                  <div className="text-sm text-red-500 bg-red-500/10 rounded-lg p-3">{error}</div>
                ) : null}
              </div>
            )}
          </div>
        </div>
        </ChatContextProvider>

        {/* Attachment save prompt */}
        {pendingSaveAttachments && profileId && !isLoading && (
          <div className="max-w-[740px] mx-auto w-full px-4">
            <AttachmentSavePrompt
              attachments={pendingSaveAttachments}
              examProfileId={profileId}
              onDismiss={() => setPendingSaveAttachments(null)}
            />
          </div>
        )}

        {/* Floating input */}
        <div className="max-w-[740px] mx-auto w-full px-4 pb-6 pt-2">
          <ChatInput
            onSend={handleSend}
            disabled={isLoading || quotaExceeded}
            placeholder={t('ai.typeMessage')}
            attachments={attachments}
            onAddFiles={addFiles}
            onRemoveAttachment={removeAttachment}
            isParsing={isParsing}
          />
        </div>

        {/* Drag overlay */}
        {isDragging && (
          <div className="absolute inset-0 drag-overlay z-20 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <Upload className="w-10 h-10 text-[var(--accent-text)]" />
              <span className="text-lg font-medium text-[var(--accent-text)]">{t('ai.dropFilesHere')}</span>
            </div>
          </div>
        )}
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
