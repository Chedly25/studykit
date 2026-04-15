import { ChevronDown, ChevronUp, BookOpen } from 'lucide-react'
import type { LegalArticle } from '../../hooks/useLegalChat'

interface Props {
  articles: LegalArticle[]
  open: boolean
  onToggle: () => void
}

export function LegalArticlesPanel({ articles, open, onToggle }: Props) {
  if (articles.length === 0) return null

  return (
    <div className="glass-card overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 hover:bg-[var(--bg-hover)] transition-colors"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-[var(--text-heading)]">
          <BookOpen className="w-4 h-4" />
          {articles.length} article{articles.length > 1 ? 's' : ''} trouvé{articles.length > 1 ? 's' : ''}
        </span>
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {open && (
        <div className="border-t border-[var(--border-card)] max-h-80 overflow-y-auto">
          {articles.map((article, i) => (
            <div key={i} className="p-4 border-b border-[var(--border-card)] last:border-b-0">
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-[var(--accent-bg)] text-[var(--accent-text)]">
                  Art. {article.articleNum}
                </span>
                <span className="text-xs text-[var(--text-muted)]">{article.codeName}</span>
              </div>
              {article.breadcrumb && (
                <p className="text-xs text-[var(--text-muted)] mb-2">{article.breadcrumb}</p>
              )}
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed line-clamp-4">
                {article.text}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
