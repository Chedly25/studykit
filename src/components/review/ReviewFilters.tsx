/**
 * Sort/filter controls for the review dashboard.
 */
import { Search, SlidersHorizontal, ArrowUpDown } from 'lucide-react'
import type { ArticleDecision } from '../../db/schema'
import type { SortField } from '../../hooks/useArticleReview'

interface Props {
  sortBy: SortField
  onSortChange: (field: SortField) => void
  sortAsc: boolean
  onSortAscChange: (asc: boolean) => void
  filterDecision: ArticleDecision | 'all'
  onFilterDecisionChange: (d: ArticleDecision | 'all') => void
  filterTheme: string | null
  onFilterThemeChange: (theme: string | null) => void
  themes: string[]
  searchQuery: string
  onSearchChange: (q: string) => void
}

export function ReviewFilters({
  sortBy, onSortChange, sortAsc, onSortAscChange,
  filterDecision, onFilterDecisionChange,
  filterTheme, onFilterThemeChange, themes,
  searchQuery, onSearchChange,
}: Props) {
  return (
    <div className="glass-card p-4">
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Search articles..."
            className="input-field w-full pl-9 pr-4 py-1.5 text-sm"
          />
        </div>

        {/* Sort */}
        <div className="flex items-center gap-1.5">
          <SlidersHorizontal size={14} className="text-[var(--text-muted)]" />
          <select
            value={sortBy}
            onChange={e => onSortChange(e.target.value as SortField)}
            className="select-field text-sm py-1.5 pr-8"
          >
            <option value="compositeScore">Composite Score</option>
            <option value="relevanceScore">Relevance</option>
            <option value="noveltyScore">Novelty</option>
            <option value="qualityScore">Quality</option>
            <option value="createdAt">Date Added</option>
          </select>
          <button
            onClick={() => onSortAscChange(!sortAsc)}
            className="btn-action p-1.5 rounded-lg"
            title={sortAsc ? 'Ascending' : 'Descending'}
          >
            <ArrowUpDown size={14} className={sortAsc ? 'rotate-180' : ''} />
          </button>
        </div>

        {/* Decision filter */}
        <select
          value={filterDecision}
          onChange={e => onFilterDecisionChange(e.target.value as ArticleDecision | 'all')}
          className="select-field text-sm py-1.5 pr-8"
        >
          <option value="all">All decisions</option>
          <option value="pending">Pending</option>
          <option value="shortlisted">Shortlisted</option>
          <option value="maybe">Maybe</option>
          <option value="rejected">Rejected</option>
        </select>

        {/* Theme filter */}
        {themes.length > 0 && (
          <select
            value={filterTheme ?? ''}
            onChange={e => onFilterThemeChange(e.target.value || null)}
            className="select-field text-sm py-1.5 pr-8"
          >
            <option value="">All themes</option>
            {themes.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        )}
      </div>
    </div>
  )
}
