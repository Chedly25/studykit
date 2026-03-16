import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Brain, Play, BarChart3, Settings } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { useExamProfile } from '../hooks/useExamProfile'
import { useKnowledgeGraph } from '../hooks/useKnowledgeGraph'
import { useAgent } from '../hooks/useAgent'
import { useTutorPreferences } from '../hooks/useTutorPreferences'
import { ChatMessageBubble } from '../components/chat/ChatMessage'
import { ChatInput } from '../components/chat/ChatInput'
import { ToolCallIndicator } from '../components/chat/ToolCallIndicator'
import { TutorSettingsModal } from '../components/chat/TutorSettingsModal'
import { QuotaIndicator } from '../components/subscription/QuotaIndicator'
import { UpgradePrompt } from '../components/subscription/UpgradePrompt'
import { SourcesToggle } from '../components/sources/SourcesToggle'
import { useSources } from '../hooks/useSources'
import { getChunksByDocumentId } from '../lib/sources'
import { buildPracticeExamPrompt } from '../lib/sourceActions'
import { db } from '../db'
import type { ExamFormat } from '../db/schema'
import { useLiveQuery } from 'dexie-react-hooks'

export default function PracticeExam() {
  const { t } = useTranslation()
  const { activeProfile } = useExamProfile()
  const profileId = activeProfile?.id
  const { subjects, topics, dailyLogs, weakTopics } = useKnowledgeGraph(profileId)

  const [searchParams] = useSearchParams()
  const sourceId = searchParams.get('sourceId')
  const [sourcesEnabled, setSourcesEnabled] = useState(!!sourceId)
  const { documentCount } = useSources(profileId)
  const { preferences, updatePreferences, resetToDefaults } = useTutorPreferences(profileId)
  const [showSettings, setShowSettings] = useState(false)

  const {
    messages, isLoading, currentToolCall, streamingText, error,
    quotaExceeded, messagesUsedToday,
    sendMessage,
  } = useAgent({ profile: activeProfile, subjects, topics, dailyLogs, sourcesEnabled, tutorPreferences: preferences })

  const examFormats = useLiveQuery(
    () => profileId ? db.examFormats.where('examProfileId').equals(profileId).toArray() : Promise.resolve([] as ExamFormat[]),
    [profileId]
  ) ?? []

  const [started, setStarted] = useState(false)
  const [questionCount, setQuestionCount] = useState(10)
  const [focusSubject, setFocusSubject] = useState<string>('')
  const [examSection, setExamSection] = useState<string>('')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, streamingText])

  if (!activeProfile) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <h1 className="text-2xl font-bold text-[var(--text-heading)] mb-4">{t('ai.practiceSession')}</h1>
        <p className="text-[var(--text-muted)]">{t('ai.createProfileFirst')}</p>
        <a href="/exam-profile" className="btn-primary px-6 py-2.5 mt-4 inline-block">{t('profile.create')}</a>
      </div>
    )
  }

  const handleStart = async () => {
    setStarted(true)

    // If a specific source was requested, build prompt from its chunks
    if (sourceId && sourcesEnabled) {
      const doc = await db.documents.get(sourceId)
      if (doc) {
        const chunks = await getChunksByDocumentId(sourceId)
        const prompt = buildPracticeExamPrompt(
          doc.title,
          chunks.map(c => c.content),
          activeProfile.examType,
        )
        sendMessage(prompt)
        return
      }
    }

    const subjectNote = focusSubject ? ` focusing on ${focusSubject}` : ' covering my weakest topics'
    const sectionNote = examSection ? ` Use the "${examSection}" exam format for all questions.` : ''
    sendMessage(
      `Generate a practice session with ${questionCount} questions${subjectNote} for my ${activeProfile.name} study goal.${sectionNote} Present one question at a time. After I answer each one, tell me if I'm right, explain why, and log the result. Then show the next question. At the end, give me a summary of my performance.`
    )
  }

  // Setup screen
  if (!started) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 animate-fade-in">
        <div className="text-center mb-8">
          <BarChart3 className="w-12 h-12 text-[var(--accent-text)] mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-[var(--text-heading)] mb-2">{t('ai.practiceSession')}</h1>
          <p className="text-[var(--text-muted)]">
            {t('ai.practiceSubtitle')}
          </p>
        </div>

        <div className="glass-card p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--text-body)] mb-1">{t('ai.numberOfQuestions')}</label>
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
            <label className="block text-sm font-medium text-[var(--text-body)] mb-1">{t('ai.focusArea')}</label>
            <select
              value={focusSubject}
              onChange={e => setFocusSubject(e.target.value)}
              className="select-field w-full"
            >
              <option value="">{t('ai.autoWeakest')}</option>
              {subjects.map(s => (
                <option key={s.id} value={s.name}>{s.name} — {Math.round(s.mastery * 100)}%</option>
              ))}
            </select>
          </div>

          {examFormats.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-[var(--text-body)] mb-1">{t('examFormat.title')}</label>
              <select
                value={examSection}
                onChange={e => setExamSection(e.target.value)}
                className="select-field w-full"
              >
                <option value="">All sections</option>
                {examFormats.map(f => (
                  <option key={f.id} value={f.formatName}>{f.formatName} — {f.pointWeight}%</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-[var(--text-body)]">{t('ai.useSources')}</label>
            <SourcesToggle enabled={sourcesEnabled} onToggle={setSourcesEnabled} documentCount={documentCount} />
          </div>

          {weakTopics.length > 0 && (
            <div className="text-xs text-[var(--text-muted)]">
              {t('ai.weakAreas')}: {weakTopics.slice(0, 3).map(t => t.name).join(', ')}
            </div>
          )}

          <button onClick={handleStart} className="btn-primary px-6 py-2.5 w-full flex items-center justify-center gap-2">
            <Play className="w-4 h-4" /> {t('ai.startPractice')}
          </button>
        </div>
      </div>
    )
  }

  // Active exam
  return (
    <div className="max-w-3xl mx-auto px-4 py-4 animate-fade-in flex flex-col" style={{ height: 'calc(100vh - 8rem)' }}>
      <div className="glass-card flex-1 flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--border-card)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-[var(--accent-text)]" />
            <span className="text-sm font-medium text-[var(--text-heading)]">{t('ai.practiceSession')}</span>
            <span className="text-xs text-[var(--text-muted)]">&middot; {t('ai.questions', { count: questionCount })}</span>
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

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
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

        <ChatInput onSend={sendMessage} disabled={isLoading || quotaExceeded} placeholder={t('ai.typeAnswer')} />
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
