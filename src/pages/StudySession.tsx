import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import { Upload, MessageCircle, Layers, RotateCcw, GitBranch, ListChecks, BookOpen, X } from 'lucide-react'
import { useExamProfile } from '../hooks/useExamProfile'
import { useKnowledgeGraph } from '../hooks/useKnowledgeGraph'
import { useAgent } from '../hooks/useAgent'
import { useTutorPreferences } from '../hooks/useTutorPreferences'
import { useSessionInsights } from '../hooks/useSessionInsights'
import { useStudentModel } from '../hooks/useStudentModel'
import { useAttachments } from '../hooks/useAttachments'
import { useDragAndDrop } from '../hooks/useDragAndDrop'
import { useSources } from '../hooks/useSources'
import { useStudyPlan } from '../hooks/useStudyPlan'
import { useExerciseBank } from '../hooks/useExerciseBank'
import { useConceptCards } from '../hooks/useConceptCards'
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
import { ConceptCardStrip } from '../components/session/ConceptCardStrip'
import { CardsView } from '../components/session/CardsView'
import { CourseView } from '../components/session/CourseView'
import { ReviewView } from '../components/session/ReviewView'
import { KnowledgeMap } from '../components/session/KnowledgeMap'
import { ExerciseDrill } from '../components/session/ExerciseDrill'
import { InlineActionContainer } from '../components/actions/InlineActionContainer'
import { useInlineAction } from '../hooks/useInlineAction'
import type { SessionContext } from '../ai/systemPrompt'
import type { ChatAttachment } from '../hooks/useAttachments'

type SessionView = 'course' | 'cards' | 'map' | 'review' | 'exercises'

const CODING_KEYWORDS = ['python', 'java', 'javascript', 'c++', 'programming', 'code', 'coding', 'algorithm', 'data structure', 'web dev', 'react', 'sql']

