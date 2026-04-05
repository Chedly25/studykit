/**
 * Topic-scoped exercise practice within the study session.
 * Shows exercises filtered to the current topic with inline AI grading.
 */
import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ListChecks, Star, Check, Clock, Send, Bot, RotateCcw, Loader2, ArrowRight, Upload, Lightbulb } from 'lucide-react'
import { useAuth } from '@clerk/clerk-react'
import { streamChat } from '../../ai/client'
import { useExerciseBank } from '../../hooks/useExerciseBank'
import { useExerciseAI } from '../../hooks/useExerciseAI'

function DifficultyStars({ level }: { level: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} className={`w-3 h-3 ${i <= level ? 'fill-amber-400 text-amber-400' : 'text-[var(--border-card)]'}`} />
      ))}
    </div>
  )
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 70 ? 'bg-green-500/15 text-green-600' : score >= 40 ? 'bg-amber-500/15 text-amber-600' : 'bg-red-500/15 text-red-600'
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold ${color}`}>
      {score}/100
    </span>
  )
}

interface Props {
  examProfileId: string
  topicId: string
  topicName: string
}

export function ExerciseDrill({ examProfileId, topicId, topicName }: Props) {
  const { t } = useTranslation()
  const { exercises } = useExerciseBank(examProfileId)
  const exerciseAI = useExerciseAI(examProfileId)

  const { getToken } = useAuth()
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [userAnswer, setUserAnswer] = useState('')
  // Block 5A: Progressive hints
  const [hints, setHints] = useState<string[]>([])
  const [hintLoading, setHintLoading] = useState(false)

  const topicExercises = useMemo(() => {
    return exercises
      .filter(ex => {
        try {
          const ids: string[] = JSON.parse(ex.topicIds)
          return ids.includes(topicId)
        } catch { return false }
      })
      .sort((a, b) => a.difficulty - b.difficulty)
  }, [exercises, topicId])

  const currentExercise = topicExercises[selectedIndex]
  const completed = topicExercises.filter(e => e.status === 'completed').length

  const handleCheck = () => {
    if (!currentExercise || !userAnswer.trim()) return
    exerciseAI.checkAnswer(currentExercise, userAnswer, [topicName])
  }

  const handleNext = () => {
    setUserAnswer('')
    exerciseAI.reset()
    setSelectedIndex(prev => Math.min(prev + 1, topicExercises.length - 1))
  }

  const handleSelectExercise = (index: number) => {
    setSelectedIndex(index)
    setUserAnswer('')
    exerciseAI.reset()
    setHints([])
  }

  // Block 5A: Get progressive hint
  const handleHint = async () => {
    if (!currentExercise || hintLoading || hints.length >= 3) return
    setHintLoading(true)
    try {
      const token = await getToken()
      if (!token) return

      const hintNumber = hints.length + 1
      const priorHintsText = hints.length > 0 ? `Prior hints:\n${hints.map((h, i) => `${i + 1}. ${h}`).join('\n')}` : ''

      let hintText = ''
      await streamChat({
        messages: [{
          id: crypto.randomUUID(),
          role: 'user',
          content: `Give a progressive hint #${hintNumber} for this exercise without revealing the answer. Be concise (2-3 sentences). ${priorHintsText}\n\nExercise: ${currentExercise.text}`,
        }],
        system: 'You are a study assistant giving progressive hints. Each hint should be more specific than the last but never reveal the full answer. Never use emojis.',
        tools: [],
        maxTokens: 768,
        authToken: token,
        onToken: (t) => { hintText += t },
      })

      setHints(prev => [...prev, hintText.trim()])
    } catch {
      // Silently fail
    } finally {
      setHintLoading(false)
    }
  }

  if (topicExercises.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center max-w-sm">
          <ListChecks className="w-10 h-10 text-[var(--text-muted)] mx-auto mb-3" />
          <p className="text-sm text-[var(--text-muted)] mb-4">
            {t('exercises.noExercisesForTopic')}
          </p>
          <Link
            to="/sources"
            className="btn-primary px-4 py-2 text-sm inline-flex items-center gap-2"
          >
            <Upload className="w-4 h-4" /> Upload exams
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Progress bar */}
      <div className="px-4 py-2 border-b border-[var(--border-card)] flex items-center gap-3">
        <span className="text-xs font-medium text-[var(--text-muted)]">
          {completed}/{topicExercises.length} completed
        </span>
        <div className="flex-1 h-1.5 rounded-full bg-[var(--bg-input)] overflow-hidden">
          <div
            className="h-full rounded-full bg-[var(--accent-text)] transition-all"
            style={{ width: `${topicExercises.length > 0 ? (completed / topicExercises.length) * 100 : 0}%` }}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {/* Exercise selector pills */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {topicExercises.map((ex, i) => (
            <button
              key={ex.id}
              onClick={() => handleSelectExercise(i)}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
                i === selectedIndex
                  ? 'bg-[var(--accent-text)] text-white'
                  : ex.status === 'completed'
                    ? 'bg-green-500/10 text-green-600'
                    : ex.status === 'attempted'
                      ? 'bg-amber-500/10 text-amber-600'
                      : 'bg-[var(--bg-input)] text-[var(--text-muted)] hover:text-[var(--text-body)]'
              }`}
            >
              Ex.{ex.exerciseNumber}
              {ex.status === 'completed' && <Check className="w-3 h-3" />}
              {ex.status === 'attempted' && <Clock className="w-3 h-3" />}
            </button>
          ))}
        </div>

        {currentExercise && (
          <div className="glass-card p-5">
            {/* Exercise header */}
            <div className="flex items-center gap-2 mb-4">
              <span className="text-sm font-bold text-[var(--accent-text)]">
                Exercise {currentExercise.exerciseNumber}
              </span>
              <DifficultyStars level={currentExercise.difficulty} />
            </div>

            {/* Exercise text */}
            <div className="prose prose-sm max-w-none mb-4 text-[var(--text-body)]">
              <p className="whitespace-pre-wrap">{currentExercise.text}</p>
            </div>

            {/* Answer area */}
            <div className="border-t border-[var(--border-card)] pt-4">
              <textarea
                value={userAnswer}
                onChange={e => setUserAnswer(e.target.value)}
                placeholder={t('exercises.answerPlaceholder')}
                className="w-full bg-[var(--bg-input)] border border-[var(--border-card)] rounded-lg px-3 py-2 text-sm text-[var(--text-body)] placeholder:text-[var(--text-muted)]/50 min-h-[100px] focus:outline-none focus:ring-1 focus:ring-[var(--accent-text)]"
                disabled={exerciseAI.isStreaming}
              />

              {!exerciseAI.feedback && !exerciseAI.isStreaming && (
                <div className="flex items-center gap-2 mt-3">
                  <button
                    onClick={handleCheck}
                    disabled={!userAnswer.trim()}
                    className="btn-primary px-4 py-2 text-sm flex items-center gap-2 disabled:opacity-40"
                  >
                    <Send className="w-4 h-4" /> Check with AI
                  </button>
                  {hints.length < 3 ? (
                    <button
                      onClick={handleHint}
                      disabled={hintLoading}
                      className="px-3 py-2 text-sm flex items-center gap-1.5 rounded-lg border border-[var(--border-card)] text-[var(--text-muted)] hover:text-[var(--accent-text)] hover:border-[var(--accent-text)] transition-colors disabled:opacity-50"
                    >
                      {hintLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lightbulb className="w-3.5 h-3.5" />}
                      Hint ({3 - hints.length} left)
                    </button>
                  ) : (
                    <span className="text-xs text-[var(--text-muted)]">All hints used. Check with AI for the full solution.</span>
                  )}
                </div>
              )}

              {/* Progressive hints */}
              {hints.length > 0 && (
                <div className="mt-3 space-y-2">
                  {hints.map((hint, i) => (
                    <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg bg-[var(--color-warning-bg)] border border-[var(--color-warning-border)]">
                      <Lightbulb className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                      <p className="text-xs text-[var(--text-body)]">{hint}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* AI Feedback */}
            {(exerciseAI.isStreaming || exerciseAI.feedback) && (
              <div className="mt-4 border-t border-[var(--border-card)] pt-4">
                <div className="flex items-center gap-2 mb-3">
                  <Bot className="w-4 h-4 text-[var(--accent-text)]" />
                  <span className="text-xs font-semibold text-[var(--text-muted)] uppercase">AI Feedback</span>
                  {exerciseAI.isStreaming && <Loader2 className="w-3 h-3 text-[var(--accent-text)] animate-spin" />}
                </div>

                {exerciseAI.score !== null && (
                  <div className="flex items-center gap-3 mb-3">
                    <ScoreBadge score={exerciseAI.score} />
                    {exerciseAI.errorType && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--bg-input)] text-[var(--text-muted)]">
                        {exerciseAI.errorType} error
                      </span>
                    )}
                  </div>
                )}

                <div className="prose prose-sm max-w-none text-[var(--text-body)]">
                  <p className="whitespace-pre-wrap">{exerciseAI.feedback}</p>
                </div>

                {!exerciseAI.isStreaming && (
                  <div className="flex items-center gap-3 mt-3">
                    <button
                      onClick={() => { setUserAnswer(''); exerciseAI.reset() }}
                      className="px-3 py-1.5 text-xs flex items-center gap-1.5 rounded-lg border border-[var(--border-card)] text-[var(--text-muted)] hover:text-[var(--text-body)] hover:bg-[var(--bg-input)] transition-colors"
                    >
                      <RotateCcw className="w-3 h-3" /> Try again
                    </button>
                    {selectedIndex < topicExercises.length - 1 && (
                      <button
                        onClick={handleNext}
                        className="px-3 py-1.5 text-xs flex items-center gap-1.5 rounded-lg btn-primary"
                      >
                        Next exercise <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Error */}
            {exerciseAI.error && (
              <div className="mt-3 text-sm text-red-500 bg-red-500/10 rounded-lg p-3">
                {exerciseAI.error}
              </div>
            )}

            {/* Solution */}
            {currentExercise.solutionText && (
              <details className="mt-4 border-t border-[var(--border-card)] pt-4">
                <summary className="text-xs font-medium text-[var(--text-muted)] cursor-pointer hover:text-[var(--text-body)]">
                  Show solution
                </summary>
                <div className="mt-2 prose prose-sm max-w-none text-[var(--text-body)]">
                  <p className="whitespace-pre-wrap">{currentExercise.solutionText}</p>
                </div>
              </details>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
