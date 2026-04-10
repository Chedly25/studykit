import { useState, useRef, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@clerk/clerk-react'
import { X, Brain, Settings, Volume2, VolumeX } from 'lucide-react'
import { useExamProfile } from '../../hooks/useExamProfile'
import { useKnowledgeGraph } from '../../hooks/useKnowledgeGraph'
import { useAgent } from '../../hooks/useAgent'
import { useTutorPreferences } from '../../hooks/useTutorPreferences'
import { useAttachments } from '../../hooks/useAttachments'
import { ChatMessageBubble } from './ChatMessage'
import { CitationPopover, useCitationPopover } from './SourceCitation'
import { ChatInput } from './ChatInput'
import { ToolCallIndicator } from './ToolCallIndicator'
import { ChatHistory } from './ChatHistory'
import { TutorSettingsModal } from './TutorSettingsModal'
import { ChatContextProvider } from './ChatContext'
import { QuotaIndicator } from '../subscription/QuotaIndicator'
import { UpgradePrompt } from '../subscription/UpgradePrompt'
import { SourcesToggle } from '../sources/SourcesToggle'
import { AttachmentSavePrompt } from './AttachmentSavePrompt'
import { useSources } from '../../hooks/useSources'
import { useVoiceInput } from '../../hooks/useVoiceInput'
import { useVoiceOutput } from '../../hooks/useVoiceOutput'
import { usePhotoCapture } from '../../hooks/usePhotoCapture'
import { useSubscription } from '../../hooks/useSubscription'
import type { ChatAttachment } from '../../hooks/useAttachments'

interface Props {
  open: boolean
  onClose: () => void
  prefill?: string | null
  onPrefillConsumed?: () => void
  subjectId?: string | null
  subjectName?: string | null
  context?: Record<string, string> | null
  onContextConsumed?: () => void
}

export function ChatPanel({ open, onClose, prefill, onPrefillConsumed, subjectId, subjectName, context, onContextConsumed }: Props) {
  const { t } = useTranslation()
  const { getToken } = useAuth()
  const { activeProfile } = useExamProfile()
  const profileId = activeProfile?.id
  const { subjects, topics, dailyLogs } = useKnowledgeGraph(profileId)

  const [sourcesEnabled, setSourcesEnabled] = useState(false)
  const { documentCount } = useSources(profileId)
  const { preferences, updatePreferences, resetToDefaults } = useTutorPreferences(profileId)
  const [showSettings, setShowSettings] = useState(false)
  const citationPopover = useCitationPopover(profileId)

  const {
    attachments, addFiles, removeAttachment, clearAttachments, isParsing, getRelevantChunks,
  } = useAttachments()

  const {
    messages, isLoading, currentToolCall, streamingText, error,
    conversationId, quotaExceeded, messagesUsedToday,
    sendMessage, cancel, loadConversation, newConversation,
  } = useAgent({ profile: activeProfile, subjects, topics, dailyLogs, sourcesEnabled, tutorPreferences: preferences, subjectId, subjectName })

  // Voice mode
  const { isPro } = useSubscription()
  const voiceInput = useVoiceInput()
  const voiceOutput = useVoiceOutput()
  const [voiceTranscription, setVoiceTranscription] = useState<string | null>(null)

  // Photo capture
  const photoCapture = usePhotoCapture()
  const [imagePreviewData, setImagePreviewData] = useState<{
    url: string
    blob: Blob
    text: string | null
    isExtracting: boolean
  } | null>(null)

  const scrollRef = useRef<HTMLDivElement>(null)
  const [pendingSaveAttachments, setPendingSaveAttachments] = useState<ChatAttachment[] | null>(null)
  const [inputPrefill, setInputPrefill] = useState<string | undefined>()
  const clearInputPrefill = useCallback(() => setInputPrefill(undefined), [])

  // Handle prefill from parent
  useEffect(() => {
    if (prefill && open) {
      setInputPrefill(prefill)
      onPrefillConsumed?.()
    }
  }, [prefill, open, onPrefillConsumed])

  // Handle context from parent — build a contextual prefill
  useEffect(() => {
    if (context && open && !prefill) {
      const parts: string[] = []
      if (context.topicName) parts.push(`I'm studying: ${context.topicName}`)
      if (context.itemType) parts.push(`(${context.itemType.replace('-', ' ')})`)
      if (context.subjectName) parts.push(`in ${context.subjectName}`)
      if (context.question) parts.push(`\nQuestion: ${context.question}`)
      if (context.score) parts.push(`\nScore: ${context.score}`)
      if (context.weakTopics) parts.push(`\nWeak areas: ${context.weakTopics}`)
      if (parts.length > 0) {
        setInputPrefill(parts.join(' ').trim() + '\n\n')
      }
      onContextConsumed?.()
    }
  }, [context, open, prefill, onContextConsumed])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, streamingText])

  // Auto-speak new assistant messages when voice output is enabled
  const prevMsgCountRef = useRef(messages.length)
  useEffect(() => {
    if (voiceOutput.voiceEnabled && messages.length > prevMsgCountRef.current) {
      const lastMsg = messages[messages.length - 1]
      if (lastMsg?.role === 'assistant' && typeof lastMsg.content === 'string') {
        voiceOutput.speak(lastMsg.content)
      }
    }
    prevMsgCountRef.current = messages.length
  }, [messages.length, voiceOutput])

  const handleSend = useCallback(async (message: string, sentAttachments?: ChatAttachment[]) => {
    let attachmentContext: { chunks: Array<{ content: string; documentTitle: string; chunkIndex: number }> } | undefined

    if (sentAttachments && sentAttachments.length > 0) {
      const chunks = getRelevantChunks(message, 5)
      if (chunks.length > 0) {
        attachmentContext = { chunks }
      }
      setPendingSaveAttachments([...sentAttachments])
      clearAttachments()
    }

    await sendMessage(message, attachmentContext)
  }, [sendMessage, getRelevantChunks, clearAttachments])

  if (!open) return null

  return (
    <div className="fixed right-0 top-0 bottom-0 w-full sm:w-[400px] bg-[var(--bg-card)] border-l border-[var(--border-card)] z-50 flex flex-col shadow-2xl animate-slide-in-right">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-card)]">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-[var(--accent-text)]" />
          <span className="font-semibold text-[var(--text-heading)] text-sm">
            {subjectName ? `${subjectName} Tutor` : t('ai.chat')}
          </span>
          <SourcesToggle enabled={sourcesEnabled} onToggle={setSourcesEnabled} documentCount={documentCount} />
          <button
            onClick={() => setShowSettings(true)}
            className="p-1 rounded-lg hover:bg-[var(--bg-input)] text-[var(--text-muted)] transition-colors"
            title={t('ai.tutorSettings')}
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
          {isPro && (
            <button
              onClick={() => voiceOutput.setVoiceEnabled(!voiceOutput.voiceEnabled)}
              className={`p-1 rounded-lg transition-colors ${
                voiceOutput.voiceEnabled
                  ? 'bg-[var(--accent-bg)] text-[var(--accent-text)]'
                  : 'hover:bg-[var(--bg-input)] text-[var(--text-muted)]'
              }`}
              title={voiceOutput.voiceEnabled ? 'Disable voice output' : 'Enable voice output'}
            >
              {voiceOutput.voiceEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            </button>
          )}
          <QuotaIndicator messagesUsedToday={messagesUsedToday} />
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
          compact
        />
      )}

      {/* Messages */}
      <ChatContextProvider value={{ examProfileId: profileId, getToken }}>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-6">
        {!activeProfile ? (
          <div className="text-center text-sm text-[var(--text-muted)] py-8">
            {t('ai.createProfileFirst')}
          </div>
        ) : messages.length === 0 && !streamingText ? (
          <div className="text-center py-12">
            <Brain className="w-10 h-10 text-[var(--accent-text)] mx-auto mb-3" />
            <h2 className="text-lg font-semibold text-[var(--text-heading)] mb-2">{t('ai.emptyStateGreeting')}</h2>
            <p className="text-sm text-[var(--text-muted)]">{t('ai.emptyStateSubtitle')}</p>
          </div>
        ) : null}

        {messages.map((msg) => (
          <ChatMessageBubble
            key={msg.id}
            message={msg}
            examProfileId={profileId}
            onCitationClick={citationPopover.showCitation}
          />
        ))}

        {streamingText && (
          <ChatMessageBubble
            message={{ id: crypto.randomUUID(), role: 'assistant', content: streamingText }}
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
      </ChatContextProvider>

      {/* Attachment save prompt */}
      {pendingSaveAttachments && profileId && !isLoading && (
        <AttachmentSavePrompt
          attachments={pendingSaveAttachments}
          examProfileId={profileId}
          onDismiss={() => setPendingSaveAttachments(null)}
        />
      )}

      {/* Input */}
      <div className="p-3">
        <ChatInput
          onSend={handleSend}
          disabled={isLoading || !activeProfile || quotaExceeded}
          attachments={attachments}
          onAddFiles={addFiles}
          onRemoveAttachment={removeAttachment}
          isParsing={isParsing}
          initialValue={voiceTranscription ?? inputPrefill}
          onInitialValueConsumed={() => { clearInputPrefill(); setVoiceTranscription(null) }}
          voiceInput={isPro ? {
            isRecording: voiceInput.isRecording,
            isTranscribing: voiceInput.isTranscribing,
            onStartRecording: voiceInput.startRecording,
            onStopRecording: async () => {
              const text = await voiceInput.stopRecording()
              if (text) {
                if (voiceOutput.voiceEnabled) {
                  // Auto-send in voice mode
                  handleSend(text)
                } else {
                  setVoiceTranscription(text)
                }
              }
            },
            onCancelRecording: voiceInput.cancelRecording,
          } : undefined}
          photo={isPro ? {
            onSelectPhoto: async () => {
              const blob = await photoCapture.selectFromFiles()
              if (!blob) return
              const url = URL.createObjectURL(blob)
              setImagePreviewData({ url, blob, text: null, isExtracting: true })
              const text = await photoCapture.extractText(blob)
              setImagePreviewData(prev => prev ? { ...prev, text, isExtracting: false } : null)
            },
            isExtracting: photoCapture.isExtracting,
            imagePreview: imagePreviewData ? {
              imageUrl: imagePreviewData.url,
              extractedText: imagePreviewData.text,
              isExtracting: imagePreviewData.isExtracting,
              onRemove: () => {
                if (imagePreviewData.url) URL.revokeObjectURL(imagePreviewData.url)
                setImagePreviewData(null)
              },
            } : null,
          } : undefined}
        />
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

      {citationPopover.activeCitation && (
        <CitationPopover
          citation={citationPopover.activeCitation}
          content={citationPopover.citationContent}
          isLoading={citationPopover.isLoadingCitation}
          onClose={citationPopover.closeCitation}
        />
      )}
    </div>
  )
}
