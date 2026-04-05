/**
 * Type B Document Exam Taker.
 *
 * Renders a CPGE-style continuous mathematical document with KaTeX rendering
 * and answer textareas inserted between questions. Includes a question sidebar,
 * global timer, auto-save, and submit flow.
 */
import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Clock, AlertTriangle, Save, Check } from 'lucide-react'
import { parseExamDocument, getAnsweredQuestions } from '../../lib/examDocumentParser'
import { DocumentMarkdown } from './document/DocumentMarkdown'
import { DocumentAnswerArea } from './document/DocumentAnswerArea'
import type { DocumentGradingResult, DocumentModelAnswer } from './document/DocumentAnswerArea'
import { DocumentQuestionSidebar } from './document/DocumentQuestionSidebar'
import { useDocumentAutoSave } from '../../hooks/useDocumentAutoSave'

interface DocumentExamTakerProps {
  sessionId: string
  documentContent: string
  timeLimitSeconds?: number
  readOnly?: boolean
  savedAnswers?: Record<number, string>
  gradingResults?: Record<number, DocumentGradingResult>
  modelAnswers?: DocumentModelAnswer[]
  onSubmit: () => void
  onAnswerChange?: (questionNumber: number, answer: string) => void
}

export function DocumentExamTaker({
  sessionId,
  documentContent,
  timeLimitSeconds,
  readOnly = false,
  savedAnswers,
  gradingResults,
  modelAnswers,
  onSubmit,
  onAnswerChange,
}: DocumentExamTakerProps) {
  const { t } = useTranslation()
  const [answers, setAnswers] = useState<Record<number, string>>(savedAnswers ?? {})
  const [activeQuestion, setActiveQuestion] = useState<number | null>(null)
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState(timeLimitSeconds ?? 0)
  const questionRefs = useRef<Map<number, HTMLDivElement>>(new Map())
  const observerRef = useRef<IntersectionObserver | null>(null)

  // Parse document
  const parsed = useMemo(() => parseExamDocument(documentContent), [documentContent])

  // Auto-save
  const { isSaving, lastSaved } = useDocumentAutoSave(readOnly ? undefined : sessionId, answers)

  // Timer
  useEffect(() => {
    if (!timeLimitSeconds || readOnly) return
    const interval = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          clearInterval(interval)
          onSubmit()
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [timeLimitSeconds, readOnly, onSubmit])

  // IntersectionObserver for sidebar highlighting
  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect()

    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const qNum = Number(entry.target.getAttribute('data-question'))
            if (!isNaN(qNum)) setActiveQuestion(qNum)
          }
        }
      },
      { rootMargin: '-20% 0px -60% 0px', threshold: 0 },
    )

    for (const [, el] of questionRefs.current) {
      observerRef.current.observe(el)
    }

    return () => observerRef.current?.disconnect()
  }, [parsed.segments])

  const handleAnswer = useCallback((questionNumber: number, value: string) => {
    setAnswers(prev => ({ ...prev, [questionNumber]: value }))
    onAnswerChange?.(questionNumber, value)
  }, [onAnswerChange])

  const handleNavigate = useCallback((questionNumber: number) => {
    const el = questionRefs.current.get(questionNumber)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [])

  const handleSubmit = useCallback(() => {
    onSubmit()
  }, [onSubmit])

  const answeredSet = useMemo(() => getAnsweredQuestions(answers), [answers])
  const unansweredCount = parsed.questionCount - answeredSet.size

  const gradingMap = useMemo(() => {
    if (!gradingResults) return undefined
    const m = new Map<number, DocumentGradingResult>()
    for (const [k, v] of Object.entries(gradingResults)) {
      m.set(Number(k), v)
    }
    return m
  }, [gradingResults])

  const modelAnswerMap = useMemo(() => {
    if (!modelAnswers) return undefined
    const m = new Map<number, DocumentModelAnswer>()
    for (const ma of modelAnswers) {
      m.set(ma.questionNumber, ma)
    }
    return m
  }, [modelAnswers])

  // Timer display
  const timerMinutes = Math.floor(timeRemaining / 60)
  const timerSeconds = timeRemaining % 60
  const isTimeLow = timeRemaining > 0 && timeRemaining < 300

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* Sticky header with timer + save status */}
      {!readOnly && (
        <div className="sticky top-0 z-30 bg-[var(--bg-body)]/95 backdrop-blur-sm border-b border-[var(--border-card)] -mx-4 px-4 py-2 mb-6 flex items-center justify-between">
          {timeLimitSeconds ? (
            <div className={`flex items-center gap-1.5 text-sm font-mono font-medium ${
              isTimeLow ? 'text-red-500 animate-pulse' : 'text-[var(--text-body)]'
            }`}>
              <Clock className="w-4 h-4" />
              <span>{String(timerMinutes).padStart(2, '0')}:{String(timerSeconds).padStart(2, '0')}</span>
            </div>
          ) : (
            <div />
          )}
          <div className="flex items-center gap-3">
            <span className="text-xs text-[var(--text-faint)] flex items-center gap-1">
              {isSaving ? (
                <><Save className="w-3 h-3 animate-pulse" /> {t('documentExam.saving')}</>
              ) : lastSaved ? (
                <><Check className="w-3 h-3 text-green-500" /> {t('documentExam.saved')}</>
              ) : null}
            </span>
            <span className="text-xs text-[var(--text-muted)]">
              {answeredSet.size}/{parsed.questionCount} {t('documentExam.answered')}
            </span>
          </div>
        </div>
      )}

      <div className="flex gap-6">
        {/* Sidebar */}
        <DocumentQuestionSidebar
          questionCount={parsed.questionCount}
          answeredQuestions={answeredSet}
          activeQuestion={activeQuestion}
          onNavigate={handleNavigate}
          gradingResults={gradingMap}
        />

        {/* Main document area */}
        <div className="flex-1 min-w-0">
          {parsed.segments.map((segment, i) => {
            if (segment.type === 'prose') {
              return (
                <div key={`prose-${i}`} className="mb-6">
                  <DocumentMarkdown content={segment.content} />
                </div>
              )
            }

            // Question segment
            const qNum = segment.questionNumber!
            return (
              <div
                key={`q-${qNum}`}
                ref={(el) => { if (el) questionRefs.current.set(qNum, el) }}
                data-question={qNum}
                className="mb-2"
              >
                <DocumentMarkdown content={segment.content} />
                <DocumentAnswerArea
                  questionNumber={qNum}
                  value={answers[qNum] ?? ''}
                  onChange={(val) => handleAnswer(qNum, val)}
                  readOnly={readOnly}
                  grading={gradingResults?.[qNum]}
                  modelAnswer={modelAnswerMap?.get(qNum)}
                />
              </div>
            )
          })}

          {/* Submit button */}
          {!readOnly && (
            <div className="flex justify-center pt-8 pb-16">
              <button
                onClick={() => setShowSubmitConfirm(true)}
                className="btn-primary px-8 py-3 text-sm font-medium"
              >
                {t('documentExam.submitExam')}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Submit confirmation dialog */}
      {showSubmitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="glass-card p-5 max-w-sm w-full mx-4 space-y-3">
            <div className="flex items-center gap-2 text-amber-500">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="font-semibold text-[var(--text-heading)]">
                {t('practiceExam.confirmSubmit')}
              </h3>
            </div>
            {unansweredCount > 0 && (
              <p className="text-sm text-[var(--text-body)]">
                {t('documentExam.unansweredWarning', '{{count}} question(s) have no answer.', { count: unansweredCount })}
              </p>
            )}
            <div className="flex gap-2">
              <button onClick={handleSubmit} className="flex-1 btn-primary py-2 text-sm">
                {t('documentExam.submitExam')}
              </button>
              <button onClick={() => setShowSubmitConfirm(false)} className="btn-secondary py-2 text-sm px-4">
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
