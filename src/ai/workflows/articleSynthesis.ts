/**
 * Cross-article synthesis workflow — runs once after all articles are processed.
 * Clusters articles into themes, produces comparative ranking.
 */
import { db } from '../../db'
import { llmJsonStep, localStep } from '../orchestrator/steps'
import type { WorkflowDefinition, WorkflowContext } from '../orchestrator/types'

export interface SynthesisResult {
  themes: Array<{ name: string; articleIds: string[]; description: string }>
  ranking: Array<{ articleId: string; rank: number; rationale: string }>
}

interface SynthesisConfig {
  projectId: string
}

export function createArticleSynthesisWorkflow(
  config: SynthesisConfig,
): WorkflowDefinition<SynthesisResult> {
  return {
    id: `article-synthesis-${config.projectId}`,
    name: 'Synthesizing article reviews',
    steps: [
      // Step 1: Load all analyzed articles
      localStep('load-articles', 'Loading article summaries', async () => {
        const articles = await db.reviewArticles
          .where('projectId')
          .equals(config.projectId)
          .filter(a => a.processingStatus === 'done')
          .toArray()

        const project = await db.reviewProjects.get(config.projectId)

        return {
          projectDescription: project?.description ?? '',
          articles: articles.map(a => {
            let analysis: { summary?: string; themes?: string[]; keyFindings?: string[] } = {}
            try { analysis = a.aiAnalysis ? JSON.parse(a.aiAnalysis) : {} } catch { /* ignore */ }
            return {
              id: a.id,
              documentId: a.documentId,
              summary: analysis.summary ?? '',
              themes: analysis.themes ?? [],
              keyFindings: analysis.keyFindings ?? [],
              noveltyScore: a.noveltyScore ?? 0,
              relevanceScore: a.relevanceScore ?? 0,
              qualityScore: a.qualityScore ?? 0,
              compositeScore: a.compositeScore ?? 0,
            }
          }),
        }
      }),

      // Step 2: Theme clustering
      llmJsonStep<{
        themes: Array<{ name: string; articleIds: string[]; description: string }>
      }>('cluster-themes', 'Identifying themes across articles', (ctx) => {
        const data = ctx.results['load-articles']?.data as {
          projectDescription: string
          articles: Array<{ id: string; summary: string; themes: string[]; keyFindings: string[] }>
        }

        const articleSummaries = data.articles.map((a, i) =>
          `Article ${i + 1} (ID: ${a.id}):\nSummary: ${a.summary}\nThemes: ${a.themes.join(', ')}\nKey Findings: ${a.keyFindings.slice(0, 3).join('; ')}`
        ).join('\n\n---\n\n')

        return `Cluster these ${data.articles.length} articles into 3-10 thematic groups.

Project criteria: ${data.projectDescription}

${articleSummaries}

Return JSON:
{
  "themes": [
    {
      "name": "Theme name",
      "articleIds": ["id1", "id2"],
      "description": "What unifies these articles under this theme"
    }
  ]
}

An article can appear in multiple themes. Respond ONLY with valid JSON.`
      }, 'You are an academic synthesis expert. Identify overarching themes across a corpus of articles.'),

      // Step 3: Comparative ranking
      llmJsonStep<{
        ranking: Array<{ articleId: string; rank: number; rationale: string }>
      }>('rank-articles', 'Ranking articles', (ctx) => {
        const data = ctx.results['load-articles']?.data as {
          projectDescription: string
          articles: Array<{
            id: string; summary: string; compositeScore: number
            noveltyScore: number; relevanceScore: number; qualityScore: number
          }>
        }

        const articleList = data.articles.map((a, i) =>
          `Article ${i + 1} (ID: ${a.id}):\nSummary: ${a.summary}\nScores — Relevance: ${a.relevanceScore}/5, Novelty: ${a.noveltyScore}/5, Quality: ${a.qualityScore}/5, Composite: ${a.compositeScore}`
        ).join('\n\n---\n\n')

        return `Rank these ${data.articles.length} articles by overall value for the review project.

Project criteria: ${data.projectDescription}

${articleList}

Return JSON:
{
  "ranking": [
    { "articleId": "id", "rank": 1, "rationale": "Why this article ranks here" }
  ]
}

Rank from 1 (best) to ${data.articles.length} (least relevant). Consider relevance, novelty, and quality. Respond ONLY with valid JSON.`
      }, 'You are an academic reviewer. Produce a comparative ranking of articles for a literature review.'),

      // Step 4: Save synthesis
      localStep('save-synthesis', 'Saving synthesis results', async (ctx: WorkflowContext) => {
        const themes = (ctx.results['cluster-themes']?.data as { themes: SynthesisResult['themes'] })?.themes ?? []
        const ranking = (ctx.results['rank-articles']?.data as { ranking: SynthesisResult['ranking'] })?.ranking ?? []

        const synthesisResult: SynthesisResult = { themes, ranking }

        await db.reviewProjects.update(config.projectId, {
          synthesisResult: JSON.stringify(synthesisResult),
          status: 'reviewing',
          updatedAt: new Date().toISOString(),
        })

        return synthesisResult
      }),
    ],

    aggregate(ctx) {
      const result = ctx.results['save-synthesis']?.data as SynthesisResult | undefined
      return result ?? { themes: [], ranking: [] }
    },
  }
}
