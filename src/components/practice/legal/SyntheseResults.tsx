/**
 * Results view for CRFPA exams: Note de Synthèse, Cas Pratique, Grand Oral.
 * Shows: score card, per-criterion breakdown, document coverage (synthesis only),
 * model answer / model plan depending on exam mode.
 */
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Trophy, RotateCcw, CheckCircle, XCircle, Eye, EyeOff, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react'
import type { CitationVerification } from '../../../ai/workflows/syntheseGrading'
import type { PracticeExamSession } from '../../../db/schema'
import { DocumentMarkdown } from '../document/DocumentMarkdown'

interface SyntheseResultsProps {
  session: PracticeExamSession | undefined
  onRetake: () => void
}

interface GrandOralModel {
  expectedPlan?: { I: string; IA: string; IB: string; II: string; IIA: string; IIB: string }
  keyPoints?: string[]
  subsidiaryQuestions?: string[]
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

  const examMode = session?.examMode ?? 'synthesis'
  const isGrandOral = examMode === 'grand-oral'
  const isSynthesis = examMode === 'synthesis'
  const isCasPratique = examMode === 'cas-pratique'

  const citationVerifications = useMemo<CitationVerification[]>(() => {
    if (!session?.citationVerification) return []
    try { return JSON.parse(session.citationVerification) } catch { return [] }
  }, [session?.citationVerification])

  const [citationsOpen, setCitationsOpen] = useState(false)

  // Parse Grand Oral model answer (stored as JSON, not text)
  const grandOralModel = useMemo<GrandOralModel | null>(() => {
    if (!isGrandOral || !session?.synthesisModelAnswer) return null
    try { return JSON.parse(session.synthesisModelAnswer) } catch { return null }
  }, [isGrandOral, session?.synthesisModelAnswer])

  if (!session) return null

