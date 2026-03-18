import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import { Upload } from 'lucide-react'
import { useExamProfile } from '../hooks/useExamProfile'
import { useKnowledgeGraph } from '../hooks/useKnowledgeGraph'
import { useAgent } from '../hooks/useAgent'
import { useTutorPreferences } from '../hooks/useTutorPreferences'
import { useSessionInsights } from '../hooks/useSessionInsights'
import { useStudentModel } from '../hooks/useStudentModel'
import { useAttachments } from '../hooks/useAttachments'
import { useSources } from '../hooks/useSources'
import { useStudyPlan } from '../hooks/useStudyPlan'
import { computeDailyRecommendations } from '../lib/studyRecommender'
import { decayedMastery } from '../lib/knowledgeGraph'
import { ChatMessageBubble } from '../components/chat/ChatMessage'
import { ChatInput } from '../components/chat/ChatInput'
import { ToolCallIndicator } from '../components/chat/ToolCallIndicator'
import { ChatContextProvider } from '../components/chat/ChatContext'
import { QuotaIndicator } from '../components/subscription/QuotaIndicator'
import { UpgradePrompt } from '../components/subscription/UpgradePrompt'
import { SessionHeader } from '../components/session/SessionHeader'
import { SessionSuggestions } from '../components/session/SessionSuggestions'
import { PlanStrip } from '../components/session/PlanStrip'
import { MaterialsPanel } from '../components/session/MaterialsPanel'
import type { SessionContext } from '../ai/systemPrompt'
import type { ChatAttachment } from '../hooks/useAttachments'

