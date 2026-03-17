/**
 * Main review dashboard — articles grid, filters, synthesis, export.
 */
import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db'
import { useArticleReview } from '../../hooks/useArticleReview'
import { ReviewStats } from './ReviewStats'
import { ReviewFilters } from './ReviewFilters'
import { ReviewArticleCard } from './ReviewArticleCard'
import { ReviewArticleDetail } from './ReviewArticleDetail'
import { ReviewSynthesis } from './ReviewSynthesis'
import { ReviewExport } from './ReviewExport'
import type { ReviewProject } from '../../db/schema'

interface Props {
  project: ReviewProject
}

export function ReviewDashboard({ project }: Props) {
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null)

  const review = useArticleReview(project.id)

  // Load document titles for article cards
  const documentIds = review.allArticles
    .filter(a => a.documentId)
    .map(a => a.documentId)

  const documents = useLiveQuery(
    () => documentIds.length > 0
      ? db.documents.where('id').anyOf(documentIds).toArray()
      : [],
    [documentIds.join(',')],
    [],
  )

  const docTitleMap = new Map((documents ?? []).map(d => [d.id, d.title]))

  const selectedArticle = review.articles.find(a => a.id === selectedArticleId)

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Stats */}
      <ReviewStats stats={review.stats} targetCount={project.targetShortlistCount} />

      {/* Synthesis */}
      {review.synthesisResult && (
        <ReviewSynthesis synthesis={review.synthesisResult} />
      )}

      {/* Filters + Export */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <ReviewFilters
            sortBy={review.sortBy}
            onSortChange={review.setSortBy}
            sortAsc={review.sortAsc}
            onSortAscChange={review.setSortAsc}
            filterDecision={review.filterDecision}
            onFilterDecisionChange={review.setFilterDecision}
            filterTheme={review.filterTheme}
            onFilterThemeChange={review.setFilterTheme}
            themes={review.themes}
            searchQuery={review.searchQuery}
            onSearchChange={review.setSearchQuery}
          />
        </div>
        <ReviewExport onExport={review.exportShortlist} />
      </div>

      {/* Article grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {review.articles.map(article => (
          <ReviewArticleCard
            key={article.id}
            article={article}
            documentTitle={docTitleMap.get(article.documentId)}
            onSelect={setSelectedArticleId}
            onDecision={review.updateDecision}
          />
        ))}
      </div>

      {review.articles.length === 0 && (
        <div className="text-center py-12 text-[var(--text-muted)]">
          No articles match your filters.
        </div>
      )}

      {/* Detail modal */}
      {selectedArticle && (
        <ReviewArticleDetail
          key={selectedArticle.id}
          article={selectedArticle}
          documentTitle={docTitleMap.get(selectedArticle.documentId)}
          onClose={() => setSelectedArticleId(null)}
          onDecision={d => review.updateDecision(selectedArticle.id, d)}
          onScoreChange={s => review.updateScore(selectedArticle.id, s)}
          onNotesChange={n => review.updateNotes(selectedArticle.id, n)}
        />
      )}
    </div>
  )
}