  const percentage = totalMax > 0 ? Math.round((totalEarned / totalMax) * 100) : 0
  const passed = percentage >= 50

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Score card */}
      <div className="glass-card p-6 flex items-center gap-6">
        <div className={`w-14 h-14 rounded-full flex items-center justify-center ${
          passed ? 'bg-[var(--color-warning-bg)]' : 'bg-[var(--bg-input)]'
        }`}>
          <Trophy className={`w-7 h-7 ${passed ? 'text-[var(--color-warning)]' : 'text-[var(--text-faint)]'}`} />
        </div>
        <div className="flex-1">
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-bold text-[var(--text-heading)]">{totalEarned}/{totalMax}</span>
            <span className="text-sm text-[var(--text-muted)]">({percentage}%)</span>
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

      {/* Per-criterion breakdown */}
      {grading && grading.criterionScores.length > 0 && (
        <div className="glass-card p-5 space-y-3">
          <h3 className="text-sm font-semibold text-[var(--text-heading)]">
            {t('syntheseExam.criteriaBreakdown')}
          </h3>
          <div className="space-y-2">
            {grading.criterionScores.map((c, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-[var(--bg-input)]">
                <div className={`shrink-0 mt-0.5 ${c.earned >= c.max * 0.7 ? 'text-[var(--color-success)]' : c.earned > 0 ? 'text-[var(--color-warning)]' : 'text-[var(--color-error)]'}`}>
                  {c.earned >= c.max * 0.7 ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-[var(--text-heading)]">{c.criterion}</span>
                    <span className={`text-sm font-semibold ${c.earned >= c.max * 0.7 ? 'text-[var(--color-success)]' : 'text-[var(--text-body)]'}`}>
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

      {/* Document coverage — only for note de synthèse */}
      {isSynthesis && grading && (grading.documentsCited?.length > 0 || grading.documentsMissed?.length > 0) && (
        <div className="glass-card p-5 space-y-3">
          <h3 className="text-sm font-semibold text-[var(--text-heading)]">
            {t('syntheseExam.documentCoverage')}
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
                        ? 'bg-[var(--color-success-bg)] text-[var(--color-success)] border border-[var(--color-success-border)]'
                        : 'bg-[var(--color-error-bg)] text-[var(--color-error)] border border-[var(--color-error-border)]'
                    }`}
                  >
                    {num}
                  </span>
                )
              })}
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            {grading.documentsCited?.length ?? 0} {t('syntheseExam.cited')} / {(grading.documentsCited?.length ?? 0) + (grading.documentsMissed?.length ?? 0)} total
            {grading.documentsMissed && grading.documentsMissed.length > 0 && (
              <> — {t('syntheseExam.missing')}: {grading.documentsMissed.join(', ')}</>
            )}
          </p>
        </div>
      )}

      {/* Citation verification — cas pratique / grand oral only */}
      {(isCasPratique || isGrandOral) && citationVerifications.length > 0 && (
        <div className="glass-card overflow-hidden">
          <button
            onClick={() => setCitationsOpen(!citationsOpen)}
            className="w-full flex items-center justify-between p-4 hover:bg-[var(--bg-hover)] transition-colors"
          >
            <span className="text-sm font-semibold text-[var(--text-heading)]">
              Vérification des citations ({citationVerifications.length})
            </span>
            {citationsOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {citationsOpen && (
            <div className="border-t border-[var(--border-card)] divide-y divide-[var(--border-card)]">
              {citationVerifications.map((cv, i) => (
                <div key={i} className="px-4 py-3 flex items-start gap-3">
                  {cv.verified ? (
                    <CheckCircle className="w-4 h-4 mt-0.5 text-[var(--color-success)] shrink-0" />
                  ) : cv.confidence > 0.2 ? (
                    <AlertCircle className="w-4 h-4 mt-0.5 text-[var(--color-warning)] shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 mt-0.5 text-[var(--color-error)] shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[var(--text-heading)]">{cv.cited}</p>
                    {cv.verified && cv.articleText && (
                      <p className="text-xs text-[var(--text-muted)] mt-1 line-clamp-2">{cv.articleText}</p>
                    )}
                    {!cv.verified && cv.suggestion && (
                      <p className="text-xs text-[var(--color-error)] mt-1">{cv.suggestion}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Student's answer */}
      {session.synthesisAnswer && (
        <div className="glass-card p-5 space-y-3">
          <h3 className="text-sm font-semibold text-[var(--text-heading)]">
            {isGrandOral
              ? t('grandOral.yourNotes')
              : t('syntheseExam.yourSynthesis')}
          </h3>
          <div className="text-sm text-[var(--text-body)] whitespace-pre-wrap leading-relaxed">
            {session.synthesisAnswer}
          </div>
        </div>
      )}

      {/* Grand Oral: structured model plan + subsidiary questions */}
      {isGrandOral && grandOralModel && (
        <div className="glass-card p-5 space-y-3">
          <button
            onClick={() => setShowModel(!showModel)}
            className="flex items-center gap-2 text-sm font-semibold text-[var(--text-heading)] hover:text-[var(--accent-text)] transition-colors"
          >
            {showModel ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {t('grandOral.modelPlan')}
          </button>
          {showModel && (
            <div className="border-t border-[var(--border-card)] pt-3 space-y-4">
              {grandOralModel.expectedPlan && (
                <div>
                  <h4 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">
                    {t('grandOral.expectedPlan')}
                  </h4>
                  <div className="text-sm text-[var(--text-body)] space-y-1 pl-1">
                    <p className="font-semibold">I. {grandOralModel.expectedPlan.I}</p>
                    <p className="pl-4">A. {grandOralModel.expectedPlan.IA}</p>
                    <p className="pl-4">B. {grandOralModel.expectedPlan.IB}</p>
                    <p className="font-semibold mt-2">II. {grandOralModel.expectedPlan.II}</p>
                    <p className="pl-4">A. {grandOralModel.expectedPlan.IIA}</p>
                    <p className="pl-4">B. {grandOralModel.expectedPlan.IIB}</p>
                  </div>
                </div>
              )}
              {grandOralModel.keyPoints && grandOralModel.keyPoints.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">
                    {t('grandOral.keyPoints')}
                  </h4>
                  <ul className="text-sm text-[var(--text-body)] space-y-1 list-disc pl-5">
                    {grandOralModel.keyPoints.map((pt, i) => <li key={i}>{pt}</li>)}
                  </ul>
                </div>
              )}
              {grandOralModel.subsidiaryQuestions && grandOralModel.subsidiaryQuestions.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">
                    {t('grandOral.subsidiaryQuestions')}
                  </h4>
                  <ol className="text-sm text-[var(--text-body)] space-y-1 list-decimal pl-5">
                    {grandOralModel.subsidiaryQuestions.map((q, i) => <li key={i}>{q}</li>)}
                  </ol>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Model synthesis / consultation (non-grand-oral) */}
      {!isGrandOral && session.synthesisModelAnswer && (
        <div className="glass-card p-5 space-y-3">
          <button
            onClick={() => setShowModel(!showModel)}
            className="flex items-center gap-2 text-sm font-semibold text-[var(--text-heading)] hover:text-[var(--accent-text)] transition-colors"
          >
            {showModel ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {isSynthesis
              ? t('syntheseExam.modelSynthesis')
              : t('casPratique.modelAnswer')}
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
          {t('practiceExam.retake')}
        </button>
      </div>
    </div>
  )
}
