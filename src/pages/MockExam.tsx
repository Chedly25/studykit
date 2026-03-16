import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Clock, Play, Brain, CheckCircle } from 'lucide-react'
import { useExamProfile } from '../hooks/useExamProfile'
import { useKnowledgeGraph } from '../hooks/useKnowledgeGraph'
import { useAgent } from '../hooks/useAgent'
import { ChatMessageBubble } from '../components/chat/ChatMessage'
import { ChatInput } from '../components/chat/ChatInput'
import { ToolCallIndicator } from '../components/chat/ToolCallIndicator'
import { db } from '../db'
import type { ExamFormat, MockExam as MockExamType } from '../db/schema'
import { useLiveQuery } from 'dexie-react-hooks'

export default function MockExam() {
  const { t } = useTranslation()
  const { activeProfile } = useExamProfile()
  const profileId = activeProfile?.id
  const { subjects, topics, dailyLogs } = useKnowledgeGraph(profileId)

  const formats = useLiveQuery(
    () => profileId ? db.examFormats.where('examProfileId').equals(profileId).toArray() : Promise.resolve([] as ExamFormat[]),
    [profileId]
  ) ?? []

  const {
    messages, isLoading, currentToolCall, streamingText, error,
    sendMessage,
  } = useAgent({ profile: activeProfile, subjects, topics, dailyLogs })

  const [started, setStarted] = useState(false)
  const [timeLimit, setTimeLimit] = useState(60)
  const [timeLeft, setTimeLeft] = useState(0)
  const [examId, setExamId] = useState<string | null>(null)
  const [isFinished, setIsFinished] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const examIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, streamingText])

  // Countdown timer — decrement only, no side effects in updater
  useEffect(() => {
    if (!started || isFinished) return
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => (prev <= 1 ? 0 : prev - 1))
    }, 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [started, isFinished])

  // Auto-finish when time runs out
  useEffect(() => {
    if (started && !isFinished && timeLeft === 0 && examIdRef.current) {
      handleFinish()
    }
  }, [timeLeft, started, isFinished])

  if (!activeProfile) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <Clock className="w-12 h-12 text-[var(--accent-text)] mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-[var(--text-heading)] mb-4">{t('mockExam.title')}</h1>
        <p className="text-[var(--text-muted)]">{t('ai.createProfileFirst')}</p>
      </div>
    )
  }

  const handleStart = async () => {
    const exam: MockExamType = {
      id: crypto.randomUUID(),
      examProfileId: activeProfile.id,
      startTime: new Date().toISOString(),
      timeLimitMinutes: timeLimit,
      sections: JSON.stringify([]),
      status: 'in-progress',
    }
    await db.mockExams.put(exam)
    setExamId(exam.id)
    examIdRef.current = exam.id
    setTimeLeft(timeLimit * 60)
    setStarted(true)

    const formatInfo = formats.length > 0
      ? `\n\nExam format sections:\n${formats.map(f => `- ${f.formatName}: ${f.questionCount ?? 'variable'} questions, ${f.timeAllocation}min, ${f.pointWeight}% weight${f.samplePrompt ? ` (example: ${f.samplePrompt})` : ''}`).join('\n')}`
      : ''

    sendMessage(
      `This is a timed mock exam (${timeLimit} minutes) for ${activeProfile.name}. ${formatInfo}\n\nPlease generate a complete exam that covers my weakest topics. Present all questions at once, organized by section. I will submit all answers together. After I submit, grade each answer and give me a detailed score breakdown.`
    )
  }

  const handleFinish = async () => {
    setIsFinished(true)
    if (timerRef.current) clearInterval(timerRef.current)
    const currentExamId = examIdRef.current
    if (currentExamId) {
      await db.mockExams.update(currentExamId, {
        status: 'completed',
        endTime: new Date().toISOString(),
      })
    }
  }

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  // Setup screen
  if (!started) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 animate-fade-in">
        <div className="text-center mb-8">
          <Clock className="w-12 h-12 text-[var(--accent-text)] mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-[var(--text-heading)] mb-2">{t('mockExam.title')}</h1>
          <p className="text-[var(--text-muted)]">{t('mockExam.subtitle')}</p>
        </div>

        <div className="glass-card p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--text-body)] mb-1">{t('mockExam.timeLimit')}</label>
            <div className="flex gap-2">
              {[30, 60, 90, 120, 180].map(mins => (
                <button
                  key={mins}
                  onClick={() => setTimeLimit(mins)}
                  className={`px-3 py-1.5 rounded-lg text-sm ${
                    timeLimit === mins
                      ? 'bg-[var(--accent-bg)] text-[var(--accent-text)]'
                      : 'bg-[var(--bg-input)] text-[var(--text-body)]'
                  }`}
                >
                  {mins}m
                </button>
              ))}
            </div>
          </div>

          {formats.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-[var(--text-body)] mb-1">{t('mockExam.sections')}</label>
              <div className="space-y-1">
                {formats.map(f => (
                  <div key={f.id} className="text-sm text-[var(--text-body)] flex items-center justify-between bg-[var(--bg-input)] rounded-lg px-3 py-1.5">
                    <span>{f.formatName}</span>
                    <span className="text-xs text-[var(--text-muted)]">{f.timeAllocation}m &middot; {f.pointWeight}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button onClick={handleStart} className="btn-primary px-6 py-2.5 w-full flex items-center justify-center gap-2">
            <Play className="w-4 h-4" /> {t('mockExam.startExam')}
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
            <span className="text-sm font-medium text-[var(--text-heading)]">{t('mockExam.title')}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-sm font-mono font-bold ${timeLeft < 300 ? 'text-red-500' : 'text-[var(--text-heading)]'}`}>
              <Clock className="w-3.5 h-3.5 inline mr-1" />
              {formatTime(timeLeft)}
            </span>
            {!isFinished && (
              <button onClick={handleFinish} className="btn-secondary text-xs px-3 py-1 flex items-center gap-1">
                <CheckCircle className="w-3 h-3" /> {t('mockExam.submit')}
              </button>
            )}
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
          {error && (
            <div className="text-sm text-red-500 bg-red-500/10 rounded-lg p-3">{error}</div>
          )}
        </div>

        <ChatInput
          onSend={sendMessage}
          disabled={isLoading}
          placeholder={isFinished ? t('mockExam.reviewPlaceholder') : t('mockExam.answerPlaceholder')}
        />
      </div>
    </div>
  )
}