export default function StudySession() {
  const { t } = useTranslation()
  const { getToken } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const topicParam = searchParams.get('topic')

  const { activeProfile } = useExamProfile()
  const profileId = activeProfile?.id
  const { subjects, topics, dailyLogs } = useKnowledgeGraph(profileId)
  const { documents } = useSources(profileId)
  const { preferences } = useTutorPreferences(profileId)
  const { recentInsights } = useSessionInsights(profileId)
  const { studentModel, conversationSummaries } = useStudentModel(profileId)
  const { todaysPlan, markActivityCompleted } = useStudyPlan(profileId)

  const [materialsOpen, setMaterialsOpen] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  const {
    attachments, addFiles, removeAttachment, clearAttachments, isParsing, getRelevantChunks,
  } = useAttachments()

  // Resolve current topic
  const topic = useMemo(() => {
    if (topicParam) {
      const match = topics.find(t => t.name === topicParam)
      if (match) return match
    }
    // Fallback: use first recommendation
    if (topics.length > 0 && subjects.length > 0 && activeProfile) {
      const daysUntilExam = activeProfile.examDate
        ? Math.max(0, Math.ceil((new Date(activeProfile.examDate).getTime() - Date.now()) / 86400000))
        : 90
      const recs = computeDailyRecommendations({
        topics,
        subjects,
        daysUntilExam,
        dueFlashcardsByTopic: new Map(),
      })
      if (recs.length > 0) {
        const recTopic = topics.find(t => t.name === recs[0].topicName)
        if (recTopic) return recTopic
      }
    }
    return topics[0] ?? null
  }, [topicParam, topics, subjects, dailyLogs, activeProfile])

  // Resolve subject for the current topic
  const subject = useMemo(() => {
    if (!topic) return undefined
    return subjects.find(s => s.id === topic.subjectId)
  }, [topic, subjects])

  // Build session context for the AI
  const sessionContext: SessionContext | undefined = useMemo(() => {
    if (!topic || !subject) return undefined
    return {
      topicName: topic.name,
      subjectName: subject.name,
      mastery: topic.mastery,
      decayedMastery: decayedMastery(topic),
      lastStudied: topic.interval > 0 && topic.nextReviewDate
        ? new Date(new Date(topic.nextReviewDate).getTime() - topic.interval * 86400000).toISOString().slice(0, 10)
        : null,
      questionsAttempted: topic.questionsAttempted,
      questionsCorrect: topic.questionsCorrect,
      dueFlashcards: 0, // TODO: compute from flashcard decks
    }
  }, [topic, subject])

  // Due flashcards count for suggestions
  const dueFlashcards = useMemo(() => {
    if (!topic) return 0
    return topic.nextReviewDate && new Date(topic.nextReviewDate) <= new Date() ? 1 : 0
  }, [topic])

  const agent = useAgent({
    profile: activeProfile,
    subjects,
    topics,
    dailyLogs,
    sourcesEnabled: true, // Always on in session
    tutorPreferences: preferences,
    sessionInsights: recentInsights,
    studentModel,
    conversationSummaries,
    sessionContext,
  })

  const {
    messages, isLoading, currentToolCall, streamingText, error,
    quotaExceeded, messagesUsedToday,
    sendMessage, cancel, newConversation,
  } = agent

  const scrollRef = useRef<HTMLDivElement>(null)
  const prevTopicRef = useRef(topicParam)

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, streamingText])

  // Reset conversation when topic changes
  useEffect(() => {
    if (topicParam !== prevTopicRef.current) {
      prevTopicRef.current = topicParam
      newConversation()
    }
  }, [topicParam, newConversation])

  const handleSend = useCallback(async (message: string, sentAttachments?: ChatAttachment[]) => {
    let attachmentContext: { chunks: Array<{ content: string; documentTitle: string; chunkIndex: number }> } | undefined

    if (sentAttachments && sentAttachments.length > 0) {
      const chunks = getRelevantChunks(message, 5)
      if (chunks.length > 0) {
        attachmentContext = { chunks }
      }
      clearAttachments()
    }

    await sendMessage(message, attachmentContext)
  }, [sendMessage, getRelevantChunks, clearAttachments])

  // Drag-and-drop
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

  // No profile
  if (!activeProfile) {
    return (
      <div className="h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="text-center">
          <p className="text-[var(--text-muted)] mb-4">{t('ai.createProfileFirst')}</p>
          <button onClick={() => navigate('/exam-profile')} className="btn-primary px-6 py-2">
            {t('profile.create')}
          </button>
        </div>
      </div>
    )
  }

  // No topic resolved
  if (!topic) {
    return (
      <div className="h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="text-center">
          <p className="text-[var(--text-muted)] mb-4">{t('session.noTopics', 'No topics found. Set up your subjects first.')}</p>
          <button onClick={() => navigate('/exam-profile')} className="btn-primary px-6 py-2">
            {t('nav.projects')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      className="h-[calc(100vh-4rem)] flex flex-col"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Session header */}
      <SessionHeader
        topic={topic}
        subject={subject}
        onToggleMaterials={() => setMaterialsOpen(!materialsOpen)}
        materialsOpen={materialsOpen}
      />

      {/* Plan strip */}
      <PlanStrip
        todaysPlan={todaysPlan}
        currentTopicName={topic.name}
        onToggleActivity={markActivityCompleted}
      />

      {/* Main content area */}
      <div className="flex-1 flex relative min-h-0">
        {/* Chat area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Messages */}
          <ChatContextProvider value={{ examProfileId: profileId, getToken }}>
            <div ref={scrollRef} className="flex-1 overflow-y-auto">
              <div className="max-w-[740px] mx-auto w-full px-6 py-6">
                {messages.length === 0 && !streamingText ? (
                  <SessionSuggestions
                    topic={topic}
                    dueFlashcards={dueFlashcards}
                    sessionInsights={recentInsights ?? []}
                    onSend={(prompt) => handleSend(prompt)}
                  />
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

          {/* Input */}
          <div className="max-w-[740px] mx-auto w-full px-4 pb-4 pt-2">
            <div className="flex items-center gap-2 mb-1 justify-end">
              <QuotaIndicator messagesUsedToday={messagesUsedToday} />
            </div>
            <ChatInput
              onSend={handleSend}
              disabled={isLoading || quotaExceeded}
              placeholder={t('session.placeholder', `Ask about ${topic.name}...`)}
              attachments={attachments}
              onAddFiles={addFiles}
              onRemoveAttachment={removeAttachment}
              isParsing={isParsing}
            />
          </div>
        </div>

        {/* Materials panel (overlay) */}
        <MaterialsPanel
          documents={documents}
          isOpen={materialsOpen}
          onClose={() => setMaterialsOpen(false)}
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
  )
}
