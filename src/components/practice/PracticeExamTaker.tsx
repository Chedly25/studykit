import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Send, Loader2 } from 'lucide-react'
import type { GeneratedQuestion } from '../../db/schema'
import { QuestionRenderer } from './QuestionRenderer'
import { QuestionNav } from './QuestionNav'
import { ExamTimer } from './ExamTimer'

interface PracticeExamTakerProps {
  questions: GeneratedQuestion[]
  currentIndex: number
  answers: Map<string, string>
  timeRemaining: number | null
  targetDifficulty?: number
  onAnswer: (questionId: string, answer: string) => void
  onNavigate: (index: number) => void
  onSubmit: () => void
}

export function PracticeExamTaker({
  questions,
  currentIndex,
  answers,
  timeRemaining,
  targetDifficulty,
  onAnswer,
  onNavigate,
  onSubmit,
}: PracticeExamTakerProps) {
  const { t } = useTranslation()
  const [showConfirm, setShowConfirm] = useState(false)

  // Loading state while live query resolves
  if (questions.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-center animate-fade-in">
        <div className="glass-card p-8">
          <Loader2 className="w-8 h-8 text-[var(--accent-text)] animate-spin mx-auto mb-4" />
          <p className="text-sm text-[var(--text-muted)]">{t('common.loading')}</p>
        </div>
      </div>
    )
  }

  const currentQuestion = questions[currentIndex]
  if (!currentQuestion) return null

  const answeredIds = new Set(
    questions.filter(q => answers.has(q.id) || q.isAnswered).map(q => q.id),
  )
  const answeredCount = answeredIds.size
  const unansweredCount = questions.length - answeredCount

  const handleSubmit = () => {
    if (unansweredCount > 0) {
      setShowConfirm(true)
    } else {
      onSubmit()
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-4 animate-fade-in flex flex-col" style={{ height: 'calc(100vh - 8rem)' }}>
      <div className="glass-card flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-[var(--border-card)] flex items-center justify-between">
          <div className="text-sm text-[var(--text-body)]">
            {t('practiceExam.questionOf', { current: currentIndex + 1, total: questions.length })}
            <span className="text-[var(--text-muted)] ml-2">
              ({answeredCount}/{questions.length} {t('practiceExam.answered')})
            </span>
          </div>

          <div className="flex items-center gap-3">
            {targetDifficulty !== undefined && (
              <span className="text-xs text-[var(--text-muted)] bg-[var(--bg-input)] px-2 py-1 rounded">
                {t('practiceExam.difficulty')}: {targetDifficulty}/5
              </span>
            )}
            {timeRemaining !== null && <ExamTimer timeRemaining={timeRemaining} />}
            <button
              onClick={handleSubmit}
              className="btn-primary px-4 py-1.5 text-sm flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              {t('practiceExam.submitExam')}
            </button>
          </div>
        </div>

        {/* Question body */}
        <div className="flex-1 overflow-y-auto p-6">
          <QuestionRenderer
            question={currentQuestion}
            answer={answers.get(currentQuestion.id) ?? currentQuestion.userAnswer}
            onAnswer={(answer) => onAnswer(currentQuestion.id, answer)}
          />
        </div>

        {/* Navigation footer */}
        <div className="px-4 py-3 border-t border-[var(--border-card)] flex justify-center">
          <QuestionNav
            currentIndex={currentIndex}
            totalQuestions={questions.length}
            answeredIds={answeredIds}
            questionIds={questions.map(q => q.id)}
            onNavigate={onNavigate}
          />
        </div>
      </div>

      {/* Submit confirmation dialog */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="glass-card p-6 max-w-sm mx-4 space-y-4">
            <h3 className="text-lg font-semibold text-[var(--text-heading)]">
              {t('practiceExam.confirmSubmit')}
            </h3>
            <p className="text-sm text-[var(--text-muted)]">
              {t('practiceExam.unansweredWarning', { count: unansweredCount })}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="btn-secondary flex-1 py-2 text-sm"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={() => { setShowConfirm(false); onSubmit() }}
                className="btn-primary flex-1 py-2 text-sm"
              >
                {t('practiceExam.submitAnyway')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
