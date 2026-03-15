import { useState } from 'react'
import { CheckCircle, XCircle, Clock } from 'lucide-react'

export interface Question {
  id: string
  question: string
  options?: string[]
  correctAnswer: string
  explanation: string
  difficulty: number
  topicName: string
}

interface Props {
  question: Question
  onAnswer: (answer: string, isCorrect: boolean) => void
  showTimer?: boolean
}

export function QuestionCard({ question, onAnswer, showTimer }: Props) {
  const [selected, setSelected] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [textAnswer, setTextAnswer] = useState('')
  const [timeLeft] = useState(90)

  const isMultipleChoice = question.options && question.options.length > 0
  const isCorrect = submitted && (
    isMultipleChoice
      ? selected === question.correctAnswer
      : textAnswer.trim().toLowerCase() === question.correctAnswer.toLowerCase()
  )

  const handleSubmit = () => {
    if (submitted) return
    const answer = isMultipleChoice ? (selected ?? '') : textAnswer.trim()
    const correct = isMultipleChoice
      ? answer === question.correctAnswer
      : answer.toLowerCase() === question.correctAnswer.toLowerCase()
    setSubmitted(true)
    onAnswer(answer, correct)
  }

  return (
    <div className="glass-card p-5">
      {showTimer && !submitted && (
        <div className="flex items-center gap-1 text-xs text-[var(--text-muted)] mb-3">
          <Clock className="w-3 h-3" />
          <span>{timeLeft}s</span>
        </div>
      )}

      <div className="text-xs text-[var(--accent-text)] mb-2 uppercase tracking-wide">
        {question.topicName} &middot; Difficulty {question.difficulty}/5
      </div>

      <p className="text-[var(--text-heading)] font-medium mb-4">{question.question}</p>

      {/* Multiple choice */}
      {isMultipleChoice && question.options && (
        <div className="space-y-2 mb-4">
          {question.options.map((opt, i) => {
            const letter = String.fromCharCode(65 + i)
            const isSelected = selected === opt
            const isCorrectOption = submitted && opt === question.correctAnswer
            const isWrongSelected = submitted && isSelected && !isCorrectOption

            return (
              <button
                key={i}
                onClick={() => !submitted && setSelected(opt)}
                disabled={submitted}
                className={`w-full text-left px-4 py-2.5 rounded-lg border text-sm transition-all ${
                  isCorrectOption
                    ? 'border-green-500 bg-green-500/10 text-green-700 dark:text-green-400'
                    : isWrongSelected
                    ? 'border-red-500 bg-red-500/10 text-red-700 dark:text-red-400'
                    : isSelected
                    ? 'border-[var(--accent-text)] bg-[var(--accent-bg)] text-[var(--accent-text)]'
                    : 'border-[var(--border-card)] text-[var(--text-body)] hover:border-[var(--text-muted)]'
                }`}
              >
                <span className="font-medium mr-2">{letter}.</span>
                {opt}
                {isCorrectOption && <CheckCircle className="inline w-4 h-4 ml-2" />}
                {isWrongSelected && <XCircle className="inline w-4 h-4 ml-2" />}
              </button>
            )
          })}
        </div>
      )}

      {/* Text answer */}
      {!isMultipleChoice && !submitted && (
        <textarea
          value={textAnswer}
          onChange={e => setTextAnswer(e.target.value)}
          placeholder="Type your answer..."
          rows={3}
          className="input-field w-full mb-4"
        />
      )}

      {/* Submit button */}
      {!submitted && (
        <button
          onClick={handleSubmit}
          disabled={isMultipleChoice ? !selected : !textAnswer.trim()}
          className="btn-primary px-6 py-2 w-full disabled:opacity-40"
        >
          Submit Answer
        </button>
      )}

      {/* Explanation */}
      {submitted && (
        <div className={`mt-4 p-3 rounded-lg ${isCorrect ? 'bg-green-500/10 border border-green-500/20' : 'bg-red-500/10 border border-red-500/20'}`}>
          <div className="flex items-center gap-2 mb-2">
            {isCorrect ? (
              <><CheckCircle className="w-4 h-4 text-green-500" /> <span className="font-medium text-green-700 dark:text-green-400">Correct!</span></>
            ) : (
              <><XCircle className="w-4 h-4 text-red-500" /> <span className="font-medium text-red-700 dark:text-red-400">Incorrect</span></>
            )}
          </div>
          {!isCorrect && (
            <p className="text-sm text-[var(--text-body)] mb-2">
              <strong>Correct answer:</strong> {question.correctAnswer}
            </p>
          )}
          <p className="text-sm text-[var(--text-muted)]">{question.explanation}</p>
        </div>
      )}
    </div>
  )
}
