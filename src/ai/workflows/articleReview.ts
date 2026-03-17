/**
 * Per-article review workflow — ingest PDF, AI analysis, optional web research, save results.
 * Reuses existing document pipeline (parsePdf, chunkText, embeddings).
 */
import { db } from '../../db'
import { parsePdf } from '../../lib/pdfParser'
import { chunkText, createDocument, saveChunks } from '../../lib/sources'
import { embedAndStoreChunks } from '../../lib/embeddings'
import { llmJsonStep, localStep } from '../orchestrator/steps'
import type { WorkflowDefinition, WorkflowContext } from '../orchestrator/types'

export interface ArticleReviewResult {
  documentId: string
  articleId: string
  title: string
  summary: string
  compositeScore: number
}

interface ArticleReviewConfig {
  file: File
  articleId: string
  projectId: string
  projectDescription: string
  examProfileId: string
}

export function createArticleReviewWorkflow(
  config: ArticleReviewConfig,
): WorkflowDefinition<ArticleReviewResult> {
  return {
    id: `article-review-${config.articleId}`,
    name: `Reviewing ${config.file.name}`,
    steps: [
      // Step 1: Ingest — parse PDF, chunk, store document, embed
      localStep('ingest', 'Parsing and indexing PDF', async (ctx: WorkflowContext) => {
        // Update article status
        await db.reviewArticles.update(config.articleId, { processingStatus: 'ingesting' })

        try {
          // Parse PDF
          const { text, pageCount } = await parsePdf(config.file)
          const title = config.file.name.replace(/\.pdf$/i, '')

          // Create document in existing pipeline
          const doc = await createDocument(config.examProfileId, title, 'pdf', text)

          // Chunk and save
          const chunks = chunkText(text)
          const savedChunks = await saveChunks(doc.id, config.examProfileId, chunks)

          // Embed for semantic search (optional — don't fail the pipeline)
          try {
            await embedAndStoreChunks(savedChunks, ctx.authToken)
          } catch {
            // Embedding failure is non-fatal
          }

          // Link article to document
          await db.reviewArticles.update(config.articleId, {
            documentId: doc.id,
            processingStatus: 'analyzing',
          })

          // Return first ~15k chars for analysis
          const fullText = text.slice(0, 15000)

          return { documentId: doc.id, title, fullText, pageCount, chunkCount: savedChunks.length }
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Ingestion failed'
          await db.reviewArticles.update(config.articleId, {
            processingStatus: 'failed',
            processingError: message,
            updatedAt: new Date().toISOString(),
          })
          throw err
        }
      }),

      // Step 2: AI Analysis — structured evaluation
      llmJsonStep<{
        summary: string
        keyFindings: string[]
        methodology: string
        themes: string[]
        notableQuotes: string[]
        noveltyScore: number
        noveltyJustification: string
        relevanceScore: number
        relevanceJustification: string
        qualityScore: number
        qualityJustification: string
      }>('analysis', 'Analyzing article content', (ctx) => {
        const ingestData = ctx.results['ingest']?.data as {
          title: string
          fullText: string
        }

        return `Evaluate this academic article and return a structured JSON assessment.

Article: "${ingestData.title}"

Review Criteria / Project Description:
${config.projectDescription}

Article Text:
${ingestData.fullText}

Return JSON with these exact fields:
{
  "summary": "3-5 sentence executive summary of the article",
  "keyFindings": ["finding 1", "finding 2", ...],
  "methodology": "Brief description of research methodology used",
  "themes": ["theme1", "theme2", ...],
  "notableQuotes": ["relevant quote 1", ...],
  "noveltyScore": <1-5>,
  "noveltyJustification": "Why this novelty score",
  "relevanceScore": <1-5>,
  "relevanceJustification": "Why this relevance score, relative to the review criteria",
  "qualityScore": <1-5>,
  "qualityJustification": "Why this quality score"
}

Score rubric:
1 = Very Low, 2 = Low, 3 = Moderate, 4 = High, 5 = Very High

Respond ONLY with valid JSON.`
      }, 'You are an expert academic article evaluator. Provide rigorous, evidence-based assessments.'),

      // Step 3: Web Research — optional enrichment
      {
        id: 'research',
        name: 'Researching article context',
        optional: true,
        async execute(_input: unknown, ctx: WorkflowContext) {
          const ingestData = ctx.results['ingest']?.data as { title: string }
          const analysisData = ctx.results['analysis']?.data as {
            keyFindings: string[]
          } | undefined

          await db.reviewArticles.update(config.articleId, { processingStatus: 'researching' })

          // Search for article context
          const searchQuery = `${ingestData.title} academic paper`
          const webResults = await ctx.searchWeb(searchQuery)

          if (!webResults) return null

          // Synthesize research context
          const keyFindings = analysisData?.keyFindings?.slice(0, 3).join('; ') ?? ''
          const prompt = `Based on web search results about this article, provide structured context.

Article: "${ingestData.title}"
Key findings: ${keyFindings}

Web search results:
${webResults}

Return JSON:
{
  "authorCredentials": "What is known about the authors",
  "citationInfo": "Citation count, journal impact if available",
  "relatedWork": ["related paper or context 1", ...],
  "journalInfo": "Journal name, reputation if identifiable"
}

If information is not available, use "Not available" for string fields or empty arrays. Respond ONLY with valid JSON.`

          const text = await ctx.llm(prompt, 'You are an academic research assistant. Synthesize web information about scholarly articles.')
          const jsonMatch = text.match(/\{[\s\S]*\}/)
          if (!jsonMatch) return null
          return JSON.parse(jsonMatch[0])
        },
      },

      // Step 4: Save results
      localStep('save-results', 'Saving analysis results', async (ctx: WorkflowContext) => {
        const ingestData = ctx.results['ingest']?.data as {
          documentId: string
          title: string
        }
        const analysisData = ctx.results['analysis']?.data as {
          summary: string
          noveltyScore: number
          relevanceScore: number
          qualityScore: number
        } | undefined
        const researchData = ctx.results['research']?.data as Record<string, unknown> | null | undefined

        const novelty = analysisData?.noveltyScore ?? 3
        const relevance = analysisData?.relevanceScore ?? 3
        const quality = analysisData?.qualityScore ?? 3
        const compositeScore = Math.round((relevance * 0.5 + novelty * 0.3 + quality * 0.2) * 100) / 100

        await db.reviewArticles.update(config.articleId, {
          processingStatus: 'done',
          aiAnalysis: analysisData ? JSON.stringify(analysisData) : undefined,
          noveltyScore: novelty,
          relevanceScore: relevance,
          qualityScore: quality,
          compositeScore,
          researchContext: researchData ? JSON.stringify(researchData) : undefined,
          updatedAt: new Date().toISOString(),
        })

        return {
          documentId: ingestData.documentId,
          articleId: config.articleId,
          title: ingestData.title,
          summary: analysisData?.summary ?? '',
          compositeScore,
        }
      }),
    ],

    aggregate(ctx) {
      const result = ctx.results['save-results']?.data as ArticleReviewResult | undefined
      return result ?? {
        documentId: '',
        articleId: config.articleId,
        title: config.file.name,
        summary: '',
        compositeScore: 0,
      }
    },
  }
}
