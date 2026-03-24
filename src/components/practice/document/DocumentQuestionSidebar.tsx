/**
 * Sticky sidebar (desktop) or floating button (mobile) showing question pills
 * for navigating a continuous document exam.
 *
 * Uses IntersectionObserver to highlight the currently visible question.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { List, X, CheckCircle, XCircle } from 'lucide-react'
import type { DocumentGradingResult } from './DocumentAnswerArea'

interface DocumentQuestionSidebarProps {
  questionCount: number
  answeredQuestions: Set<number>
  activeQuestion: number | null
  onNavigate: (questionNumber: number) => void
  gradingResults?: Map<number, DocumentGradingResult>
}

export function DocumentQuestionSidebar({
  questionCount,
  answeredQuestions,
  activeQuestion,
  onNavigate,
  gradingResults,
}: DocumentQuestionSidebarProps) {
  const { t } = useTranslation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const hasGrading = gradingResults && gradingResults.size > 0

  const pills = Array.from({ length: questionCount }, (_, i) => {
    const num = i + 1
    const isCurrent = num === activeQuestion
    const isAnswered = answeredQuestions.has(num)
    const grading = gradingResults?.get(num)
    const isCorrect = grading ? grading.earned > 0 : undefined

    return (
      <button
        key={num}
        onClick={() => { onNavigate(num); setMobileOpen(false) }}
        className={`w-8 h-8 rounded-full text-xs font-medium transition-all flex items-center justify-center ${
          isCurrent
            ? 'bg-[var(--accent-text)] text-white scale-110 shadow-md'
            : hasGrading && isCorrect === true
            ? 'bg-green-500/20 text-green-600 border border-green-500/40'
            : hasGrading && isCorrect === false
            ? 'bg-red-500/20 text-red-500 border border-red-500/40'
            : isAnswered
            ? 'bg-[var(--accent-bg)] text-[var(--accent-text)] border border-[var(--accent-text)]'
            : 'border border-[var(--border-card)] text-[var(--text-muted)] hover:border-[var(--text-muted)]'
        }`}
        title={`Question ${num}`}
      >
        {hasGrading && isCorrect === true ? <CheckCircle className="w-3.5 h-3.5" /> :
         hasGrading && isCorrect === false ? <XCircle className="w-3.5 h-3.5" /> :
         num}
      </button>
    )
  })

  // Progress summary
  const answeredCount = answeredQuestions.size
  const progress = questionCount > 0 ? Math.round((answeredCount / questionCount) * 100) : 0

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden lg:flex flex-col gap-3 sticky top-20 w-14 shrink-0">
        <div className="text-[10px] text-[var(--text-faint)] text-center font-medium">
          {t('documentExam.sidebar', 'Questions')}
        </div>
        <div className="flex flex-col items-center gap-1.5">
          {pills}
        </div>
        <div className="text-[10px] text-[var(--text-faint)] text-center">
          {answeredCount}/{questionCount}
        </div>
        {/* Progress bar */}
        <div className="w-8 h-1.5 bg-[var(--bg-input)] rounded-full mx-auto overflow-hidden">
          <div
            className="h-full bg-[var(--accent-text)] rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Mobile floating button */}
      <div className="lg:hidden fixed bottom-20 right-4 z-40">
        <button
          onClick={() => setMobileOpen(true)}
          className="w-12 h-12 rounded-full bg-[var(--accent-text)] text-white shadow-lg flex items-center justify-center"
        >
          <List className="w-5 h-5" />
        </button>
        {answeredCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[var(--accent-bg)] text-[var(--accent-text)] text-[10px] font-bold flex items-center justify-center border border-[var(--accent-text)]">
            {answeredCount}
          </span>
        )}
      </div>

      {/* Mobile bottom sheet */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <div className="absolute bottom-0 inset-x-0 bg-[var(--bg-card)] rounded-t-2xl p-5 space-y-3 animate-slide-up">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-[var(--text-heading)]">
                {t('documentExam.sidebar', 'Questions')} ({answeredCount}/{questionCount})
              </span>
              <button onClick={() => setMobileOpen(false)} className="p-1 rounded-lg hover:bg-[var(--bg-input)]">
                <X className="w-5 h-5 text-[var(--text-muted)]" />
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5 justify-center">
              {pills}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
