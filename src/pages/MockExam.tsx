import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Clock, Play, Brain, CheckCircle, Loader2, Trophy, ArrowLeft, ChevronDown, ChevronUp, RotateCcw, CheckCircle2, AlertTriangle } from 'lucide-react'
import { useAuth } from '@clerk/clerk-react'
import { useExamProfile } from '../hooks/useExamProfile'
import { useKnowledgeGraph } from '../hooks/useKnowledgeGraph'
import { useAgent } from '../hooks/useAgent'
import { ChatMessageBubble } from '../components/chat/ChatMessage'
import { ChatInput } from '../components/chat/ChatInput'
import { ToolCallIndicator } from '../components/chat/ToolCallIndicator'
import { streamChat } from '../ai/client'
import { db } from '../db'
import type { ExamFormat, MockExam as MockExamType } from '../db/schema'
import { useLiveQuery } from 'dexie-react-hooks'
import { MathText } from '../components/MathText'

// ─── Types for grading results ──────────────────────────────────

interface GradingResult {
  totalScore: number
  maxScore: number
  overallFeedback: string
  strengths: string[]
  areasForImprovement: string[]
  sections: Array<{
    name: string
    score: number
    maxScore: number
    feedback: string
    questions: Array<{
      question: string
      studentAnswer: string
      correctAnswer: string
      score: number
      maxScore: number
      feedback: string
    }>
  }>
}

// ─── Results Display Component ──────────────────────────────────

