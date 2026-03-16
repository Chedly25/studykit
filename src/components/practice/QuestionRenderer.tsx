import type { GeneratedQuestion } from '../../db/schema'
import { MCQQuestion } from './questions/MCQQuestion'
import { TrueFalseQuestion } from './questions/TrueFalseQuestion'
import { ShortAnswerQuestion } from './questions/ShortAnswerQuestion'
import { EssayQuestion } from './questions/EssayQuestion'
import { MessageCircle, CheckCircle, XCircle } from 'lucide-react'

interface QuestionRendererProps {
  question: GeneratedQuestion
  answer?: string
  readOnly?: boolean
  onAnswer: (answer: string) => void
}

export function QuestionRenderer({ question, answer, readOnly, onAnswer }: QuestionRendererProps) {
  const showFeedback = readOnly && question.feedback
  let options: string[] = []
  try {
    if (question.options) options = JSON.parse(question.options)
  } catch { /* malformed options */ }

  return (
    <div className="space-y-4">
      {/* Scenario text for vignette */}
      {question.scenarioText && (
        <div className="p-4 rounded-lg bg-[var(--bg-input)] border border-[var(--border-card)] text-sm text-[var(--text-body)] italic">
          {question.scenarioText}
        </div>
      )}

      {/* Question text */}
      <div className="text-base text-[var(--text-heading)] font-medium leading-relaxed">
        {question.text}
      </div>

      {/* Metadata */}
      <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
        <span className="px-2 py-0.5 rounded-full bg-[var(--bg-input)] border border-[var(--border-card)]">
          {question.topicName}
        </span>
        <span>Difficulty: {'*'.repeat(question.difficulty)}{'*'.repeat(0)}</span>
        <span>{question.points} pt{question.points > 1 ? 's' : ''}</span>
      </div>

      {/* Format-specific input */}
      <div className="mt-4">
        {question.format === 'multiple-choice' && (
          <MCQQuestion
            options={options}
            selectedAnswer={answer}
            correctAnswer={readOnly ? question.correctAnswer : undefined}
            correctOptionIndex={readOnly ? question.correctOptionIndex : undefined}
            readOnly={readOnly}
            onSelect={onAnswer}
          />
        )}

        {question.format === 'true-false' && (
          <TrueFalseQuestion
            selectedAnswer={answer}
            correctAnswer={readOnly ? question.correctAnswer : undefined}
            readOnly={readOnly}
            onSelect={onAnswer}
          />
        )}

        {question.format === 'short-answer' && (
          <ShortAnswerQuestion
            value={answer}
            correctAnswer={readOnly ? question.correctAnswer : undefined}
            isCorrect={readOnly ? question.isCorrect : undefined}
            readOnly={readOnly}
            onChange={onAnswer}
          />
        )}

        {(question.format === 'essay' || question.format === 'vignette') && (
          <EssayQuestion
            value={answer}
            readOnly={readOnly}
            onChange={onAnswer}
          />
        )}
      </div>

      {/* Feedback section (results mode) */}
      {showFeedback && (
        <div className={`flex items-start gap-3 p-4 rounded-lg border ${
          question.isCorrect
            ? 'border-green-500/30 bg-green-500/5'
            : 'border-red-500/30 bg-red-500/5'
        }`}>
          {question.isCorrect
            ? <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
            : <XCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
          }
          <div className="space-y-2 text-sm">
            <p className="text-[var(--text-body)]">{question.feedback}</p>
            {question.explanation && (
              <div className="flex items-start gap-2 text-[var(--text-muted)]">
                <MessageCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <p>{question.explanation}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
