import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, Link } from 'react-router-dom'
import { CheckCircle2, Flame, Clock, ArrowRight, Check, Home, BookOpen, ClipboardCheck, Target, Sparkles, Loader2, Star } from 'lucide-react'
import { motion } from 'motion/react'
import { MathText } from './MathText'

export interface SessionCompletionData {
  activityType: 'flashcards' | 'practice-exam' | 'focus'
  timeSpentSeconds: number
  streak: number
  weeklyHours: number
  weeklyTarget: number
  masteryDeltas?: Array<{ topicId?: string; topicName: string; before: number; after: number }>
  flashcardStats?: { cardsReviewed: number; deckName: string }
  examStats?: { score: number; maxScore: number; percentage: number; passed: boolean }
  focusStats?: { sessionsCompleted: number; subjectName?: string }
  nextRecommendation?: { topicName: string; action: string; reason: string; linkTo: string }
  // Extended fields for queue sessions
  questionsAnswered?: number
  questionsCorrect?: number
  feedbackSummary?: string
  // Tomorrow preview + roadmap context
  tomorrowDueCount?: number
  roadmapPhase?: string
}

interface Props {
  data: SessionCompletionData
  onDismiss: () => void
  onAction?: (linkTo: string) => void
  aiDebrief?: string
  isDebriefStreaming?: boolean
  isFirstSession?: boolean
}

const MILESTONES = [7, 14, 30, 60, 100]
const MILESTONE_KEYS: Record<number, string> = {
  7: 'session.milestone1Week',
  14: 'session.milestone2Weeks',
  30: 'session.milestone1Month',
  60: 'session.milestone2Months',
  100: 'session.milestone100Days',
}

const activityIcons = {
  flashcards: <BookOpen className="w-6 h-6" />,
  'practice-exam': <ClipboardCheck className="w-6 h-6" />,
  focus: <Target className="w-6 h-6" />,
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const mins = Math.round(seconds / 60)
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  const remainMins = mins % 60
  return remainMins > 0 ? `${hrs}h ${remainMins}m` : `${hrs}h`
}

