/**
 * Document exam generation workflow — Type B (CPGE concours-style).
 *
 * 4-step pipeline:
 * 1. Gather context (DB) — student mastery, topics, sources
 * 2. Search documents (optional) — semantic search for source grounding
 * 3. Generate document — one LLM call, full Markdown+LaTeX exam
 * 4. Generate solutions — model answers + marking schemes per question
 *
 * Output is stored on PracticeExamSession as documentContent + documentModelAnswers,
 * NOT as GeneratedQuestion rows (the document is one continuous piece, not independent questions).
 */
import { db } from '../../db'
import { dbQueryStep } from '../orchestrator/steps'
import type { WorkflowDefinition, WorkflowContext } from '../orchestrator/types'
import { getKnowledgeGraph, getWeakTopicsTool, getErrorPatterns } from '../tools/knowledgeState'
import { hybridSearch } from '../../lib/hybridSearch'
import { streamChat } from '../client'
import { buildDocumentExamPrompt, buildSolutionPrompt } from '../prompts/documentExamPrompts'
import type { DocumentExamSubject, ConcoursType } from '../prompts/documentExamPrompts'
import { parseExamDocument } from '../../lib/examDocumentParser'

// ─── Config ─────────────────────────────────────────────────────

export interface DocumentExamConfig {
  sessionId: string
  subject: DocumentExamSubject
  concours: ConcoursType
  sourcesEnabled: boolean
  timeLimitSeconds?: number
}

// ─── Context types ──────────────────────────────────────────────

interface GatherContextResult {
  profileName: string
  topicsList: string
  topics: string[]
  weakTopics: string
  errorPatterns: string
  documentIds: string[]
  recentThemes: string[]
}

// ─── LLM helper ─────────────────────────────────────────────────

const SOURCE_CONTENT_BUDGET = 40_000 // chars — less than simulation since the prompt itself is large

async function llmMain(prompt: string, system: string, ctx: WorkflowContext, maxTokens = 16384): Promise<string> {
  const response = await streamChat({
    messages: [{ role: 'user', content: prompt }],
    system,
    tools: [],
    maxTokens,
    authToken: ctx.authToken,
    signal: ctx.signal,
  })
  return response.content
    .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
    .map(c => c.text)
    .join('')
}

// ─── Workflow factory ───────────────────────────────────────────

