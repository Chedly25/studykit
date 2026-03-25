/**
 * Results view for the CRFPA Note de Synthèse.
 * Shows: score card, per-criterion breakdown, document coverage, model answer.
 */
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Trophy, RotateCcw, CheckCircle, XCircle, Eye, EyeOff } from 'lucide-react'
import type { PracticeExamSession } from '../../../db/schema'
import { DocumentMarkdown } from '../document/DocumentMarkdown'

interface SyntheseResultsProps {
  session: PracticeExamSession | undefined
  onRetake: () => void
}

interface CriterionScore {
  criterion: string
  earned: number
  max: number
  comment: string
}

interface GradingResult {
  criterionScores: CriterionScore[]
  documentsCited: number[]
  documentsMissed: number[]
  totalEarned: number
  totalMax: number
}

export function SyntheseResults({ session, onRetake }: SyntheseResultsProps) {
  const { t } = useTranslation()
  const [showModel, setShowModel] = useState(false)

  const { grading, totalEarned, totalMax } = useMemo(() => {
    let g: GradingResult | null = null
    try { if (session?.synthesisGrading) g = JSON.parse(session.synthesisGrading) } catch { /* ignore */ }
    return {
      grading: g,
      totalEarned: g?.totalEarned ?? session?.totalScore ?? 0,
      totalMax: g?.totalMax ?? session?.maxScore ?? 20,
    }
  }, [session])

  if (!session) return null

  const percentage = totalMax > 0 ? Math.round((totalEarned / totalMax) * 100) : 0
  const passed = percentage >= 50

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Score card */}
      <div className="glass-card p-6 flex items-center gap-6">
        <div className={`w-14 h-14 rounded-full flex items-center justify-center ${
          passed ? 'bg-amber-400/20' : 'bg-[var(--bg-input)]'
        }`}>
          <Trophy className={`w-7 h-7 ${passed ? 'text-amber-500' : 'text-[var(--text-faint)]'}`} />
        </div>
        <div className="flex-1">
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-bold text-[var(--text-heading)]">{totalEarned}/{totalMax}</span>
            <span className="text-sm text-[var(--text-muted)]">({percentage}%)</span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              passed
                ? 'bg-green-500/10 text-green-600 border border-green-500/20'
                : 'bg-red-500/10 text-red-500 border border-red-500/20'
            }`}>
              {passed ? t('practiceExam.passed', 'Passed') : t('practiceExam.needsWork', 'Needs Work')}
            </span>
          </div>
          {session.overallFeedback && (
            <p className="text-sm text-[var(--text-body)] mt-2">{session.overallFeedback}</p>
          )}
        </div>
      </div>

      {/* Per-criterion breakdown */}
      {grading && grading.criterionScores.length > 0 && (
        <div className="glass-card p-5 space-y-3">
          <h3 className="text-sm font-semibold text-[var(--text-heading)]">
            {t('syntheseExam.criteriaBreakdown', 'Grading Breakdown')}
          </h3>
          <div className="space-y-2">
            {grading.criterionScores.map((c, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-[var(--bg-input)]">
                <div className={`shrink-0 mt-0.5 ${c.earned >= c.max * 0.7 ? 'text-green-500' : c.earned > 0 ? 'text-amber-500' : 'text-red-500'}`}>
                  {c.earned >= c.max * 0.7 ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-[var(--text-heading)]">{c.criterion}</span>
                    <span className={`text-sm font-semibold ${c.earned >= c.max * 0.7 ? 'text-green-600' : 'text-[var(--text-body)]'}`}>
                      {c.earned}/{c.max}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">{c.comment}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Document coverage */}
      {grading && (
        <div className="glass-card p-5 space-y-3">
          <h3 className="text-sm font-semibold text-[var(--text-heading)]">
            {t('syntheseExam.documentCoverage', 'Document Coverage')}
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {[...new Set([...(grading.documentsCited ?? []), ...(grading.documentsMissed ?? [])])]
              .sort((a, b) => a - b)
              .map(num => {
                const cited = grading.documentsCited?.includes(num)
                return (
                  <span
                    key={num}
                    className={`w-8 h-8 rounded-full text-xs font-medium flex items-center justify-center ${
                      cited
                        ? 'bg-green-500/20 text-green-600 border border-green-500/40'
                        : 'bg-red-500/20 text-red-500 border border-red-500/40'
                    }`}
                  >
                    {num}
                  </span>
                )
              })}
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            {grading.documentsCited?.length ?? 0} {t('syntheseExam.cited', 'cited')} / {(grading.documentsCited?.length ?? 0) + (grading.documentsMissed?.length ?? 0)} total
            {grading.documentsMissed && grading.documentsMissed.length > 0 && (
              <> — {t('syntheseExam.missing', 'missing')}: {grading.documentsMissed.join(', ')}</>
            )}
          </p>
        </div>
      )}

      {/* Student's synthesis */}
      {session.synthesisAnswer && (
        <div className="glass-card p-5 space-y-3">
          <h3 className="text-sm font-semibold text-[var(--text-heading)]">
            {t('syntheseExam.yourSynthesis', 'Your Synthesis')}
          </h3>
          <div className="text-sm text-[var(--text-body)] whitespace-pre-wrap leading-relaxed">
            {session.synthesisAnswer}
          </div>
        </div>
      )}

      {/* Model synthesis (collapsible) */}
      {session.synthesisModelAnswer && (
        <div className="glass-card p-5 space-y-3">
          <button
            onClick={() => setShowModel(!showModel)}
            className="flex items-center gap-2 text-sm font-semibold text-[var(--text-heading)] hover:text-[var(--accent-text)] transition-colors"
          >
            {showModel ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {t('syntheseExam.modelSynthesis', 'Model Synthesis')}
          </button>
          {showModel && (
            <div className="border-t border-[var(--border-card)] pt-3">
              <DocumentMarkdown content={session.synthesisModelAnswer} />
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-center gap-3 pb-8">
        <button onClick={onRetake} className="btn-secondary px-6 py-2.5 text-sm flex items-center gap-2">
          <RotateCcw className="w-4 h-4" />
          {t('practiceExam.retake', 'Retake')}
        </button>
      </div>
    </div>
  )
}
