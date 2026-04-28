/**
 * Results view for Type B document exams.
 *
 * Shows score summary, then the full exam document with student answers,
 * grading feedback, and model answers inline.
 */
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Trophy, RotateCcw } from 'lucide-react'
import type { PracticeExamSession } from '../../db/schema'
import type { DocumentGradingResult, DocumentModelAnswer } from './document/DocumentAnswerArea'
import { DocumentExamTaker } from './DocumentExamTaker'

interface DocumentExamResultsProps {
  session: PracticeExamSession | undefined
  onRetake: () => void
}

export function DocumentExamResults({ session, onRetake }: DocumentExamResultsProps) {
  const { t } = useTranslation()

  const { answers, grading, modelAnswers, totalEarned, totalMax } = useMemo(() => {
    let a: Record<number, string> = {}
    let g: Record<number, DocumentGradingResult> = {}
    let m: DocumentModelAnswer[] = []
    try { if (session?.documentAnswers) a = JSON.parse(session.documentAnswers) } catch { /* malformed */ }
    try { if (session?.documentGrading) g = JSON.parse(session.documentGrading) } catch { /* malformed */ }
    try { if (session?.documentModelAnswers) m = JSON.parse(session.documentModelAnswers) } catch { /* malformed */ }

    let earned = 0
    let max = 0
    for (const r of Object.values(g)) {
      earned += r.earned
      max += r.max
    }

    return { answers: a, grading: g, modelAnswers: m, totalEarned: earned, totalMax: max }
  }, [session])

  if (!session?.documentContent) {
    return (
      <div className="text-center py-12 text-[var(--text-muted)]">
        {t('documentExam.noContent')}
      </div>
    )
  }

  const percentage = totalMax > 0 ? Math.round((totalEarned / totalMax) * 100) : 0
  const passed = percentage >= 50
  const hasGrading = Object.keys(grading).length > 0

  return (
    <div>
      {/* Score card */}
      {hasGrading && (
        <div className="max-w-5xl mx-auto px-4 pt-6">
          <div className="glass-card p-6 mb-6 flex items-center gap-6">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center ${
              passed ? 'bg-[var(--color-warning-bg)]' : 'bg-[var(--bg-input)]'
            }`}>
              <Trophy className={`w-7 h-7 ${passed ? 'text-[var(--color-warning)]' : 'text-[var(--text-faint)]'}`} />
            </div>
            <div className="flex-1">
              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-bold text-[var(--text-heading)]">{percentage}%</span>
                <span className="text-sm text-[var(--text-muted)]">{totalEarned}/{totalMax} pts</span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  passed
                    ? 'bg-[var(--color-success-bg)] text-[var(--color-success)] border border-[var(--color-success-border)]'
                    : 'bg-[var(--color-error-bg)] text-[var(--color-error)] border border-[var(--color-error-border)]'
                }`}>
                  {passed ? t('practiceExam.passed') : t('practiceExam.needsWork')}
                </span>
              </div>
              {session.overallFeedback && (
                <p className="text-sm text-[var(--text-body)] mt-2">{session.overallFeedback}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Full document with answers and grading inline */}
      <DocumentExamTaker
        sessionId={session.id}
        documentContent={session.documentContent}
        readOnly
        savedAnswers={answers}
        gradingResults={hasGrading ? grading : undefined}
        modelAnswers={modelAnswers.length > 0 ? modelAnswers : undefined}
        onSubmit={() => {}}
      />

      {/* Actions */}
      <div className="max-w-5xl mx-auto px-4 pb-12 flex justify-center gap-3">
        <button onClick={onRetake} className="btn-secondary px-6 py-2.5 text-sm flex items-center gap-2">
          <RotateCcw className="w-4 h-4" />
          {t('practiceExam.retake')}
        </button>
      </div>
    </div>
  )
}
