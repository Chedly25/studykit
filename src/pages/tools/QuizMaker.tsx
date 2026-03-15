import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, ArrowLeft, CheckCircle2, XCircle, Play, ListChecks } from 'lucide-react'
import { ToolSEO } from '../../components/SEO'
import { FormToolPage } from '../../components/FormToolPage'
import { getToolBySlug } from '../../lib/tools'

const tool = getToolBySlug('quiz-maker')!

const STORAGE_KEY = 'studykit-quizzes'

interface Question {
  id: string
  question: string
  options: string[]
  correctIndex: number
}

interface Quiz {
  id: string
  title: string
  questions: Question[]
}

type Mode = 'list' | 'create' | 'take'

interface QuizAnswers {
  [questionId: string]: number
}

function generateId(): string {
  return crypto.randomUUID()
}

function loadQuizzes(): Quiz[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved) as Quiz[]
      if (Array.isArray(parsed)) return parsed
    }
  } catch {
    // ignore
  }
  return []
}

function saveQuizzes(quizzes: Quiz[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(quizzes))
}

function emptyQuestion(): Question {
  return {
    id: generateId(),
    question: '',
    options: ['', '', '', ''],
    correctIndex: 0,
  }
}

export default function QuizMaker() {
  const [quizzes, setQuizzes] = useState<Quiz[]>(loadQuizzes)
  const [mode, setMode] = useState<Mode>('list')

  // Create state
  const [createTitle, setCreateTitle] = useState('')
  const [createQuestions, setCreateQuestions] = useState<Question[]>([emptyQuestion()])

  // Take state
  const [activeQuizId, setActiveQuizId] = useState<string | null>(null)
  const [answers, setAnswers] = useState<QuizAnswers>({})
  const [submitted, setSubmitted] = useState(false)
  const [showAllAtOnce, setShowAllAtOnce] = useState(true)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)

  useEffect(() => {
    saveQuizzes(quizzes)
  }, [quizzes])

  const activeQuiz = activeQuizId ? quizzes.find(q => q.id === activeQuizId) : null

  // Create mode handlers
  const updateQuestion = useCallback((qIndex: number, field: 'question', value: string) => {
    setCreateQuestions(prev =>
      prev.map((q, i) => (i === qIndex ? { ...q, [field]: value } : q))
    )
  }, [])

  const updateOption = useCallback((qIndex: number, optIndex: number, value: string) => {
    setCreateQuestions(prev =>
      prev.map((q, i) =>
        i === qIndex
          ? { ...q, options: q.options.map((o, j) => (j === optIndex ? value : o)) }
          : q
      )
    )
  }, [])

  const setCorrectAnswer = useCallback((qIndex: number, optIndex: number) => {
    setCreateQuestions(prev =>
      prev.map((q, i) => (i === qIndex ? { ...q, correctIndex: optIndex } : q))
    )
  }, [])

  const addQuestion = useCallback(() => {
    setCreateQuestions(prev => [...prev, emptyQuestion()])
  }, [])

  const removeQuestion = useCallback((qIndex: number) => {
    setCreateQuestions(prev => prev.filter((_, i) => i !== qIndex))
  }, [])

  const saveQuiz = useCallback(() => {
    const title = createTitle.trim()
    if (!title) return
    const validQuestions = createQuestions.filter(
      q => q.question.trim() && q.options.every(o => o.trim())
    )
    if (validQuestions.length === 0) return

    const quiz: Quiz = { id: generateId(), title, questions: validQuestions }
    setQuizzes(prev => [...prev, quiz])
    setCreateTitle('')
    setCreateQuestions([emptyQuestion()])
    setMode('list')
  }, [createTitle, createQuestions])

  const deleteQuiz = useCallback((quizId: string) => {
    setQuizzes(prev => prev.filter(q => q.id !== quizId))
  }, [])

  // Take mode handlers
  const startQuiz = useCallback((quizId: string) => {
    setActiveQuizId(quizId)
    setAnswers({})
    setSubmitted(false)
    setCurrentQuestionIndex(0)
    setMode('take')
  }, [])

  const selectAnswer = useCallback((questionId: string, optIndex: number) => {
    if (submitted) return
    setAnswers(prev => ({ ...prev, [questionId]: optIndex }))
  }, [submitted])

  const submitQuiz = useCallback(() => {
    setSubmitted(true)
  }, [])

  const backToList = useCallback(() => {
    setMode('list')
    setActiveQuizId(null)
  }, [])

  // Score calculation
  const score = activeQuiz
    ? activeQuiz.questions.reduce(
        (acc, q) => acc + (answers[q.id] === q.correctIndex ? 1 : 0),
        0
      )
    : 0
  const totalQuestions = activeQuiz?.questions.length ?? 0
  const percentage = totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0

  return (
    <>
      <ToolSEO title={tool.seoTitle} description={tool.seoDescription} slug={tool.slug} keywords={tool.keywords} />
      <FormToolPage toolId={tool.id} title={tool.name} description={tool.description}>

        {/* List mode */}
        {mode === 'list' && (
          <div className="space-y-6">
            <div className="flex justify-end">
              <button
                onClick={() => setMode('create')}
                className="btn-primary flex items-center gap-2"
              >
                <Plus size={16} />
                Create Quiz
              </button>
            </div>

            {quizzes.length === 0 ? (
              <div className="glass-card p-8 text-center">
                <ListChecks size={40} className="mx-auto text-surface-500 mb-3" />
                <p className="text-surface-400">No quizzes yet. Create one to get started.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {quizzes.map(quiz => (
                  <div key={quiz.id} className="glass-card p-4 flex items-center justify-between">
                    <div>
                      <h3 className="font-[family-name:var(--font-display)] font-semibold text-surface-100">
                        {quiz.title}
                      </h3>
                      <p className="text-surface-400 text-sm">
                        {quiz.questions.length} question{quiz.questions.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => startQuiz(quiz.id)}
                        className="btn-primary text-sm px-3 py-1.5 flex items-center gap-1.5"
                      >
                        <Play size={14} />
                        Take
                      </button>
                      <button
                        onClick={() => deleteQuiz(quiz.id)}
                        className="p-2 text-surface-500 hover:text-red-400 transition-colors"
                        aria-label="Delete quiz"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Create mode */}
        {mode === 'create' && (
          <div className="space-y-6">
            <button onClick={backToList} className="btn-secondary flex items-center gap-2 text-sm">
              <ArrowLeft size={16} />
              Back to Quizzes
            </button>

            <div className="glass-card p-4">
              <label className="text-surface-300 text-sm font-medium block mb-1">Quiz Title</label>
              <input
                type="text"
                placeholder="Enter quiz title..."
                value={createTitle}
                onChange={e => setCreateTitle(e.target.value)}
                className="input-field w-full"
              />
            </div>

            {createQuestions.map((q, qIndex) => (
              <div key={q.id} className="glass-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-surface-400 text-xs font-medium uppercase tracking-wider">
                    Question {qIndex + 1}
                  </span>
                  <button
                    onClick={() => removeQuestion(qIndex)}
                    disabled={createQuestions.length <= 1}
                    className="p-1.5 text-surface-500 hover:text-red-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    aria-label="Remove question"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                <input
                  type="text"
                  placeholder="Enter your question..."
                  value={q.question}
                  onChange={e => updateQuestion(qIndex, 'question', e.target.value)}
                  className="input-field w-full"
                />

                <div className="space-y-2">
                  {q.options.map((opt, optIndex) => (
                    <div key={optIndex} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name={`correct-${q.id}`}
                        checked={q.correctIndex === optIndex}
                        onChange={() => setCorrectAnswer(qIndex, optIndex)}
                        className="accent-primary-400 w-4 h-4 shrink-0"
                      />
                      <input
                        type="text"
                        placeholder={`Option ${optIndex + 1}`}
                        value={opt}
                        onChange={e => updateOption(qIndex, optIndex, e.target.value)}
                        className="input-field flex-1"
                      />
                    </div>
                  ))}
                  <p className="text-surface-500 text-xs">Select the radio button next to the correct answer.</p>
                </div>
              </div>
            ))}

            <div className="flex items-center gap-3">
              <button onClick={addQuestion} className="btn-secondary flex items-center gap-2 text-sm">
                <Plus size={14} />
                Add Question
              </button>
              <button onClick={saveQuiz} className="btn-primary flex items-center gap-2">
                Save Quiz
              </button>
            </div>
          </div>
        )}

        {/* Take mode */}
        {mode === 'take' && activeQuiz && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <button onClick={backToList} className="btn-secondary flex items-center gap-2 text-sm">
                <ArrowLeft size={16} />
                Back
              </button>
              <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-surface-100">
                {activeQuiz.title}
              </h2>
              {!submitted && (
                <button
                  onClick={() => setShowAllAtOnce(prev => !prev)}
                  className="btn-secondary text-sm px-3 py-1.5"
                >
                  {showAllAtOnce ? 'One at a Time' : 'Show All'}
                </button>
              )}
              {submitted && <div />}
            </div>

            {/* Score display (after submit) */}
            {submitted && (
              <div className="glass-card p-6 text-center">
                <p className="text-surface-400 text-sm mb-1">Your Score</p>
                <p className="font-[family-name:var(--font-display)] text-4xl font-bold text-primary-400">
                  {score}/{totalQuestions}
                </p>
                <p className="text-surface-300 text-lg mt-1">{percentage}%</p>
              </div>
            )}

            {/* Questions */}
            {showAllAtOnce || submitted ? (
              <div className="space-y-4">
                {activeQuiz.questions.map((q, qIndex) => (
                  <QuestionCard
                    key={q.id}
                    question={q}
                    index={qIndex}
                    selectedAnswer={answers[q.id]}
                    submitted={submitted}
                    onSelect={(optIndex) => selectAnswer(q.id, optIndex)}
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-surface-400 text-sm text-center">
                  Question {currentQuestionIndex + 1} of {activeQuiz.questions.length}
                </p>
                <QuestionCard
                  question={activeQuiz.questions[currentQuestionIndex]}
                  index={currentQuestionIndex}
                  selectedAnswer={answers[activeQuiz.questions[currentQuestionIndex].id]}
                  submitted={false}
                  onSelect={(optIndex) =>
                    selectAnswer(activeQuiz.questions[currentQuestionIndex].id, optIndex)
                  }
                />
                <div className="flex justify-between">
                  <button
                    onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
                    disabled={currentQuestionIndex === 0}
                    className="btn-secondary text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() =>
                      setCurrentQuestionIndex(prev =>
                        Math.min(activeQuiz.questions.length - 1, prev + 1)
                      )
                    }
                    disabled={currentQuestionIndex >= activeQuiz.questions.length - 1}
                    className="btn-secondary text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}

            {/* Submit button */}
            {!submitted && (
              <div className="flex justify-center">
                <button
                  onClick={submitQuiz}
                  disabled={Object.keys(answers).length < activeQuiz.questions.length}
                  className="btn-primary px-8 py-3 text-lg disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Submit Quiz
                </button>
              </div>
            )}
          </div>
        )}

      </FormToolPage>
    </>
  )
}

interface QuestionCardProps {
  question: Question
  index: number
  selectedAnswer: number | undefined
  submitted: boolean
  onSelect: (optIndex: number) => void
}

function QuestionCard({ question, index, selectedAnswer, submitted, onSelect }: QuestionCardProps) {
  return (
    <div className="glass-card p-4 space-y-3">
      <p className="text-surface-100 font-medium">
        <span className="text-primary-400 mr-2">{index + 1}.</span>
        {question.question}
      </p>
      <div className="space-y-2">
        {question.options.map((opt, optIndex) => {
          const isSelected = selectedAnswer === optIndex
          const isCorrect = question.correctIndex === optIndex

          let optionClasses = 'p-3 rounded-lg border cursor-pointer transition-colors flex items-center gap-3'
          if (submitted) {
            if (isCorrect) {
              optionClasses += ' border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
            } else if (isSelected && !isCorrect) {
              optionClasses += ' border-red-500/30 bg-red-500/10 text-red-300'
            } else {
              optionClasses += ' border-primary-500/10 bg-surface-900/30 text-surface-400'
            }
          } else {
            if (isSelected) {
              optionClasses += ' border-primary-400/40 bg-primary-500/10 text-surface-100'
            } else {
              optionClasses += ' border-primary-500/10 bg-surface-900/30 text-surface-300 hover:border-primary-400/20 hover:bg-surface-800/50'
            }
          }

          return (
            <button
              key={optIndex}
              onClick={() => onSelect(optIndex)}
              disabled={submitted}
              className={optionClasses}
            >
              {submitted && isCorrect && <CheckCircle2 size={16} className="shrink-0 text-emerald-400" />}
              {submitted && isSelected && !isCorrect && <XCircle size={16} className="shrink-0 text-red-400" />}
              {!submitted && (
                <div
                  className={`w-4 h-4 rounded-full border-2 shrink-0 ${
                    isSelected ? 'border-primary-400 bg-primary-400' : 'border-surface-500'
                  }`}
                />
              )}
              <span className="text-sm">{opt}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
