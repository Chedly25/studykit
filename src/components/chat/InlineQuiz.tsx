import { useState, useEffect } from 'react'
import { CheckCircle, XCircle, Trophy } from 'lucide-react'
import { getTransient } from '../../lib/transientStore'
import { MathText } from '../MathText'

interface QuizQuestion {
  question: string
  options: string[]
  correctIndex: number
  explanation: string
}

interface InlineQuizProps {
  quizId: string
}

export function InlineQuiz({ quizId }: InlineQuizProps) {
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedOption, setSelectedOption] = useState<number | null>(null)
  const [answered, setAnswered] = useState(false)
  const [score, setScore] = useState(0)
  const [completed, setCompleted] = useState(false)

  useEffect(() => {
    const data = getTransient<QuizQuestion[]>(quizId)
    if (data) setQuestions(data)
  }, [quizId])

  if (questions.length === 0) {
    return (
      <div className="my-3 glass-card p-4 animate-pulse">
        <div className="h-4 bg-[var(--bg-input)] rounded w-2/3 mb-3" />
        <div className="h-8 bg-[var(--bg-input)] rounded mb-2" />
        <div className="h-8 bg-[var(--bg-input)] rounded" />
      </div>
    )
  }

  if (completed) {
    const pct = Math.round((score / questions.length) * 100)
    return (
      <div className="my-3 glass-card overflow-hidden">
        <div className="h-1 bg-[var(--accent-text)]" />
        <div className="p-4 text-center">
          <Trophy className={`w-8 h-8 mx-auto mb-2 ${pct >= 80 ? 'text-yellow-500' : pct >= 50 ? 'text-[var(--accent-text)]' : 'text-[var(--text-muted)]'}`} />
          <p className="text-sm font-semibold text-[var(--text-heading)]">
            {score}/{questions.length} correct ({pct}%)
          </p>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            {pct >= 80 ? 'Great job!' : pct >= 50 ? 'Good effort, keep practicing.' : 'Let\'s review the concepts.'}
          </p>
        </div>
      </div>
    )
  }

  const q = questions[currentIndex]
  const isCorrect = selectedOption === q.correctIndex

  const handleSelect = (optionIndex: number) => {
    if (answered) return
    setSelectedOption(optionIndex)
    setAnswered(true)
    if (optionIndex === q.correctIndex) {
      setScore(s => s + 1)
    }
  }

  const handleNext = () => {
    if (currentIndex + 1 >= questions.length) {
      setCompleted(true)
    } else {
      setCurrentIndex(i => i + 1)
      setSelectedOption(null)
      setAnswered(false)
    }
  }

  return (
    <div className="my-3 glass-card overflow-hidden">
      <div className="h-1 bg-[var(--accent-text)]" />
      <div className="p-4">
        {/* Progress */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wider">
            Question {currentIndex + 1} of {questions.length}
          </span>
          <div className="flex gap-0.5">
            {questions.map((_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full ${
                  i < currentIndex ? 'bg-[var(--accent-text)]'
                  : i === currentIndex ? 'bg-[var(--accent-text)]/50'
                  : 'bg-[var(--bg-input)]'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Question */}
        <p className="text-sm font-medium text-[var(--text-heading)] mb-3"><MathText>{q.question}</MathText></p>

        {/* Options */}
        <div className="space-y-2">
          {q.options.map((option, i) => {
            let optionClass = 'bg-[var(--bg-input)] text-[var(--text-body)] hover:bg-[var(--accent-bg)] hover:text-[var(--accent-text)] border-transparent'
            if (answered) {
              if (i === q.correctIndex) {
                optionClass = 'bg-green-500/10 text-green-600 border-green-500/30'
              } else if (i === selectedOption && !isCorrect) {
                optionClass = 'bg-red-500/10 text-red-500 border-red-500/30'
              } else {
                optionClass = 'bg-[var(--bg-input)] text-[var(--text-muted)] border-transparent opacity-50'
              }
            }

            return (
              <button
                key={i}
                onClick={() => handleSelect(i)}
                disabled={answered}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm border transition-colors flex items-center gap-2 ${optionClass}`}
              >
                <span className="w-5 h-5 rounded-full border border-current/30 flex items-center justify-center text-[10px] flex-shrink-0">
                  {answered && i === q.correctIndex ? <CheckCircle className="w-4 h-4 text-green-500" /> :
                   answered && i === selectedOption && !isCorrect ? <XCircle className="w-4 h-4 text-red-500" /> :
                   String.fromCharCode(65 + i)}
                </span>
                <MathText>{option}</MathText>
              </button>
            )
          })}
        </div>

        {/* Explanation + Next */}
        {answered && (
          <div className="mt-3">
            <div className={`rounded-lg px-3 py-2 text-xs ${isCorrect ? 'bg-green-500/10 text-green-700' : 'bg-amber-500/10 text-amber-700'}`}>
              <MathText>{q.explanation}</MathText>
            </div>
            <button
              onClick={handleNext}
              className="mt-2 px-4 py-1.5 rounded-lg text-xs font-medium bg-[var(--accent-text)] text-white hover:opacity-90 transition-opacity"
            >
              {currentIndex + 1 >= questions.length ? 'See results' : 'Next question'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
