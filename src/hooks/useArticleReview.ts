/**
 * Hook for article curation — filtering, sorting, decisions, export.
 */
import { useState, useCallback, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { ArticleDecision } from '../db/schema'
import type { SynthesisResult } from '../ai/workflows/articleSynthesis'

export type SortField = 'compositeScore' | 'relevanceScore' | 'noveltyScore' | 'qualityScore' | 'createdAt'

export function useArticleReview(projectId: string | undefined) {
  const [sortBy, setSortBy] = useState<SortField>('compositeScore')
  const [sortAsc, setSortAsc] = useState(false)
  const [filterDecision, setFilterDecision] = useState<ArticleDecision | 'all'>('all')
  const [filterTheme, setFilterTheme] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  // Live query all articles for project
  const allArticles = useLiveQuery(
    () => projectId
      ? db.reviewArticles.where('projectId').equals(projectId).toArray()
      : [],
    [projectId],
    [],
  )

  // Live query project for synthesis result
  const project = useLiveQuery(
    () => projectId ? db.reviewProjects.get(projectId) : undefined,
    [projectId],
  )

  // Parse synthesis result
  const synthesisResult = useMemo((): SynthesisResult | null => {
    if (!project?.synthesisResult) return null
    try { return JSON.parse(project.synthesisResult) } catch { return null }
  }, [project?.synthesisResult])

  // Extract all themes
  const themes = useMemo(() => {
    if (!synthesisResult?.themes) return []
    return synthesisResult.themes.map(t => t.name)
  }, [synthesisResult])

  // Filter and sort articles
  const articles = useMemo(() => {
    let filtered = [...(allArticles ?? [])]

    // Filter by decision
    if (filterDecision !== 'all') {
      filtered = filtered.filter(a => a.decision === filterDecision)
    }

    // Filter by theme
    if (filterTheme && synthesisResult) {
      const theme = synthesisResult.themes.find(t => t.name === filterTheme)
      if (theme) {
        const themeArticleIds = new Set(theme.articleIds)
        filtered = filtered.filter(a => themeArticleIds.has(a.id))
      }
    }

    // Search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(a => {
        let analysis: { summary?: string; keyFindings?: string[]; themes?: string[] } = {}
        try { analysis = a.aiAnalysis ? JSON.parse(a.aiAnalysis) : {} } catch { /* ignore corrupt */ }
        const searchable = [
          analysis.summary ?? '',
          ...(analysis.keyFindings ?? []),
          ...(analysis.themes ?? []),
          a.userNotes ?? '',
        ].join(' ').toLowerCase()
        return searchable.includes(query)
      })
    }

    // Sort
    filtered.sort((a, b) => {
      const aVal = a[sortBy] ?? 0
      const bVal = b[sortBy] ?? 0
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      }
      return sortAsc ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number)
    })

    return filtered
  }, [allArticles, filterDecision, filterTheme, searchQuery, sortBy, sortAsc, synthesisResult])

  // Stats
  const stats = useMemo(() => {
    const all = allArticles ?? []
    return {
      total: all.length,
      shortlisted: all.filter(a => a.decision === 'shortlisted').length,
      maybe: all.filter(a => a.decision === 'maybe').length,
      rejected: all.filter(a => a.decision === 'rejected').length,
      pending: all.filter(a => a.decision === 'pending').length,
    }
  }, [allArticles])

  // Actions
  const updateDecision = useCallback(async (articleId: string, decision: ArticleDecision) => {
    await db.reviewArticles.update(articleId, { decision, updatedAt: new Date().toISOString() })
  }, [])

  const updateScore = useCallback(async (articleId: string, score: number) => {
    await db.reviewArticles.update(articleId, { userScore: score, updatedAt: new Date().toISOString() })
  }, [])

  const updateNotes = useCallback(async (articleId: string, notes: string) => {
    await db.reviewArticles.update(articleId, { userNotes: notes, updatedAt: new Date().toISOString() })
  }, [])

  const exportShortlist = useCallback((): string => {
    const shortlisted = (allArticles ?? []).filter(a => a.decision === 'shortlisted' || a.decision === 'maybe')

    const lines = [
      `# Article Review Shortlist`,
      `**Project:** ${project?.name ?? ''}`,
      `**Exported:** ${new Date().toLocaleDateString()}`,
      `**Total shortlisted:** ${shortlisted.length}`,
      '',
    ]

    for (const article of shortlisted) {
      let analysis: { summary?: string; keyFindings?: string[] } = {}
      try { analysis = article.aiAnalysis ? JSON.parse(article.aiAnalysis) : {} } catch { /* ignore */ }

      lines.push(`## ${article.decision === 'shortlisted' ? '[Shortlisted]' : '[Pending]'} Article`)
      lines.push('')
      lines.push(`- **Decision:** ${article.decision}`)
      lines.push(`- **Composite Score:** ${article.compositeScore?.toFixed(2) ?? 'N/A'}`)
      lines.push(`- **Relevance:** ${article.relevanceScore ?? 'N/A'}/5 | **Novelty:** ${article.noveltyScore ?? 'N/A'}/5 | **Quality:** ${article.qualityScore ?? 'N/A'}/5`)
      if (article.userScore) lines.push(`- **User Score:** ${article.userScore}/5`)
      lines.push('')
      if (analysis.summary) lines.push(`**Summary:** ${analysis.summary}`)
      if (analysis.keyFindings?.length) {
        lines.push('')
        lines.push('**Key Findings:**')
        for (const f of analysis.keyFindings) lines.push(`- ${f}`)
      }
      if (article.userNotes) {
        lines.push('')
        lines.push(`**Notes:** ${article.userNotes}`)
      }
      lines.push('')
      lines.push('---')
      lines.push('')
    }

    return lines.join('\n')
  }, [allArticles, project])

  return {
    articles,
    allArticles: allArticles ?? [],
    stats,
    themes,
    synthesisResult,
    project,

    sortBy, setSortBy,
    sortAsc, setSortAsc,
    filterDecision, setFilterDecision,
    filterTheme, setFilterTheme,
    searchQuery, setSearchQuery,

    updateDecision,
    updateScore,
    updateNotes,
    exportShortlist,
  }
}