export default function StudySession() {
  const { t } = useTranslation()
  const { getToken } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const topicParam = searchParams.get('topic')
  const modeParam = searchParams.get('mode')
  // Valid session modes activate a specialized system prompt in useAgent.
  const sessionMode = modeParam === 'socratic' || modeParam === 'explain-back' ? modeParam : undefined

  const { activeProfile } = useExamProfile()
  const profileId = activeProfile?.id
  const { subjects, chapters, topics, dailyLogs, getTopicsForChapter } = useKnowledgeGraph(profileId)
  const { documents } = useSources(profileId)
  const { preferences } = useTutorPreferences(profileId)
  const { recentInsights } = useSessionInsights(profileId)
  const { studentModel, conversationSummaries } = useStudentModel(profileId)
  const { todaysPlan, markActivityCompleted } = useStudyPlan(profileId)
  const { getExerciseStatsForTopic, getExerciseStatsByTopic: getExerciseStatsMap } = useExerciseBank(profileId)
  const exerciseStatsByTopic = useMemo(() => getExerciseStatsMap(), [getExerciseStatsMap])

  const [activeView, setActiveView] = useState<SessionView>('course')
  const inlineAction = useInlineAction()
  // Chat is a slide-in side panel, not a tab. Auto-open for Socratic/explain-back modes.
  const [chatPanelOpen, setChatPanelOpen] = useState(!!sessionMode)

  // Determine layout variant based on exam type
  const layoutVariant = useMemo(() => {
    if (!activeProfile) return 'default' as const
    const examType = activeProfile.examType
    if (examType === 'graduate-research') return 'research' as const
    if (examType === 'professional-exam') return 'drill' as const
    if (examType === 'university-course') {
      const hasCoding = subjects.some(s =>
        CODING_KEYWORDS.some(kw => s.name.toLowerCase().includes(kw))
      )
      return hasCoding ? 'coding' as const : 'default' as const
    }
    return 'default' as const
  }, [activeProfile, subjects])

  // Research layout: materials panel auto-opens
  const [materialsOpen, setMaterialsOpen] = useState(false)
  useEffect(() => {
    if (layoutVariant === 'research') setMaterialsOpen(true)
  }, [layoutVariant])

  const {
    attachments, addFiles, removeAttachment, clearAttachments, isParsing, getRelevantChunks,
  } = useAttachments()
  const { isDragging, handleDragEnter, handleDragLeave, handleDragOver, handleDrop } = useDragAndDrop(addFiles)

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
  }, [topicParam, topics, subjects, activeProfile])

  // Resolve subject for the current topic
  const subject = useMemo(() => {
    if (!topic) return undefined
    return subjects.find(s => s.id === topic.subjectId)
  }, [topic, subjects])

  // Load concept cards for current topic
  const { cards: conceptCards } = useConceptCards(profileId, topic?.id)
  const cardTitles = useMemo(() => conceptCards.map(c => c.title), [conceptCards])

  // Build session context for the AI
  // Resolve chapter for current topic
  const chapter = useMemo(() => {
    if (!topic?.chapterId) return undefined
    return chapters.find(ch => ch.id === topic.chapterId)
  }, [topic, chapters])

  // Sibling topics in the same chapter
  const siblingTopics = useMemo(() => {
    if (!topic?.chapterId) return []
    return getTopicsForChapter(topic.chapterId)
      .filter(t => t.id !== topic.id)
      .map(t => t.name)
      .slice(0, 5)
  }, [topic, getTopicsForChapter])

  // Exercise stats for current topic
  const exerciseStats = useMemo(() => {
    if (!topic) return undefined
    return getExerciseStatsForTopic(topic.id)
  }, [topic, getExerciseStatsForTopic])

  const sessionContext: SessionContext | undefined = useMemo(() => {
    if (!topic || !subject) return undefined
    return {
      topicName: topic.name,
      subjectName: subject.name,
      chapterName: chapter?.name,
      mastery: topic.mastery,
      decayedMastery: decayedMastery(topic),
      lastStudied: topic.interval > 0 && topic.nextReviewDate
        ? new Date(new Date(topic.nextReviewDate).getTime() - topic.interval * 86400000).toISOString().slice(0, 10)
        : null,
      questionsAttempted: topic.questionsAttempted,
      questionsCorrect: topic.questionsCorrect,
      dueFlashcards: 0,
      existingCardTitles: cardTitles,
      exerciseStats: exerciseStats && exerciseStats.total > 0 ? exerciseStats : undefined,
      siblingTopics,
    }
  }, [topic, subject, chapter, cardTitles, exerciseStats, siblingTopics])

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
    sessionMode,
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
          <p className="text-[var(--text-muted)] mb-4">{t('session.noTopics')}</p>
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
        chapterName={chapter?.name}
        onToggleMaterials={() => setMaterialsOpen(!materialsOpen)}
        materialsOpen={materialsOpen}
      />

      {/* Plan strip */}
      <PlanStrip
        todaysPlan={todaysPlan}
        currentTopicName={topic.name}
        onToggleActivity={markActivityCompleted}
      />

      {/* Auto-resolution banner — shown when topic was not explicitly chosen via URL */}
      {(!topicParam || topic.name !== topicParam) && (
        <div className="flex items-center gap-2 px-4 py-1.5 border-b border-[var(--border-card)] bg-blue-500/5 text-xs text-[var(--text-muted)]">
          <span>
            Studying: <strong className="text-[var(--text-heading)]">{topic.name}</strong>
            {!topicParam ? ' (auto-selected)' : ' (closest match)'}
          </span>
          <select
            value={topic.name}
            onChange={e => {
              const selected = topics.find(t => t.name === e.target.value)
              if (selected) navigate(`/session?topic=${encodeURIComponent(selected.name)}`, { replace: true })
            }}
            className="ml-auto text-xs bg-[var(--bg-input)] border border-[var(--border-card)] rounded px-2 py-0.5 text-[var(--text-body)]"
          >
            {topics.map(t => (
              <option key={t.id} value={t.name}>{t.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Session suggestions strip (above tabs, only when no messages yet) */}
      {messages.length === 0 && !streamingText && !inlineAction.current && (
        <div className="px-4 py-2 border-b border-[var(--border-card)] bg-[var(--bg-card)]/20 overflow-x-auto">
          <SessionSuggestions
            topic={topic}
            dueFlashcards={dueFlashcards}
            sessionInsights={recentInsights ?? []}
            onAction={inlineAction.dispatch}
            onSend={(prompt) => { setChatPanelOpen(true); handleSend(prompt) }}
          />
        </div>
      )}

      {/* View toggle — 5 tabs (Chat is a side panel, not a tab) */}
      <div className="flex items-center gap-1 px-4 py-1.5 border-b border-[var(--border-card)] bg-[var(--bg-card)]/30 overflow-x-auto">
        {([
          { key: 'course' as const, icon: BookOpen, label: 'Course' },
          { key: 'cards' as const, icon: Layers, label: `Cards${conceptCards.length > 0 ? ` (${conceptCards.length})` : ''}` },
          { key: 'exercises' as const, icon: ListChecks, label: 'Exercises' },
          { key: 'review' as const, icon: RotateCcw, label: 'Review' },
          { key: 'map' as const, icon: GitBranch, label: 'Map' },
        ]).map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            onClick={() => setActiveView(key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex-shrink-0 whitespace-nowrap ${
              activeView === key
                ? 'bg-[var(--accent-text)] text-white'
                : 'text-[var(--text-muted)] hover:bg-[var(--bg-input)] hover:text-[var(--text-body)]'
            }`}
          >
            <Icon className="w-3.5 h-3.5" /> {label}
          </button>
        ))}
      </div>

      {/* Main content area */}
      <div className="flex-1 flex relative min-h-0">
        {/* Inline action overlay (renders above any tab when an action is dispatched) */}
        {inlineAction.current && (
          <div className="absolute inset-0 z-20 bg-black/30 backdrop-blur-sm flex items-start justify-center p-6 overflow-y-auto animate-fade-in">
            <div className="w-full max-w-2xl mt-4">
              <InlineActionContainer action={inlineAction.current} onClose={inlineAction.close} />
            </div>
          </div>
        )}

        {activeView === 'course' && profileId && topic && (
          <CourseView
            examProfileId={profileId}
            topicId={topic.id}
            topicName={topic.name}
          />
        )}

        {activeView === 'cards' && profileId && topic && (
          <CardsView
            examProfileId={profileId}
            topicId={topic.id}
            onQuizMe={(title, cardId) => {
              inlineAction.dispatch({
                type: 'quiz-concept-card',
                cardId,
                cardTitle: title,
                topicId: topic.id,
              })
            }}
          />
        )}

        {activeView === 'exercises' && profileId && topic && (
          <ExerciseDrill
            examProfileId={profileId}
            topicId={topic.id}
            topicName={topic.name}
          />
        )}

        {activeView === 'map' && profileId && topic && (
          <KnowledgeMap
            subject={subject}
            chapters={topic.subjectId ? chapters.filter(ch => ch.subjectId === topic.subjectId) : []}
            topics={topics.filter(t => t.subjectId === topic.subjectId)}
            currentTopicId={topic.id}
            exerciseStatsByTopic={exerciseStatsByTopic}
          />
        )}

        {activeView === 'review' && profileId && topic && (
          <ReviewView
            examProfileId={profileId}
            topicId={topic.id}
            onDone={() => setActiveView('course')}
          />
        )}

        {/* Materials panel (available on all views) */}
        <MaterialsPanel
          documents={documents}
          isOpen={materialsOpen}
          onClose={() => setMaterialsOpen(false)}
        />

        {/* Chat side panel (slide-in from right) */}
        {chatPanelOpen && (
          <div className="fixed right-0 top-0 bottom-0 w-full sm:w-[400px] z-30 bg-[var(--bg-card)] border-l border-[var(--border-card)] flex flex-col shadow-xl animate-slide-in-right">
            <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border-card)] shrink-0">
              <span className="text-sm font-medium text-[var(--text-heading)] truncate">
                {sessionMode === 'socratic' ? 'Socratic dialog' : sessionMode === 'explain-back' ? 'Explain back' : topic.name}
              </span>
              <button onClick={() => setChatPanelOpen(false)} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-body)]">
                <X className="w-4 h-4" />
              </button>
            </div>
            {topic && profileId && <ConceptCardStrip examProfileId={profileId} topicId={topic.id} />}
            <ChatContextProvider value={{ examProfileId: profileId, getToken }}>
              <div ref={scrollRef} className="flex-1 overflow-y-auto">
                <div className="px-4 py-4">
                  <div className="space-y-6">
                    {messages.map((msg) => (
                      <ChatMessageBubble key={msg.id} message={msg} />
                    ))}
                    {streamingText && (
                      <ChatMessageBubble message={{ id: 'streaming', role: 'assistant', content: streamingText }} isStreaming />
                    )}
                    <ToolCallIndicator toolName={currentToolCall} onCancel={cancel} />
                    {quotaExceeded ? (
                      <UpgradePrompt messagesUsed={messagesUsedToday} />
                    ) : error ? (
                      <div className="text-sm text-red-500 bg-red-500/10 rounded-lg p-3">{error}</div>
                    ) : null}
                  </div>
                </div>
              </div>
            </ChatContextProvider>
            <div className="px-4 pb-4 pt-2 shrink-0">
              <div className="flex items-center gap-2 mb-1 justify-end">
                <QuotaIndicator messagesUsedToday={messagesUsedToday} />
              </div>
              <ChatInput
                onSend={handleSend}
                disabled={isLoading || quotaExceeded}
                placeholder={t('session.placeholder', 'Ask about {{topic}}...', { topic: topic.name })}
                attachments={attachments}
                onAddFiles={addFiles}
                onRemoveAttachment={removeAttachment}
                isParsing={isParsing}
              />
            </div>
          </div>
        )}
      </div>

      {/* Floating chat FAB (when panel is closed) */}
      {!chatPanelOpen && (
        <button
          onClick={() => setChatPanelOpen(true)}
          aria-label="Open chat"
          className="fixed bottom-20 right-4 z-20 w-12 h-12 rounded-full bg-[var(--accent-text)] text-white shadow-lg flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
        >
          <MessageCircle className="w-5 h-5" />
        </button>
      )}

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
