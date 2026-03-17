/**
 * Full article detail modal — analysis, research, score sliders, notes, decision.
 */
import { useMemo, useState } from 'react'
import { X, Star, HelpCircle, XCircle, ExternalLink } from 'lucide-react'
import type { ReviewArticle, ArticleDecision } from '../../db/schema'

interface Props {
  article: ReviewArticle
  documentTitle?: string
  onClose: () => void
  onDecision: (decision: ArticleDecision) => void
  onScoreChange: (score: number) => void
  onNotesChange: (notes: string) => void
}

export function ReviewArticleDetail({ article, documentTitle, onClose, onDecision, onScoreChange, onNotesChange }: Props) {
  const [notes, setNotes] = useState(article.userNotes ?? '')

  const analysis = useMemo(() => {
    try { return article.aiAnalysis ? JSON.parse(article.aiAnalysis) : {} } catch { return {} }
  }, [article.aiAnalysis])

  const research = useMemo(() => {
    try { return article.researchContext ? JSON.parse(article.researchContext) : null } catch { return null }
  }, [article.researchContext])

  const handleNotesBlur = () => {
    if (notes !== (article.userNotes ?? '')) {
      onNotesChange(notes)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="glass-card w-full max-w-2xl mx-4 p-6 max-h-[85vh] overflow-y-auto animate-fade-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <h2 className="text-lg font-bold text-[var(--text-heading)] pr-4">
            {documentTitle ?? `Article ${article.id.slice(0, 8)}`}
          </h2>
          <button onClick={onClose} className="btn-action p-1.5 rounded-lg hover:bg-[var(--bg-input)]">
            <X size={16} />
          </button>
        </div>

        {/* Decision buttons */}
        <div className="flex gap-2 mb-5">
          {([
            { d: 'shortlisted' as const, icon: Star, color: 'green', label: 'Shortlist' },
            { d: 'maybe' as const, icon: HelpCircle, color: 'amber', label: 'Maybe' },
            { d: 'rejected' as const, icon: XCircle, color: 'red', label: 'Reject' },
          ]).map(({ d, icon: Icon, color, label }) => (
            <button
              key={d}
              onClick={() => onDecision(article.decision === d ? 'pending' : d)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
                article.decision === d
                  ? `bg-${color}-500/15 text-${color}-500 border-${color}-500/30`
                  : 'border-[var(--border-card)] text-[var(--text-muted)] hover:bg-[var(--bg-input)]'
              }`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        {/* Scores */}
        <div className="grid grid-cols-4 gap-3 mb-5">
          {[
            { label: 'Relevance', score: article.relevanceScore, justification: analysis.relevanceJustification },
            { label: 'Novelty', score: article.noveltyScore, justification: analysis.noveltyJustification },
            { label: 'Quality', score: article.qualityScore, justification: analysis.qualityJustification },
            { label: 'Composite', score: article.compositeScore },
          ].map(({ label, score, justification }) => (
            <div key={label} className="text-center p-3 rounded-lg bg-[var(--bg-input)]" title={justification}>
              <div className="text-2xl font-bold text-[var(--text-heading)]">
                {score !== undefined ? (label === 'Composite' ? score.toFixed(1) : score) : '-'}
              </div>
              <div className="text-xs text-[var(--text-muted)]">{label}</div>
            </div>
          ))}
        </div>

        {/* User score */}
        <div className="mb-5">
          <label className="block text-sm font-medium text-[var(--text-body)] mb-1.5">
            Your Score (1-5)
          </label>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map(s => (
              <button
                key={s}
                onClick={() => onScoreChange(article.userScore === s ? 0 : s)}
                className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${
                  article.userScore === s
                    ? 'bg-[var(--accent-bg)] text-[var(--accent-text)] border border-[var(--accent-text)]/30'
                    : 'bg-[var(--bg-input)] text-[var(--text-muted)] hover:text-[var(--text-body)]'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Summary */}
        {analysis.summary && (
          <div className="mb-5">
            <h3 className="text-sm font-semibold text-[var(--text-heading)] mb-2">Summary</h3>
            <p className="text-sm text-[var(--text-body)] leading-relaxed">{analysis.summary}</p>
          </div>
        )}

        {/* Key Findings */}
        {analysis.keyFindings?.length > 0 && (
          <div className="mb-5">
            <h3 className="text-sm font-semibold text-[var(--text-heading)] mb-2">Key Findings</h3>
            <ul className="space-y-1">
              {analysis.keyFindings.map((f: string, i: number) => (
                <li key={i} className="text-sm text-[var(--text-body)] flex items-start gap-2">
                  <span className="text-[var(--accent-text)] mt-1 flex-shrink-0">-</span>
                  {f}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Methodology */}
        {analysis.methodology && (
          <div className="mb-5">
            <h3 className="text-sm font-semibold text-[var(--text-heading)] mb-2">Methodology</h3>
            <p className="text-sm text-[var(--text-body)]">{analysis.methodology}</p>
          </div>
        )}

        {/* Themes */}
        {analysis.themes?.length > 0 && (
          <div className="mb-5">
            <h3 className="text-sm font-semibold text-[var(--text-heading)] mb-2">Themes</h3>
            <div className="flex flex-wrap gap-1.5">
              {analysis.themes.map((t: string) => (
                <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-[var(--bg-input)] text-[var(--text-muted)]">
                  {t}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Notable Quotes */}
        {analysis.notableQuotes?.length > 0 && (
          <div className="mb-5">
            <h3 className="text-sm font-semibold text-[var(--text-heading)] mb-2">Notable Quotes</h3>
            <div className="space-y-2">
              {analysis.notableQuotes.map((q: string, i: number) => (
                <blockquote key={i} className="text-sm text-[var(--text-muted)] italic border-l-2 border-[var(--accent-text)]/30 pl-3">
                  "{q}"
                </blockquote>
              ))}
            </div>
          </div>
        )}

        {/* Research Context */}
        {research && (
          <div className="mb-5 p-4 rounded-lg bg-[var(--bg-input)]">
            <h3 className="text-sm font-semibold text-[var(--text-heading)] mb-2 flex items-center gap-1.5">
              <ExternalLink size={14} /> Web Research
            </h3>
            {research.authorCredentials && research.authorCredentials !== 'Not available' && (
              <p className="text-sm text-[var(--text-body)] mb-1">
                <strong>Authors:</strong> {research.authorCredentials}
              </p>
            )}
            {research.citationInfo && research.citationInfo !== 'Not available' && (
              <p className="text-sm text-[var(--text-body)] mb-1">
                <strong>Citations:</strong> {research.citationInfo}
              </p>
            )}
            {research.journalInfo && research.journalInfo !== 'Not available' && (
              <p className="text-sm text-[var(--text-body)] mb-1">
                <strong>Journal:</strong> {research.journalInfo}
              </p>
            )}
            {research.relatedWork?.length > 0 && (
              <div className="mt-2">
                <strong className="text-sm text-[var(--text-body)]">Related Work:</strong>
                <ul className="mt-1 space-y-0.5">
                  {research.relatedWork.map((w: string, i: number) => (
                    <li key={i} className="text-xs text-[var(--text-muted)]">- {w}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Notes */}
        <div className="mb-2">
          <label className="block text-sm font-semibold text-[var(--text-heading)] mb-2">Your Notes</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            onBlur={handleNotesBlur}
            placeholder="Add your notes about this article..."
            className="input-field w-full h-24 resize-none text-sm"
          />
        </div>
      </div>
    </div>
  )
}
