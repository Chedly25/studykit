/**
 * Chat tools for article review — search, compare, summarize.
 */
import { db } from '../../db'
import { hybridSearch } from '../../lib/hybridSearch'

export async function searchReviewArticles(
  examProfileId: string,
  input: { query: string; projectId?: string },
  authToken?: string,
): Promise<string> {
  // Get review articles scoped to project if provided
  let documentIds: string[] = []
  if (input.projectId) {
    const articles = await db.reviewArticles
      .where('projectId')
      .equals(input.projectId)
      .toArray()
    documentIds = articles.filter(a => a.documentId).map(a => a.documentId)
  } else {
    const articles = await db.reviewArticles
      .where('examProfileId')
      .equals(examProfileId)
      .toArray()
    documentIds = articles.filter(a => a.documentId).map(a => a.documentId)
  }

  if (documentIds.length === 0) {
    return JSON.stringify({ results: [], message: 'No review articles found.' })
  }

  // Semantic search across project documents
  const results = await hybridSearch(examProfileId, input.query, authToken, { topN: 10 })
  const projectResults = results.filter(r => documentIds.includes(r.documentId))

  return JSON.stringify({
    results: projectResults.slice(0, 5).map(r => ({
      documentTitle: r.documentTitle,
      content: r.content,
      score: Math.round(r.score * 1000) / 1000,
    })),
  })
}

export async function getArticleComparison(
  examProfileId: string,
  input: { articleIds: string[] },
): Promise<string> {
  if (!input.articleIds || input.articleIds.length < 2) {
    return JSON.stringify({ error: 'Provide at least 2 article IDs to compare.' })
  }

  const articles = await db.reviewArticles
    .where('id')
    .anyOf(input.articleIds)
    .toArray()

  const filtered = articles.filter(a => a.examProfileId === examProfileId)

  const comparison = filtered.map(a => {
    let analysis: Record<string, unknown> = {}
    let research: Record<string, unknown> = {}
    try { analysis = a.aiAnalysis ? JSON.parse(a.aiAnalysis) : {} } catch { /* ignore */ }
    try { research = a.researchContext ? JSON.parse(a.researchContext) : {} } catch { /* ignore */ }

    return {
      articleId: a.id,
      decision: a.decision,
      scores: {
        relevance: a.relevanceScore,
        novelty: a.noveltyScore,
        quality: a.qualityScore,
        composite: a.compositeScore,
        userScore: a.userScore,
      },
      analysis,
      research,
      userNotes: a.userNotes,
    }
  })

  return JSON.stringify({ comparison })
}

export async function getReviewProjectSummary(
  examProfileId: string,
  input: { projectId: string },
): Promise<string> {
  const project = await db.reviewProjects.get(input.projectId)
  if (!project || project.examProfileId !== examProfileId) {
    return JSON.stringify({ error: 'Project not found.' })
  }

  const articles = await db.reviewArticles
    .where('projectId')
    .equals(input.projectId)
    .toArray()

  const stats = {
    total: articles.length,
    shortlisted: articles.filter(a => a.decision === 'shortlisted').length,
    maybe: articles.filter(a => a.decision === 'maybe').length,
    rejected: articles.filter(a => a.decision === 'rejected').length,
    pending: articles.filter(a => a.decision === 'pending').length,
    processed: articles.filter(a => a.processingStatus === 'done').length,
    failed: articles.filter(a => a.processingStatus === 'failed').length,
  }

  let synthesis = null
  try { synthesis = project.synthesisResult ? JSON.parse(project.synthesisResult) : null } catch { /* ignore */ }

  return JSON.stringify({
    project: {
      name: project.name,
      description: project.description,
      deadline: project.deadline,
      status: project.status,
      targetShortlistCount: project.targetShortlistCount,
    },
    stats,
    synthesis,
  })
}
