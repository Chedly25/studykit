import { useState } from 'react'
import { BookOpen, ChevronDown, ChevronUp, NotebookPen } from 'lucide-react'
import type { LegalArticle, CoursChunk } from '../../hooks/useLegalChat'

interface Props {
  articles: LegalArticle[]
  coursChunks?: CoursChunk[]
}

export function LegalArticlesPanel({ articles, coursChunks = [] }: Props) {
  const [expandedArticles, setExpandedArticles] = useState<Set<number>>(new Set())
  const [expandedCours, setExpandedCours] = useState<Set<number>>(new Set())

  if (articles.length === 0 && coursChunks.length === 0) return null

  const toggle = (set: Set<number>, setter: (s: Set<number>) => void, i: number) => {
    const next = new Set(set)
    if (next.has(i)) next.delete(i); else next.add(i)
    setter(next)
  }

  return (
    <div className="space-y-6">
      {articles.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center gap-2 px-1 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            <BookOpen className="w-3.5 h-3.5" />
            Sources juridiques ({articles.length})
          </div>
          <div className="space-y-2">
            {articles.map((article, i) => {
              const isOpen = expandedArticles.has(i)
              const isLong = article.text.length > 300
              return (
                <div key={i} className="glass-card overflow-hidden">
                  <button
                    onClick={() => isLong && toggle(expandedArticles, setExpandedArticles, i)}
                    className={`w-full text-left p-3 ${isLong ? 'cursor-pointer hover:bg-[var(--bg-hover)]' : 'cursor-default'} transition-colors`}
                  >
                    <div className="flex items-start gap-2 mb-1.5">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-[var(--accent-bg)] text-[var(--accent-text)] shrink-0">
                        Art. {article.articleNum}
                      </span>
                      <span className="text-xs text-[var(--text-muted)] font-medium pt-0.5">{article.codeName}</span>
                      {isLong && (
                        <span className="ml-auto text-[var(--text-muted)]">
                          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </span>
                      )}
                    </div>
                    {article.breadcrumb && (
                      <p className="text-xs text-[var(--text-muted)] mb-1.5 pl-1">{article.breadcrumb}</p>
                    )}
                    <p className={`text-sm text-[var(--text-secondary)] leading-relaxed pl-1 ${!isOpen && isLong ? 'line-clamp-3' : ''}`}>
                      {article.text}
                    </p>
                  </button>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {coursChunks.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center gap-2 px-1 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            <NotebookPen className="w-3.5 h-3.5" />
            Tes cours ({coursChunks.length})
          </div>
          <div className="space-y-2">
            {coursChunks.map((chunk, i) => {
              const isOpen = expandedCours.has(i)
              const isLong = chunk.content.length > 300
              return (
                <div key={i} className="glass-card overflow-hidden">
                  <button
                    onClick={() => isLong && toggle(expandedCours, setExpandedCours, i)}
                    className={`w-full text-left p-3 ${isLong ? 'cursor-pointer hover:bg-[var(--bg-hover)]' : 'cursor-default'} transition-colors`}
                  >
                    <div className="flex items-start gap-2 mb-1.5">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-[var(--accent-bg)] text-[var(--accent-text)] shrink-0">
                        Extrait {chunk.chunkIndex + 1}
                      </span>
                      <span className="text-xs text-[var(--text-muted)] font-medium pt-0.5 truncate">{chunk.documentTitle}</span>
                      {isLong && (
                        <span className="ml-auto text-[var(--text-muted)]">
                          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </span>
                      )}
                    </div>
                    <p className={`text-sm text-[var(--text-secondary)] leading-relaxed pl-1 ${!isOpen && isLong ? 'line-clamp-3' : ''}`}>
                      {chunk.content}
                    </p>
                  </button>
                </div>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
