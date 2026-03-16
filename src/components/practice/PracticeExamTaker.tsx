import { useTranslation } from 'react-i18next'
import { Send } from 'lucide-react'
import type { GeneratedQuestion } from '../../db/schema'
import { QuestionRenderer } from './QuestionRenderer'
import { QuestionNav } from './QuestionNav'
import { ExamTimer } from './ExamTimer'

interface PracticeExamTakerProps {
  questions: GeneratedQuestion[]
  currentIndex: number
  answers: Map<string, string>
  timeRemaining: number | null
  onAnswer: (questionId: string, answer: string) => void
  onNavigate: (index: number) => void
  onSubmit: () => void
}

export function PracticeExamTaker({
  questions,
  currentIndex,
  answers,
  timeRemaining,
  onAnswer,
  onNavigate,
  onSubmit,
}: PracticeExamTakerProps) {
  const { t } = useTranslation()
  const currentQuestion = questions[currentIndex]
  if (!currentQuestion) return null

  const answeredIds = new Set(
    questions.filter(q => answers.has(q.id) || q.isAnswered).map(q => q.id),
  )
  const answeredCount = answeredIds.size

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
            {timeRemaining !== null && <ExamTimer timeRemaining={timeRemaining} />}
            <button
              onClick={onSubmit}
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
    </div>
  )
}
