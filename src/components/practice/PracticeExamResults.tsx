import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Trophy, BarChart3, RotateCcw, ChevronDown, ChevronUp, RefreshCw, ShieldAlert, Clock, MessageCircle } from 'lucide-react'
import type { GeneratedQuestion, PracticeExamSession } from '../../db/schema'
import { QuestionRenderer } from './QuestionRenderer'
import type { WorkflowProgress } from '../../ai/orchestrator/types'
import { Loader2 } from 'lucide-react'

interface PracticeExamResultsProps {
  session: PracticeExamSession | undefined
  questions: GeneratedQuestion[]
  isGrading: boolean
  gradingProgress: WorkflowProgress | null
  onRetake: () => void
  onExplainDifferently?: (question: GeneratedQuestion) => void
}

export function PracticeExamResults({
  session,
  questions,
  isGrading,
  gradingProgress,
  onRetake,
  onExplainDifferently,
}: PracticeExamResultsProps) {
  const { t } = useTranslation()
  const [expandedQuestion, setExpandedQuestion] = useState<number | null>(null)

  // Show grading progress
  if (isGrading) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12 animate-fade-in text-center">
        <div className="glass-card p-8">
          <Loader2 className="w-12 h-12 text-[var(--accent-text)] animate-spin mx-auto mb-4" />
          <h2 className="text-xl font-bold text-[var(--text-heading)] mb-2">
            {t('practiceExam.gradingExam')}
          </h2>
          {gradingProgress && (
            <p className="text-sm text-[var(--text-muted)]">{gradingProgress.currentStepName}</p>
          )}
        </div>
      </div>
    )
  }

  if (!session) return null

  const totalScore = session.totalScore ?? 0
  const maxScore = session.maxScore ?? 1
  const percentage = Math.round((totalScore / maxScore) * 100)
  const passed = percentage >= 60

  // Parse overall feedback
  let overallFeedback = ''
  let topicBreakdown: Array<{ topic: string; score: number; maxScore: number; advice: string }> = []
  if (session.overallFeedback) {
    try {
      const parsed = JSON.parse(session.overallFeedback)
      overallFeedback = parsed.overallFeedback ?? ''
      topicBreakdown = parsed.topicBreakdown ?? []
    } catch { /* ignore */ }
  }

  // Parse proctor flags
  let proctorFlags: { tabSwitches?: number; fullscreenExits?: number } | null = null
  if (session.proctorFlags) {
    try {
      proctorFlags = JSON.parse(session.proctorFlags)
    } catch { /* ignore */ }
  }
  const hasProctorAlerts = proctorFlags && ((proctorFlags.tabSwitches ?? 0) > 0 || (proctorFlags.fullscreenExits ?? 0) > 0)

  // Compute per-question timing stats
  const questionTimings = questions.filter(q => q.timeSpentSeconds != null && q.timeSpentSeconds > 0)
  const hasTimingData = questionTimings.length > 0
  let avgTime = 0, fastestTime = 0, slowestTime = 0, fastestQ = '', slowestQ = ''
  if (hasTimingData) {
    const times = questionTimings.map(q => q.timeSpentSeconds!)
    avgTime = Math.round(times.reduce((a, b) => a + b, 0) / times.length)
    fastestTime = Math.min(...times)
    slowestTime = Math.max(...times)
    fastestQ = `Q${(questionTimings.find(q => q.timeSpentSeconds === fastestTime)?.questionIndex ?? 0) + 1}`
    slowestQ = `Q${(questionTimings.find(q => q.timeSpentSeconds === slowestTime)?.questionIndex ?? 0) + 1}`
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 animate-fade-in space-y-6">
      {/* Score card */}
      <div className="glass-card p-8 text-center">
        <Trophy className={`w-16 h-16 mx-auto mb-4 ${passed ? 'text-yellow-500' : 'text-[var(--text-muted)]'}`} />
        <div className={`text-5xl font-bold mb-2 ${passed ? 'text-green-500' : 'text-red-500'}`}>
          {percentage}%
        </div>
        <div className="text-lg text-[var(--text-body)] mb-1">
          {totalScore}/{maxScore} {t('practiceExam.points')}
        </div>
        <div className={`text-sm font-medium ${passed ? 'text-green-500' : 'text-red-500'}`}>
          {passed ? t('practiceExam.passed') : t('practiceExam.needsWork')}
        </div>
        {overallFeedback && (
          <p className="mt-4 text-sm text-[var(--text-muted)] max-w-md mx-auto">{overallFeedback}</p>
        )}
      </div>

      {/* Topic breakdown */}
      {topicBreakdown.length > 0 && (
        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold text-[var(--text-heading)] mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            {t('practiceExam.topicBreakdown')}
          </h3>
          <div className="space-y-3">
            {topicBreakdown.map((tb, i) => {
              const pct = tb.maxScore > 0 ? Math.round((tb.score / tb.maxScore) * 100) : 0
              return (
                <div key={i}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-[var(--text-body)] font-medium">{tb.topic}</span>
                    <span className="text-[var(--text-muted)]">{tb.score}/{tb.maxScore}</span>
                  </div>
                  <div className="w-full h-2 bg-[var(--bg-input)] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${pct >= 60 ? 'bg-green-500' : 'bg-red-500'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  {tb.advice && (
                    <p className="text-xs text-[var(--text-muted)] mt-1">{tb.advice}</p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Proctor integrity alert */}
      {hasProctorAlerts && (
        <div className="glass-card p-6 border border-red-500/30 bg-red-500/5">
          <h3 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-3 flex items-center gap-2">
            <ShieldAlert className="w-5 h-5" />
            {t('practiceExam.integrityAlert')}
          </h3>
          <div className="flex gap-6 text-sm">
            {(proctorFlags?.tabSwitches ?? 0) > 0 && (
              <div className="text-[var(--text-body)]">
                <span className="font-medium text-red-600 dark:text-red-400">{proctorFlags!.tabSwitches}</span>{' '}
                {t('practiceExam.tabSwitches')}
              </div>
            )}
            {(proctorFlags?.fullscreenExits ?? 0) > 0 && (
              <div className="text-[var(--text-body)]">
                <span className="font-medium text-red-600 dark:text-red-400">{proctorFlags!.fullscreenExits}</span>{' '}
                {t('practiceExam.fullscreenExits')}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Per-question timing stats */}
      {hasTimingData && (
        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold text-[var(--text-heading)] mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5" />
            {t('practiceExam.timingStats')}
          </h3>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-[var(--accent-text)]">{avgTime}s</div>
              <div className="text-xs text-[var(--text-muted)]">{t('practiceExam.avgTime')}</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-500">{fastestTime}s</div>
              <div className="text-xs text-[var(--text-muted)]">{t('practiceExam.fastest')} ({fastestQ})</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-amber-500">{slowestTime}s</div>
              <div className="text-xs text-[var(--text-muted)]">{t('practiceExam.slowest')} ({slowestQ})</div>
            </div>
          </div>
        </div>
      )}

      {/* Question-by-question review */}
      <div className="glass-card p-6">
        <h3 className="text-lg font-semibold text-[var(--text-heading)] mb-4">
          {t('practiceExam.questionReview')}
        </h3>
        <div className="space-y-2">
          {questions.map((q, i) => {
            const isExpanded = expandedQuestion === i
            return (
              <div key={q.id} className="border border-[var(--border-card)] rounded-lg overflow-hidden">
                <button
                  onClick={() => setExpandedQuestion(isExpanded ? null : i)}
                  className="w-full flex items-center justify-between px-4 py-3 text-sm text-left hover:bg-[var(--bg-input)] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className={`w-6 h-6 rounded-full text-xs flex items-center justify-center font-medium ${
                      q.isCorrect
                        ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                        : q.isAnswered
                        ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                        : 'bg-[var(--bg-input)] text-[var(--text-muted)]'
                    }`}>
                      {i + 1}
                    </span>
                    <span className="text-[var(--text-body)] truncate max-w-md">
                      {q.text.slice(0, 80)}{q.text.length > 80 ? '...' : ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[var(--text-muted)]">
                      {q.earnedPoints ?? 0}/{q.points}
                    </span>
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </button>
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-[var(--border-card)]">
                    <div className="pt-4">
                      <QuestionRenderer
                        question={q}
                        answer={q.userAnswer}
                        readOnly
                        onAnswer={() => {}}
                      />
                      {!q.isCorrect && onExplainDifferently && (
                        <button
                          onClick={() => onExplainDifferently(q)}
                          className="mt-3 flex items-center gap-1.5 text-xs text-[var(--accent-text)] hover:underline"
                        >
                          <RefreshCw className="w-3 h-3" />
                          {t('practiceExam.explainDifferently')}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-center gap-3 flex-wrap">
        <button onClick={onRetake} className="btn-primary px-6 py-2.5 flex items-center gap-2">
          <RotateCcw className="w-4 h-4" />
          {t('practiceExam.retake')}
        </button>
        <button
          onClick={() => {
            const weakAreas = topicBreakdown
              .filter(tb => tb.maxScore > 0 && (tb.score / tb.maxScore) < 0.6)
              .map(tb => tb.topic)
              .join(', ')
            window.dispatchEvent(new CustomEvent('open-chat-panel', {
              detail: {
                context: {
                  score: `${percentage}%`,
                  weakTopics: weakAreas || 'none identified',
                  topicName: session?.examName ?? '',
                },
              },
            }))
          }}
          className="btn-secondary px-6 py-2.5 flex items-center gap-2"
        >
          <MessageCircle className="w-4 h-4" />
          {t('practiceExam.discussResults', 'Discuss with AI')}
        </button>
        <a href="/dashboard" className="btn-secondary px-6 py-2.5">
          {t('dashboard.title')}
        </a>
      </div>
    </div>
  )
}
