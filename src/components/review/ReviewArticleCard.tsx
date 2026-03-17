/**
 * Article summary card — title, summary snippet, score badges, decision pills.
 */
import { Star, HelpCircle, XCircle, ChevronRight } from 'lucide-react'
import type { ReviewArticle, ArticleDecision } from '../../db/schema'
import { useMemo } from 'react'

interface Props {
  article: ReviewArticle
  documentTitle?: string
  onSelect: (articleId: string) => void
  onDecision: (articleId: string, decision: ArticleDecision) => void
}

const decisionColors: Record<ArticleDecision, string> = {
  shortlisted: 'bg-green-500/10 text-green-500 border-green-500/20',
  maybe: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  rejected: 'bg-red-500/10 text-red-400 border-red-500/20',
  pending: 'bg-[var(--bg-input)] text-[var(--text-muted)] border-[var(--border-card)]',
}

function ScoreBadge({ label, score, color }: { label: string; score?: number; color: string }) {
  if (score === undefined) return null
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded ${color}`}>
      {label}: {score}/5
    </span>
  )
}

export function ReviewArticleCard({ article, documentTitle, onSelect, onDecision }: Props) {
  const analysis = useMemo(() => {
    try { return article.aiAnalysis ? JSON.parse(article.aiAnalysis) : {} } catch { return {} }
  }, [article.aiAnalysis])

  const summary = analysis.summary ?? ''
  const truncatedSummary = summary.length > 150 ? summary.slice(0, 150) + '...' : summary
  const themes: string[] = analysis.themes ?? []

  return (
    <div
      className="glass-card glass-card-hover p-4 cursor-pointer"
      onClick={() => onSelect(article.id)}
    >
      {/* Title */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className="font-semibold text-[var(--text-heading)] text-sm leading-tight flex-1">
          {documentTitle ?? `Article ${article.id.slice(0, 8)}`}
        </h4>
        <ChevronRight size={14} className="text-[var(--text-muted)] flex-shrink-0 mt-0.5" />
      </div>

      {/* Summary */}
      {truncatedSummary && (
        <p className="text-xs text-[var(--text-muted)] mb-3 line-clamp-2">{truncatedSummary}</p>
      )}

      {/* Score badges */}
      <div className="flex flex-wrap gap-1 mb-3">
        <ScoreBadge label="R" score={article.relevanceScore} color="bg-blue-500/10 text-blue-500" />
        <ScoreBadge label="N" score={article.noveltyScore} color="bg-purple-500/10 text-purple-500" />
        <ScoreBadge label="Q" score={article.qualityScore} color="bg-emerald-500/10 text-emerald-500" />
        {article.compositeScore !== undefined && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--accent-bg)] text-[var(--accent-text)] font-medium">
            {article.compositeScore.toFixed(1)}
          </span>
        )}
      </div>

      {/* Theme tags */}
      {themes.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {themes.slice(0, 3).map(t => (
            <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--bg-input)] text-[var(--text-muted)]">
              {t}
            </span>
          ))}
          {themes.length > 3 && (
            <span className="text-[10px] text-[var(--text-muted)]">+{themes.length - 3}</span>
          )}
        </div>
      )}

      {/* Decision pills */}
      <div className="flex gap-1.5" onClick={e => e.stopPropagation()}>
        {(['shortlisted', 'maybe', 'rejected'] as ArticleDecision[]).map(d => (
          <button
            key={d}
            onClick={() => onDecision(article.id, article.decision === d ? 'pending' : d)}
            className={`text-xs px-2 py-1 rounded-md border transition-colors ${
              article.decision === d
                ? decisionColors[d]
                : 'border-transparent text-[var(--text-muted)] hover:bg-[var(--bg-input)]'
            }`}
          >
            {d === 'shortlisted' && <Star size={10} className="inline mr-0.5" />}
            {d === 'maybe' && <HelpCircle size={10} className="inline mr-0.5" />}
            {d === 'rejected' && <XCircle size={10} className="inline mr-0.5" />}
            {d.charAt(0).toUpperCase() + d.slice(1)}
          </button>
        ))}
      </div>
    </div>
  )
}