function MockExamResults({ exam, onBack, onRetake }: {
  exam: MockExamType
  onBack: () => void
  onRetake: () => void
}) {
  const { t } = useTranslation()
  const [expandedSection, setExpandedSection] = useState<number | null>(null)

  if (!exam.feedback || exam.totalScore == null || exam.maxScore == null) return null

  let results: GradingResult
  try {
    results = JSON.parse(exam.feedback)
  } catch {
    return <p className="text-sm text-[var(--text-muted)]">{t('mockExam.gradingFailed', 'Could not load results')}</p>
  }

  const percentage = exam.maxScore > 0 ? Math.round((exam.totalScore / exam.maxScore) * 100) : 0
  const passed = percentage >= 60

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 animate-fade-in space-y-5">
      {/* Back button */}
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--accent-text)] transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" /> {t('common.back')}
      </button>

      {/* Score header */}
      <div className="glass-card p-6 text-center">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3"
          style={{ backgroundColor: passed ? 'rgb(16 185 129 / 0.15)' : 'rgb(239 68 68 / 0.15)' }}>
          <Trophy className={`w-8 h-8 ${passed ? 'text-emerald-500' : 'text-red-500'}`} />
        </div>
        <div className={`text-4xl font-bold ${passed ? 'text-emerald-500' : 'text-red-500'}`}>
          {percentage}%
        </div>
        <div className="text-sm text-[var(--text-muted)] mt-1">
          {exam.totalScore}/{exam.maxScore} {t('practiceExam.points', 'points')}
        </div>
        <span className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-bold ${
          passed ? 'bg-emerald-500/15 text-emerald-600' : 'bg-red-500/15 text-red-600'
        }`}>
          {passed ? t('mockExam.passed', 'Passed') : t('mockExam.needsWork', 'Needs more practice')}
        </span>
        <p className="text-xs text-[var(--text-faint)] mt-2">
          {new Date(exam.startTime).toLocaleDateString()} · {exam.timeLimitMinutes}min
        </p>
      </div>

      {/* Overall feedback */}
      {results.overallFeedback && (
        <div className="glass-card p-4">
          <p className="text-sm text-[var(--text-body)] leading-relaxed">
            <MathText>{results.overallFeedback}</MathText>
          </p>
        </div>
      )}

      {/* Strengths & Improvements */}
      {(results.strengths?.length > 0 || results.areasForImprovement?.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {results.strengths?.length > 0 && (
            <div className="glass-card p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-500 mb-2">{t('mockExam.strengths', 'Strengths')}</h3>
              <ul className="space-y-1">
                {results.strengths.map((s, i) => (
                  <li key={i} className="text-sm text-[var(--text-body)] flex items-start gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {results.areasForImprovement?.length > 0 && (
            <div className="glass-card p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-warning)] mb-2">{t('mockExam.improvements', 'Areas to Improve')}</h3>
              <ul className="space-y-1">
                {results.areasForImprovement.map((a, i) => (
                  <li key={i} className="text-sm text-[var(--text-body)] flex items-start gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-[var(--color-warning)] mt-0.5 shrink-0" />
                    {a}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Section breakdown */}
      {results.sections?.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">{t('mockExam.sectionBreakdown', 'Section Breakdown')}</h3>
          {results.sections.map((section, i) => {
            const sectionPct = section.maxScore > 0 ? Math.round((section.score / section.maxScore) * 100) : 0
            const isExpanded = expandedSection === i
            return (
              <div key={i} className="glass-card overflow-hidden">
                <button
                  onClick={() => setExpandedSection(isExpanded ? null : i)}
                  className="w-full p-4 flex items-center justify-between text-left"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-[var(--text-heading)]">{section.name}</span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        sectionPct >= 70 ? 'bg-emerald-500/10 text-emerald-600' :
                        sectionPct >= 50 ? 'bg-amber-500/10 text-amber-600' :
                        'bg-red-500/10 text-red-600'
                      }`}>
                        {sectionPct}%
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-[var(--border-card)] overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${sectionPct >= 70 ? 'bg-emerald-500' : sectionPct >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                        style={{ width: `${sectionPct}%` }}
                      />
                    </div>
                  </div>
                  <div className="ml-3 shrink-0 flex items-center gap-2">
                    <span className="text-xs text-[var(--text-muted)]">{section.score}/{section.maxScore}</span>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-[var(--text-muted)]" /> : <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-[var(--border-card)] p-4 space-y-3">
                    {section.feedback && (
                      <p className="text-xs text-[var(--text-muted)] mb-2">{section.feedback}</p>
                    )}
                    {section.questions?.map((q, j) => {
                      const qPct = q.maxScore > 0 ? Math.round((q.score / q.maxScore) * 100) : 0
                      return (
                        <div key={j} className="bg-[var(--bg-input)] rounded-lg p-3 space-y-1.5">
                          <div className="flex items-start justify-between">
                            <p className="text-sm font-medium text-[var(--text-heading)] flex-1"><MathText>{q.question}</MathText></p>
                            <span className={`text-xs font-bold ml-2 shrink-0 ${qPct >= 70 ? 'text-emerald-500' : qPct >= 50 ? 'text-amber-500' : 'text-red-500'}`}>
                              {q.score}/{q.maxScore}
                            </span>
                          </div>
                          <div className="text-xs text-[var(--text-muted)]">
                            <span className="font-medium">{t('mockExam.yourAnswer', 'Your answer:')}</span> <MathText>{q.studentAnswer || '—'}</MathText>
                          </div>
                          {q.correctAnswer && (
                            <div className="text-xs text-emerald-600">
                              <span className="font-medium">{t('mockExam.correctAnswer', 'Correct:')}</span> <MathText>{q.correctAnswer}</MathText>
                            </div>
                          )}
                          {q.feedback && (
                            <p className="text-xs text-[var(--text-muted)] italic">{q.feedback}</p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button onClick={onRetake} className="btn-primary flex-1 py-2.5 text-sm flex items-center justify-center gap-2">
          <RotateCcw className="w-4 h-4" /> {t('mockExam.takeAnother', 'Take Another')}
        </button>
        <Link to="/dashboard" className="btn-secondary flex-1 py-2.5 text-sm text-center">
          {t('queue.backToDashboard')}
        </Link>
      </div>
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────────

export default function MockExam() {
  const { t } = useTranslation()
  const { getToken } = useAuth()
  const { activeProfile } = useExamProfile()
  const profileId = activeProfile?.id
  const { subjects, topics, dailyLogs } = useKnowledgeGraph(profileId)

  const formats = useLiveQuery(
    () => profileId ? db.examFormats.where('examProfileId').equals(profileId).toArray() : Promise.resolve([] as ExamFormat[]),
    [profileId]
  ) ?? []

  // Past graded exams for history
  const pastExams = useLiveQuery(
    () => profileId
      ? db.mockExams.where('examProfileId').equals(profileId)
          .filter(e => e.status === 'graded' && e.totalScore != null)
          .reverse()
          .sortBy('startTime')
      : Promise.resolve([]),
    [profileId]
  ) ?? []

  const {
    messages, isLoading, currentToolCall, streamingText, error,
    sendMessage,
  } = useAgent({ profile: activeProfile, subjects, topics, dailyLogs })

  const [started, setStarted] = useState(false)
  const [timeLimit, setTimeLimit] = useState(60)
  const [timeLeft, setTimeLeft] = useState(0)
  const [, setExamId] = useState<string | null>(null)
  const [isFinished, setIsFinished] = useState(false)
  const [grading, setGrading] = useState(false)
  const [gradedExam, setGradedExam] = useState<MockExamType | null>(null)
  const [viewingExam, setViewingExam] = useState<MockExamType | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const examIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, streamingText])

  // Countdown timer
  useEffect(() => {
    if (!started || isFinished) return
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => (prev <= 1 ? 0 : prev - 1))
    }, 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [started, isFinished])

  // Auto-finish when time runs out (uses ref to avoid hoisting issue)
  const handleFinishRef = useRef<() => void>(() => {})
  useEffect(() => {
    if (started && !isFinished && timeLeft === 0 && examIdRef.current) {
      handleFinishRef.current()
    }
  }, [timeLeft, started, isFinished])

  if (!activeProfile) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <Clock className="w-12 h-12 text-[var(--accent-text)] mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-[var(--text-heading)] mb-4">{t('mockExam.title')}</h1>
        <p className="text-[var(--text-muted)]">{t('ai.createProfileFirst')}</p>
        <Link to="/exam-profile" className="btn-primary px-6 py-2.5 mt-4 inline-block">Create Profile</Link>
      </div>
    )
  }

  // ─── Grading logic ────────────────────────────────────────────

  const gradeExam = async (examId: string) => {
    setGrading(true)
    try {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')

      // Build transcript from messages
      const transcript = messages
        .filter(m => typeof m.content === 'string')
        .map(m => `${m.role === 'user' ? 'Student' : 'Examiner'}: ${m.content}`)
        .join('\n\n')

      const response = await streamChat({
        messages: [{
          role: 'user',
          content: `Grade this mock exam for "${activeProfile.name}". Here is the full exam conversation transcript:\n\n${transcript}\n\nReturn ONLY valid JSON with this exact structure:\n{\n  "totalScore": <number>,\n  "maxScore": <number>,\n  "overallFeedback": "<2-3 sentence summary>",\n  "strengths": ["<strength 1>", "<strength 2>"],\n  "areasForImprovement": ["<area 1>", "<area 2>"],\n  "sections": [\n    {\n      "name": "<section name>",\n      "score": <number>,\n      "maxScore": <number>,\n      "feedback": "<section feedback>",\n      "questions": [\n        {\n          "question": "<question text>",\n          "studentAnswer": "<what the student answered>",\n          "correctAnswer": "<the correct answer>",\n          "score": <number>,\n          "maxScore": <number>,\n          "feedback": "<brief feedback>"\n        }\n      ]\n    }\n  ]\n}\n\nIf there are no clear sections, create one section called "General". Grade fairly and constructively.`,
        }],
        system: 'You are an expert exam grader. Analyze the exam transcript, identify all questions and student answers, grade each one, and return structured JSON. Be fair, specific, and constructive. Never use emojis. If the student did not answer a question, give 0 points. Return only valid JSON.',
        tools: [],
        maxTokens: 4096,
        authToken: token,
      })

      const text = response.content
        .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
        .map(c => c.text)
        .join('')

      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('Could not parse grading response')

      const parsed = JSON.parse(jsonMatch[0]) as GradingResult

      const totalScore = parsed.totalScore ?? parsed.sections?.reduce((s, sec) => s + sec.score, 0) ?? 0
      const maxScore = parsed.maxScore ?? parsed.sections?.reduce((s, sec) => s + sec.maxScore, 0) ?? 100

      await db.mockExams.update(examId, {
        status: 'graded',
        totalScore,
        maxScore,
        feedback: JSON.stringify(parsed),
      })

      const updated = await db.mockExams.get(examId)
      if (updated) setGradedExam(updated)
    } catch (err) {
      console.error('[MockExam] Grading failed:', err)
      // Still mark as completed so it's not stuck in-progress
    } finally {
      setGrading(false)
    }
  }

  const handleStart = async () => {
    setGradedExam(null)
    setViewingExam(null)
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
    setIsFinished(false)

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
      // Auto-grade
      gradeExam(currentExamId)
    }
  }
  handleFinishRef.current = handleFinish

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  // ─── Viewing past exam results ────────────────────────────────

  if (viewingExam) {
    return (
      <MockExamResults
        exam={viewingExam}
        onBack={() => setViewingExam(null)}
        onRetake={() => { setViewingExam(null); handleStart() }}
      />
    )
  }

  // ─── Graded exam results (just finished) ──────────────────────

  if (gradedExam) {
    return (
      <MockExamResults
        exam={gradedExam}
        onBack={() => { setGradedExam(null); setStarted(false); setIsFinished(false) }}
        onRetake={() => { setGradedExam(null); setStarted(false); setIsFinished(false); setTimeout(handleStart, 100) }}
      />
    )
  }

  // ─── Setup screen ─────────────────────────────────────────────

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

        {/* Past Exams */}
        {pastExams.length > 0 && (
          <div className="mt-6">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3">{t('mockExam.pastExams', 'Past Exams')}</h2>
            <div className="space-y-2">
              {pastExams.map(exam => {
                const pct = exam.maxScore && exam.maxScore > 0 ? Math.round((exam.totalScore! / exam.maxScore) * 100) : 0
                const passed = pct >= 60
                return (
                  <button
                    key={exam.id}
                    onClick={() => setViewingExam(exam)}
                    className="w-full glass-card p-3 flex items-center gap-3 text-left hover:bg-[var(--bg-input)]/30 transition-colors"
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                      passed ? 'bg-emerald-500/10' : 'bg-red-500/10'
                    }`}>
                      <span className={`text-sm font-bold ${passed ? 'text-emerald-600' : 'text-red-600'}`}>{pct}%</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--text-heading)]">
                        {new Date(exam.startTime).toLocaleDateString()} · {exam.timeLimitMinutes}min
                      </p>
                      <p className="text-xs text-[var(--text-muted)]">
                        {exam.totalScore}/{exam.maxScore} {t('practiceExam.points', 'points')}
                      </p>
                    </div>
                    <span className="text-xs text-[var(--accent-text)]">{t('mockExam.viewResults', 'View Results')}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>
    )
  }

  // ─── Active exam ──────────────────────────────────────────────

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
            {!isFinished && !grading && (
              <button onClick={handleFinish} className="btn-secondary text-xs px-3 py-1 flex items-center gap-1">
                <CheckCircle className="w-3 h-3" /> {t('mockExam.submit')}
              </button>
            )}
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg) => (
            <ChatMessageBubble key={msg.id} message={msg} />
          ))}
          {streamingText && (
            <ChatMessageBubble message={{ id: 'streaming', role: 'assistant', content: streamingText }} />
          )}
          <ToolCallIndicator toolName={currentToolCall} />
          {error && (
            <div className="text-sm text-red-500 bg-red-500/10 rounded-lg p-3">{error}</div>
          )}

          {/* Grading indicator */}
          {grading && (
            <div className="flex items-center justify-center gap-2 py-6 animate-fade-in">
              <Loader2 className="w-5 h-5 text-[var(--accent-text)] animate-spin" />
              <span className="text-sm font-medium text-[var(--text-heading)]">{t('mockExam.grading')}</span>
            </div>
          )}
        </div>

        {!grading && (
          <ChatInput
            onSend={(msg) => sendMessage(msg)}
            disabled={isLoading || grading}
            placeholder={isFinished ? t('mockExam.reviewPlaceholder') : t('mockExam.answerPlaceholder')}
          />
        )}
      </div>
    </div>
  )
}
