/**
 * Collapsible theme clusters + AI ranking display.
 */
import { useState } from 'react'
import { ChevronDown, ChevronRight, Layers, TrendingUp } from 'lucide-react'
import type { SynthesisResult } from '../../ai/workflows/articleSynthesis'

interface Props {
  synthesis: SynthesisResult
}

export function ReviewSynthesis({ synthesis }: Props) {
  const [showThemes, setShowThemes] = useState(true)
  const [showRanking, setShowRanking] = useState(false)

  return (
    <div className="space-y-3">
      {/* Themes */}
      {synthesis.themes.length > 0 && (
        <div className="glass-card overflow-hidden">
          <button
            onClick={() => setShowThemes(!showThemes)}
            className="w-full flex items-center justify-between p-4 hover:bg-[var(--bg-input)]/50 transition-colors"
          >
            <span className="flex items-center gap-2 text-sm font-semibold text-[var(--text-heading)]">
              <Layers size={16} className="text-[var(--accent-text)]" />
              Theme Clusters ({synthesis.themes.length})
            </span>
            {showThemes ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
          {showThemes && (
            <div className="px-4 pb-4 space-y-3">
              {synthesis.themes.map((theme, i) => (
                <div key={i} className="p-3 rounded-lg bg-[var(--bg-input)]">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-[var(--text-heading)]">{theme.name}</span>
                    <span className="text-xs text-[var(--text-muted)]">
                      {theme.articleIds.length} article{theme.articleIds.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--text-muted)]">{theme.description}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Ranking */}
      {synthesis.ranking.length > 0 && (
        <div className="glass-card overflow-hidden">
          <button
            onClick={() => setShowRanking(!showRanking)}
            className="w-full flex items-center justify-between p-4 hover:bg-[var(--bg-input)]/50 transition-colors"
          >
            <span className="flex items-center gap-2 text-sm font-semibold text-[var(--text-heading)]">
              <TrendingUp size={16} className="text-[var(--accent-text)]" />
              AI Ranking ({synthesis.ranking.length} articles)
            </span>
            {showRanking ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
          {showRanking && (
            <div className="px-4 pb-4 space-y-2">
              {[...synthesis.ranking]
                .sort((a, b) => a.rank - b.rank)
                .map((item) => (
                  <div key={item.articleId} className="flex items-start gap-3 p-2 rounded-lg bg-[var(--bg-input)]">
                    <span className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                      item.rank <= 3
                        ? 'bg-[var(--accent-bg)] text-[var(--accent-text)]'
                        : 'bg-[var(--border-card)] text-[var(--text-muted)]'
                    }`}>
                      {item.rank}
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className="text-xs text-[var(--text-muted)]">
                        {item.articleId.slice(0, 8)}...
                      </span>
                      <p className="text-xs text-[var(--text-body)] mt-0.5">{item.rationale}</p>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
