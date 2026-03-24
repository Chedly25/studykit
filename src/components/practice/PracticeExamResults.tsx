import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Trophy, BarChart3, RotateCcw, ChevronDown, ChevronUp, RefreshCw, ShieldAlert, Clock, MessageCircle } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { GeneratedQuestion, PracticeExamSession } from '../../db/schema'
import { QuestionRenderer } from './QuestionRenderer'
import type { WorkflowProgress } from '../../ai/orchestrator/types'
import { Loader2 } from 'lucide-react'
import { db } from '../../db'

interface PracticeExamResultsProps {
  session: PracticeExamSession | undefined
  questions: GeneratedQuestion[]
  isGrading: boolean
  gradingProgress: WorkflowProgress | null
  onRetake: () => void
  onExplainDifferently?: (question: GeneratedQuestion) => void
  examProfileId?: string
}

export function PracticeExamResults({
  session,
  questions,
  isGrading,
  gradingProgress,
  onRetake,
  onExplainDifferently,
  examProfileId,
}: PracticeExamResultsProps) {
  const { t } = useTranslation()
  const [expandedQuestion, setExpandedQuestion] = useState<number | null>(null)

  // Build topic name → ID map for linking
  const knownTopics = useLiveQuery(
    () => examProfileId ? db.topics.where('examProfileId').equals(examProfileId).toArray() : [],
    [examProfileId]
  ) ?? []

  const topicNameMap = useMemo(() =>
    new Map(knownTopics.map(tp => [tp.name.toLowerCase(), tp.id])),
    [knownTopics]
  )

  const findTopicId = (name: string): string | undefined => {
    if (!name) return undefined
    const exact = topicNameMap.get(name.toLowerCase())
    if (exact) return exact
    for (const [tName, tId] of topicNameMap) {
      if (name.toLowerCase().includes(tName) || tName.includes(name.toLowerCase())) return tId
    }
    return undefined
  }

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
  let sectionBreakdown: Array<{ sectionIndex: number; name: string; earned: number; max: number; percentage: number }> = []
  if (session.overallFeedback) {
    try {
      const parsed = JSON.parse(session.overallFeedback)
      overallFeedback = parsed.overallFeedback ?? ''
      topicBreakdown = parsed.topicBreakdown ?? []
      sectionBreakdown = parsed.sectionBreakdown ?? []
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

      {/* Topic breakdown — sorted worst-performing first */}
      {topicBreakdown.length > 0 && (
        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold text-[var(--text-heading)] mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            {t('practiceExam.topicBreakdown')}
          </h3>
          <div className="space-y-3">
            {[...topicBreakdown]
              .sort((a, b) => {
                const aPct = a.maxScore > 0 ? a.score / a.maxScore : 0
                const bPct = b.maxScore > 0 ? b.score / b.maxScore : 0
                return aPct - bPct
              })
              .map((tb, i) => {
              const pct = tb.maxScore > 0 ? Math.round((tb.score / tb.maxScore) * 100) : 0
              const topicId = findTopicId(tb.topic)
              return (
                <div key={i}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      {topicId ? (
                        <Link to={`/topic/${topicId}`} className="text-[var(--text-body)] font-medium hover:text-[var(--accent-text)] transition-colors truncate">
                          {tb.topic}
                        </Link>
                      ) : (
                        <span className="text-[var(--text-body)] font-medium truncate">{tb.topic}</span>
                      )}
                      {pct < 60 && topicId && (
                        <Link
                          to={`/practice-exam?topic=${topicId}`}
                          className="text-[10px] font-semibold text-[var(--accent-text)] bg-[var(--accent-bg)] px-1.5 py-0.5 rounded hover:underline shrink-0"
                        >
                          {t('practiceExam.practiceThis', 'Practice')}
                        </Link>
                      )}
                    </div>
                    <span className="text-[var(--text-muted)] shrink-0 ml-2">{tb.score}/{tb.maxScore}</span>
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

      {/* Section breakdown (simulation exams) */}
      {sectionBreakdown.length > 0 && (
        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold text-[var(--text-heading)] mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            {t('practiceExam.sectionBreakdown', 'Section Breakdown')}
          </h3>
          <div className="space-y-3">
            {sectionBreakdown.map((sec, i) => {
              const pct = sec.max > 0 ? Math.round((sec.earned / sec.max) * 100) : 0
              return (
                <div key={i}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-[var(--text-body)] font-medium">{sec.name}</span>
                    <span className="text-[var(--text-muted)]">{sec.earned}/{sec.max} ({pct}%)</span>
                  </div>
                  <div className="w-full h-2 bg-[var(--bg-input)] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${pct >= 60 ? 'bg-green-500' : 'bg-red-500'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
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
                      {q.markingScheme && (() => {
                        try {
                          const scheme = JSON.parse(q.markingScheme) as { criteria?: Array<{ criterion: string; points: number }>; commonErrors?: Array<{ error: string; deduction: number }> }
                          if (!scheme.criteria?.length) return null
                          return (
                            <div className="mt-3 p-3 rounded-lg bg-[var(--bg-input)] text-xs space-y-2">
                              <p className="font-medium text-[var(--text-muted)]">{t('practiceExam.markingCriteria', 'Marking Criteria')}</p>
                              {scheme.criteria.map((c, ci) => (
                                <div key={ci} className="flex justify-between text-[var(--text-body)]">
                                  <span>{c.criterion}</span>
                                  <span className="text-[var(--text-muted)] shrink-0 ml-2">{c.points} pts</span>
                                </div>
                              ))}
                              {scheme.commonErrors && scheme.commonErrors.length > 0 && (
                                <>
                                  <p className="font-medium text-red-500/80 pt-1">{t('practiceExam.commonErrors', 'Common Errors')}</p>
                                  {scheme.commonErrors.map((e, ei) => (
                                    <div key={ei} className="flex justify-between text-red-500/70">
                                      <span>{e.error}</span>
                                      <span className="shrink-0 ml-2">-{e.deduction} pts</span>
                                    </div>
                                  ))}
                                </>
                              )}
                            </div>
                          )
                        } catch { return null }
                      })()}
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