export function createDocumentExamWorkflow(config: DocumentExamConfig): WorkflowDefinition<void> {
  return {
    id: 'document-exam-generation',
    name: 'Generate Document Exam',
    steps: [
      // ── Step 1: Gather context ────────────────────────────────
      dbQueryStep<GatherContextResult>('gatherContext', 'Gathering your study data', async (ctx) => {
        const [profile, subjects, topics] = await Promise.all([
          db.examProfiles.get(ctx.examProfileId),
          db.subjects.where('examProfileId').equals(ctx.examProfileId).sortBy('order'),
          db.topics.where('examProfileId').equals(ctx.examProfileId).toArray(),
        ])

        const [knowledgeGraph, weakTopics, errorPatterns, documents] = await Promise.all([
          getKnowledgeGraph(ctx.examProfileId),
          getWeakTopicsTool(ctx.examProfileId),
          getErrorPatterns(ctx.examProfileId),
          db.documents.where('examProfileId').equals(ctx.examProfileId).toArray(),
        ])

        // Void usage to avoid lint — knowledgeGraph is used for context enrichment
        void knowledgeGraph

        const topicNames = topics.map(t => t.name)
        const documentIds = documents.map(d => d.id)

        // Load recent document exam themes to avoid repetition
        const pastDocExams = await db.practiceExamSessions
          .where('examProfileId').equals(ctx.examProfileId)
          .filter(s => s.examMode === 'document' && !!s.documentContent)
          .toArray()
        const recentThemes = pastDocExams
          .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
          .slice(0, 3)
          .map(s => {
            // Extract title from the first heading in the document
            const match = s.documentContent?.match(/^#\s+(.+)/m)
            return match?.[1] ?? ''
          })
          .filter(Boolean)

        return {
          profileName: profile?.name ?? 'Study Profile',
          topicsList: topicNames.join(', '),
          topics: topicNames,
          weakTopics,
          errorPatterns,
          documentIds,
          recentThemes,
        }
      }),

      // ── Step 2: Search documents (optional) ───────────────────
      {
        id: 'searchDocuments',
        name: 'Searching your study materials',
        optional: true,
        shouldRun: () => config.sourcesEnabled,
        async execute(_input: unknown, ctx: WorkflowContext): Promise<string> {
          const context = ctx.results['gatherContext']?.data as GatherContextResult | undefined
          const topicNames = context?.topics?.slice(0, 6) ?? []
          if (topicNames.length === 0) return ''

          type SearchChunk = Awaited<ReturnType<typeof hybridSearch>>[number] & { query: string }
          const searchResults = await Promise.all(
            topicNames.map(query =>
              hybridSearch(ctx.examProfileId, query, ctx.authToken, { topN: 10, rerank: true })
                .then(chunks => chunks.map(c => ({ ...c, query })))
                .catch((): SearchChunk[] => [])
            )
          )

          const chunkScores = new Map<string, { chunk: SearchChunk; totalScore: number; queries: string[] }>()
          for (const results of searchResults) {
            for (const chunk of results) {
              const existing = chunkScores.get(chunk.id)
              if (existing) {
                existing.totalScore += chunk.score
                if (!existing.queries.includes(chunk.query)) existing.queries.push(chunk.query)
              } else {
                chunkScores.set(chunk.id, { chunk, totalScore: chunk.score, queries: [chunk.query] })
              }
            }
          }

          const ranked = Array.from(chunkScores.values()).sort((a, b) => b.totalScore - a.totalScore)
          let totalChars = 0
          const parts: string[] = []
          for (const entry of ranked) {
            const formatted = `[Source: "${entry.chunk.documentTitle ?? 'Source'}" | Topics: ${entry.queries.join(', ')}]\n${entry.chunk.content}`
            if (totalChars + formatted.length > SOURCE_CONTENT_BUDGET) break
            parts.push(formatted)
            totalChars += formatted.length
          }
          return parts.join('\n\n---\n\n')
        },
      },

      // ── Step 3: Generate exam document ────────────────────────
      {
        id: 'generateDocument',
        name: 'Generating exam document',
        async execute(_input: unknown, ctx: WorkflowContext): Promise<string> {
          const context = ctx.results['gatherContext'].data as GatherContextResult
          const sources = ctx.results['searchDocuments']?.data as string | undefined

          const { system, user } = buildDocumentExamPrompt({
            subject: config.subject,
            concours: config.concours,
            topics: context.topics,
            sourceExcerpts: sources && sources.length > 100 ? sources : undefined,
            avoidThemes: context.recentThemes.length > 0 ? context.recentThemes : undefined,
          })

          ctx.updateProgress?.('Generating exam document (this may take a minute)...')
          const document = await llmMain(user, system, ctx, 16384)

          if (!document || document.trim().length < 200) {
            throw new Error('Generated document is too short. Please try again.')
          }

          // Persist document immediately (checkpoint)
          await db.practiceExamSessions.update(config.sessionId, {
            documentContent: document,
          })

          return document
        },
      },

      // ── Step 4: Generate solutions + marking schemes ──────────
      {
        id: 'generateSolutions',
        name: 'Creating model answers and marking scheme',
        async execute(_input: unknown, ctx: WorkflowContext): Promise<string> {
          const document = ctx.results['generateDocument'].data as string

          const { system, user } = buildSolutionPrompt(document)

          ctx.updateProgress?.('Generating model answers...')
          const raw = await llmMain(user, system, ctx, 16384)

          // Extract JSON array from the response
          let solutionsJson = raw.trim()
          // Try to find JSON array in the response
          const jsonStart = solutionsJson.indexOf('[')
          const jsonEnd = solutionsJson.lastIndexOf(']')
          if (jsonStart >= 0 && jsonEnd > jsonStart) {
            solutionsJson = solutionsJson.slice(jsonStart, jsonEnd + 1)
          }

          // Validate it's parseable
          try {
            JSON.parse(solutionsJson)
          } catch {
            // If parsing fails, try to repair truncated JSON
            if (!solutionsJson.endsWith(']')) {
              // Find last complete object
              const lastBrace = solutionsJson.lastIndexOf('}')
              if (lastBrace > 0) {
                solutionsJson = solutionsJson.slice(0, lastBrace + 1) + ']'
              }
            }
          }

          // Persist solutions
          await db.practiceExamSessions.update(config.sessionId, {
            documentModelAnswers: solutionsJson,
          })

          return solutionsJson
        },
      },
    ],

    // ── Aggregate: mark session ready ─────────────────────────────
    async aggregate(ctx: WorkflowContext): Promise<void> {
      // Verify document was generated
      const session = await db.practiceExamSessions.get(config.sessionId)
      if (!session?.documentContent) {
        throw new Error('Document exam generation failed — no document content.')
      }

      // Count questions using the same parser as the renderer
      const { questionCount } = parseExamDocument(session.documentContent)

      await db.practiceExamSessions.update(config.sessionId, {
        phase: 'ready',
        questionCount,
        timeLimitSeconds: config.timeLimitSeconds,
      })
    },
  }
}