export function SessionCompletionOverlay({ data, onDismiss, onAction, aiDebrief, isDebriefStreaming, isFirstSession }: Props) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const milestone = MILESTONES.includes(data.streak) ? data.streak : null

  // First session celebration confetti
  useEffect(() => {
    if (isFirstSession) {
      import('../lib/confetti').then(({ fireConfetti }) => fireConfetti('celebration')).catch(() => {})
    }
  }, [isFirstSession])

  const handleAction = (linkTo: string) => {
    if (onAction) {
      onAction(linkTo)
    } else {
      navigate(linkTo)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18 }}
      onClick={onDismiss}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="glass-card p-6 max-w-md w-full mx-4 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div role="dialog" aria-modal="true" aria-labelledby="session-complete-title">
        {/* Header */}
        <div className="text-center">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3 ${isFirstSession ? 'bg-[var(--color-warning-bg)]' : 'bg-[var(--color-success-bg)]'}`}>
            {isFirstSession
              ? <Star className="w-8 h-8 text-[var(--color-warning)]" />
              : <CheckCircle2 className="w-8 h-8 text-[var(--color-success)]" />
            }
          </div>
          <h2 id="session-complete-title" className="text-xl font-bold text-[var(--text-heading)]">
            {isFirstSession ? t('celebrate.firstSessionTitle') : t('session.greatWork')}
          </h2>
          {isFirstSession && (
            <p className="text-sm text-[var(--text-muted)] mt-1">{t('celebrate.firstSessionSubtitle')}</p>
          )}
        </div>

        {/* Stats row */}
        <div className="flex justify-center gap-6 text-center">
          <div>
            <div className="flex items-center justify-center gap-1 text-[var(--accent-text)]">
              <Clock className="w-4 h-4" />
              <span className="text-lg font-bold">{formatDuration(data.timeSpentSeconds)}</span>
            </div>
            <span className="text-xs text-[var(--text-muted)]">{t('session.statTime')}</span>
          </div>
          {data.flashcardStats && (
            <div>
              <div className="text-lg font-bold text-[var(--text-heading)]">{data.flashcardStats.cardsReviewed}</div>
              <span className="text-xs text-[var(--text-muted)]">{t('session.statCards')}</span>
            </div>
          )}
          {data.examStats && (
            <>
              <div>
                <div className={`text-lg font-bold ${data.examStats.passed ? 'text-[var(--color-success)]' : 'text-[var(--color-warning)]'}`}>
                  {data.examStats.percentage}%
                </div>
                <span className="text-xs text-[var(--text-muted)]">{t('session.statScore')}</span>
              </div>
              <div>
                <div className="text-lg font-bold text-[var(--text-heading)]">{data.examStats.score}/{data.examStats.maxScore}</div>
                <span className="text-xs text-[var(--text-muted)]">{t('session.statPoints')}</span>
              </div>
            </>
          )}
          {data.focusStats && (
            <div>
              <div className="text-lg font-bold text-[var(--text-heading)]">{data.focusStats.sessionsCompleted}</div>
              <span className="text-xs text-[var(--text-muted)]">{t('session.statSessions')}</span>
            </div>
          )}
        </div>

        {/* Queue session stats */}
        {data.questionsAnswered !== undefined && data.questionsAnswered > 0 && (
          <div className="flex justify-center gap-6 text-center">
            <div>
              <div className="text-lg font-bold text-[var(--text-heading)]">{data.questionsAnswered}</div>
              <span className="text-xs text-[var(--text-muted)]">{t('session.statQuestions')}</span>
            </div>
            {data.questionsCorrect !== undefined && (
              <div>
                <div className={`text-lg font-bold ${data.questionsCorrect / data.questionsAnswered >= 0.7 ? 'text-[var(--color-success)]' : 'text-[var(--color-warning)]'}`}>
                  {Math.round((data.questionsCorrect / data.questionsAnswered) * 100)}%
                </div>
                <span className="text-xs text-[var(--text-muted)]">{t('session.statAccuracy')}</span>
              </div>
            )}
          </div>
        )}

        {/* Feedback summary */}
        {data.feedbackSummary && (
          <div className="text-sm text-[var(--text-muted)] bg-[var(--bg-input)] p-3 rounded-lg">
            {data.feedbackSummary}
          </div>
        )}

        {/* Mastery deltas */}
        {data.masteryDeltas && data.masteryDeltas.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">{t('session.masteryChanges')}</h3>
            {data.masteryDeltas.map((delta, i) => {
              const change = delta.after - delta.before
              const isPositive = change >= 0
              return (
                <div key={i} className="flex items-center gap-2 text-sm">
                  {delta.topicId ? (
                    <Link to={`/topic/${delta.topicId}`} className="text-[var(--text-body)] truncate flex-1 hover:text-[var(--accent-text)] transition-colors">{delta.topicName}</Link>
                  ) : (
                    <span className="text-[var(--text-body)] truncate flex-1">{delta.topicName}</span>
                  )}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[var(--text-muted)]">{Math.round(delta.before * 100)}%</span>
                    <ArrowRight className="w-3 h-3 text-[var(--text-faint)]" />
                    <span className={isPositive ? 'text-[var(--color-success)] font-medium' : 'text-[var(--color-error)] font-medium'}>
                      {Math.round(delta.after * 100)}%
                    </span>
                    <span className={`text-xs ${isPositive ? 'text-[var(--color-success)]' : 'text-[var(--color-error)]'}`}>
                      ({isPositive ? '+' : ''}{Math.round(change * 100)})
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* AI Debrief */}
        {(aiDebrief || isDebriefStreaming) && (
          <div className="text-sm bg-[var(--bg-input)] p-3 rounded-lg">
            <div className="flex items-center gap-1.5 mb-2">
              <Sparkles className="w-3.5 h-3.5 text-[var(--accent-text)]" />
              <span className="text-xs font-medium text-[var(--text-muted)]">{t('session.coachNotes')}</span>
              {isDebriefStreaming && <Loader2 className="w-3 h-3 text-[var(--accent-text)] animate-spin" />}
            </div>
            {aiDebrief ? (
              <p className="text-[var(--text-body)] leading-relaxed"><MathText>{aiDebrief}</MathText></p>
            ) : (
              <p className="text-[var(--text-muted)]">{t('session.coachReviewing')}</p>
            )}
          </div>
        )}

        {/* Streak */}
        {data.streak > 0 && (
          <div className={`flex items-center justify-center gap-2 py-2 rounded-lg ${milestone ? 'bg-[var(--color-warning-bg)]' : 'bg-[var(--bg-input)]'}`}>
            <Flame className={`w-5 h-5 text-[var(--color-warning)] ${milestone ? 'animate-pulse' : ''}`} />
            <span className="font-bold text-[var(--text-heading)]">{t('session.dayStreak', { count: data.streak })}</span>
            {milestone && (
              <span className="text-xs font-bold text-[var(--color-warning)] bg-[var(--color-warning-bg)] px-2 py-0.5 rounded-full">
                {t(MILESTONE_KEYS[milestone])}
              </span>
            )}
          </div>
        )}

        {/* Next recommendation */}
        {data.nextRecommendation && (
          <button
            onClick={() => handleAction(data.nextRecommendation!.linkTo)}
            className="w-full glass-card glass-card-hover p-3 flex items-center gap-3 text-left"
          >
            <div className="w-8 h-8 rounded-lg bg-[var(--accent-bg)] flex items-center justify-center shrink-0">
              {activityIcons[data.activityType]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-[var(--text-heading)] truncate">
                {data.nextRecommendation.action}: {data.nextRecommendation.topicName}
              </div>
              <div className="text-xs text-[var(--text-muted)]">{data.nextRecommendation.reason}</div>
            </div>
            <ArrowRight className="w-4 h-4 text-[var(--accent-text)] shrink-0" />
          </button>
        )}

        {/* Tomorrow preview + roadmap context */}
        {(data.tomorrowDueCount || data.roadmapPhase) && (
          <div className="text-center space-y-1">
            {data.roadmapPhase && (
              <p className="text-xs text-[var(--accent-text)] font-medium">{data.roadmapPhase}</p>
            )}
            {data.tomorrowDueCount && data.tomorrowDueCount > 0 && (
              <p className="text-xs text-[var(--text-muted)]">
                {t('session.tomorrowDue', { count: data.tomorrowDueCount })}
              </p>
            )}
          </div>
        )}

        {/* Dismiss buttons */}
        <div className="flex gap-3 pt-1">
          <button onClick={onDismiss} className="btn-secondary flex-1 py-2.5 text-sm flex items-center justify-center gap-2">
            <Check className="w-4 h-4" />
            {t('common.done')}
          </button>
          <button
            onClick={() => { onDismiss(); navigate('/') }}
            className="btn-secondary flex-1 py-2.5 text-sm flex items-center justify-center gap-2"
          >
            <Home className="w-4 h-4" />
            {t('common.dashboard')}
          </button>
        </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
