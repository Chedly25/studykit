/**
 * Note de synthèse generation workflow — 5-agent agentic pipeline:
 *
 * 1. Theme Architect — picks theme, designs dossier blueprint
 * 2. Document Generators — generates 15-18 legal documents (parallel)
 * 3. Coherence Reviewer — validates cross-references and fixes inconsistencies
 * 4. Model Synthesis Writer — writes the ideal 4-page synthesis
 * 5. Grading Rubric Builder — creates evaluation criteria
 *
 * Output is stored on PracticeExamSession as dossierContent + synthesisModelAnswer + synthesisRubric.
 */
import { db } from '../../db'
import { dbQueryStep } from '../orchestrator/steps'
import type { WorkflowDefinition, WorkflowContext } from '../orchestrator/types'
import { streamChat } from '../client'
import {
  buildThemeArchitectPrompt,
  buildDocumentGeneratorPrompt,
  buildCoherenceReviewerPrompt,
  buildModelSynthesisPrompt,
  buildGradingRubricPrompt,
} from '../prompts/synthesePrompts'
import type { DossierBlueprint, DossierDocument } from '../prompts/synthesePrompts'

// ─── Config ─────────────────────────────────────────────────────

export interface SyntheseGenerationConfig {
  sessionId: string
  sourcesEnabled: boolean
}

// ─── LLM helper ─────────────────────────────────────────────────

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

function extractJson<T>(raw: string): T {
  const start = raw.indexOf('{') < raw.indexOf('[')
    ? (raw.indexOf('{') >= 0 ? raw.indexOf('{') : raw.indexOf('['))
    : (raw.indexOf('[') >= 0 ? raw.indexOf('[') : raw.indexOf('{'))
  const isArray = raw[start] === '['
  const end = isArray ? raw.lastIndexOf(']') : raw.lastIndexOf('}')
  if (start < 0 || end < 0) throw new Error('No JSON found in response')
  let jsonStr = raw.slice(start, end + 1)
  try {
    return JSON.parse(jsonStr)
  } catch {
    // Try to repair truncated JSON
    const closingChar = isArray ? ']' : '}'
    const lastComplete = jsonStr.lastIndexOf(isArray ? '}' : '}')
    if (lastComplete > 0) {
      jsonStr = jsonStr.slice(0, lastComplete + 1) + closingChar
      return JSON.parse(jsonStr)
    }
    throw new Error('Failed to parse JSON from response')
  }
}

// ─── Workflow factory ───────────────────────────────────────────

export function createSyntheseGenerationWorkflow(config: SyntheseGenerationConfig): WorkflowDefinition<void> {
  return {
    id: 'synthesis-generation',
    name: 'Generate Note de Synthèse',
    steps: [
      // ── Step 1: Gather context ────────────────────────────────
      dbQueryStep<{ topics: string[]; avoidThemes: string[] }>('gatherContext', 'Gathering your study data', async (ctx) => {
        const topics = await db.topics.where('examProfileId').equals(ctx.examProfileId).toArray()
        const topicNames = topics.map(t => t.name)

        // Load recent synthesis themes to avoid repetition
        const pastSessions = await db.practiceExamSessions
          .where('examProfileId').equals(ctx.examProfileId)
          .filter(s => s.examMode === 'synthesis' && !!s.dossierBlueprint)
          .toArray()
        const avoidThemes = pastSessions
          .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
          .slice(0, 3)
          .map(s => {
            try { return (JSON.parse(s.dossierBlueprint!) as DossierBlueprint).theme } catch { return '' }
          })
          .filter(Boolean)

        return { topics: topicNames, avoidThemes }
      }),

      // ── Step 2: Theme Architect ───────────────────────────────
      {
        id: 'themeArchitect',
        name: 'Designing dossier blueprint',
        async execute(_input: unknown, ctx: WorkflowContext): Promise<DossierBlueprint> {
          const context = ctx.results['gatherContext'].data as { topics: string[]; avoidThemes: string[] }

          const { system, user } = buildThemeArchitectPrompt({
            topics: context.topics,
            avoidThemes: context.avoidThemes,
          })

          ctx.updateProgress?.('Designing the dossier theme and structure...')
          const raw = await llmMain(user, system, ctx, 8192)
          const blueprint = extractJson<DossierBlueprint>(raw)

          // Validate blueprint
          if (!blueprint.theme || !blueprint.documents || blueprint.documents.length < 10) {
            throw new Error(`Blueprint has only ${blueprint.documents?.length ?? 0} documents. Expected 15-18.`)
          }

          // Persist blueprint
          await db.practiceExamSessions.update(config.sessionId, {
            dossierBlueprint: JSON.stringify(blueprint),
          })

          return blueprint
        },
      },

      // ── Step 3: Document Generators (sequential with batching) ─
      {
        id: 'documentGenerators',
        name: 'Generating dossier documents',
        async execute(_input: unknown, ctx: WorkflowContext): Promise<DossierDocument[]> {
          const blueprint = ctx.results['themeArchitect'].data as DossierBlueprint
          const documents: DossierDocument[] = []

          // Generate documents in parallel batches of 5 to avoid overwhelming the API
          const batchSize = 5
          for (let i = 0; i < blueprint.documents.length; i += batchSize) {
            const batch = blueprint.documents.slice(i, i + batchSize)
            ctx.updateProgress?.(`Generating documents ${i + 1}-${Math.min(i + batchSize, blueprint.documents.length)} of ${blueprint.documents.length}...`)

            const batchResults = await Promise.all(
              batch.map(async (docSpec) => {
                const { system, user } = buildDocumentGeneratorPrompt(blueprint, docSpec)
                try {
                  const content = await llmMain(user, system, ctx, 4096)
                  return {
                    docNumber: docSpec.docNumber,
                    title: docSpec.title,
                    type: docSpec.type,
                    content: content.trim(),
                  }
                } catch {
                  // Retry once on failure
                  try {
                    const content = await llmMain(user, system, ctx, 4096)
                    return {
                      docNumber: docSpec.docNumber,
                      title: docSpec.title,
                      type: docSpec.type,
                      content: content.trim(),
                    }
                  } catch {
                    return {
                      docNumber: docSpec.docNumber,
                      title: docSpec.title,
                      type: docSpec.type,
                      content: `[Document ${docSpec.docNumber} — génération échouée]`,
                    }
                  }
                }
              })
            )

            documents.push(...batchResults)
          }

          // Sort by document number
          documents.sort((a, b) => a.docNumber - b.docNumber)

          // Persist documents immediately
          await db.practiceExamSessions.update(config.sessionId, {
            dossierContent: JSON.stringify(documents),
          })

          return documents
        },
      },

      // ── Step 4: Coherence Reviewer ────────────────────────────
      {
        id: 'coherenceReviewer',
        name: 'Reviewing dossier coherence',
        async execute(_input: unknown, ctx: WorkflowContext): Promise<DossierDocument[]> {
          const blueprint = ctx.results['themeArchitect'].data as DossierBlueprint
          const documents = ctx.results['documentGenerators'].data as DossierDocument[]

          const { system, user } = buildCoherenceReviewerPrompt(blueprint, documents)

          ctx.updateProgress?.('Reviewing cross-references and coherence...')
          const raw = await llmMain(user, system, ctx, 16384)

          let reviewed: DossierDocument[]
          try {
            reviewed = extractJson<DossierDocument[]>(raw)
            // Validate that we got back all documents
            if (reviewed.length < documents.length * 0.8) {
              // Reviewer returned too few documents — use originals
              reviewed = documents
            }
          } catch {
            // If parsing fails, keep original documents
            reviewed = documents
          }

          // Persist reviewed documents
          await db.practiceExamSessions.update(config.sessionId, {
            dossierContent: JSON.stringify(reviewed),
          })

          return reviewed
        },
      },

      // ── Step 5: Model Synthesis Writer ────────────────────────
      {
        id: 'modelSynthesisWriter',
        name: 'Writing model synthesis',
        async execute(_input: unknown, ctx: WorkflowContext): Promise<string> {
          const blueprint = ctx.results['themeArchitect'].data as DossierBlueprint
          const documents = ctx.results['coherenceReviewer'].data as DossierDocument[]

          const { system, user } = buildModelSynthesisPrompt(blueprint, documents)

          ctx.updateProgress?.('Writing the model synthesis...')
          const synthesis = await llmMain(user, system, ctx, 8192)

          // Persist
          await db.practiceExamSessions.update(config.sessionId, {
            synthesisModelAnswer: synthesis.trim(),
          })

          return synthesis.trim()
        },
      },

      // ── Step 6: Grading Rubric Builder ────────────────────────
      {
        id: 'gradingRubricBuilder',
        name: 'Creating grading rubric',
        async execute(_input: unknown, ctx: WorkflowContext): Promise<string> {
          const blueprint = ctx.results['themeArchitect'].data as DossierBlueprint
          const documents = ctx.results['coherenceReviewer'].data as DossierDocument[]
          const modelSynthesis = ctx.results['modelSynthesisWriter'].data as string

          const { system, user } = buildGradingRubricPrompt(blueprint, documents, modelSynthesis)

          ctx.updateProgress?.('Building grading rubric...')
          const raw = await llmMain(user, system, ctx, 4096)

          let rubricJson: string
          try {
            const rubric = extractJson<Record<string, unknown>>(raw)
            rubricJson = JSON.stringify(rubric)
          } catch {
            // Fallback rubric
            rubricJson = JSON.stringify({
              criteria: [
                { criterion: 'Citation de tous les documents', points: 4 },
                { criterion: 'Plan structuré (I/A, I/B, II/A, II/B)', points: 3 },
                { criterion: 'Problématique pertinente', points: 2 },
                { criterion: 'Qualité de la synthèse', points: 4 },
                { criterion: 'Neutralité', points: 2 },
                { criterion: 'Respect de la limite de 4 pages', points: 1 },
                { criterion: 'Qualité rédactionnelle', points: 2 },
                { criterion: 'Équilibre entre les parties', points: 2 },
              ],
              totalPoints: 20,
              documentCoverageMap: {},
            })
          }

          // Persist
          await db.practiceExamSessions.update(config.sessionId, {
            synthesisRubric: rubricJson,
          })

          return rubricJson
        },
      },
    ],

    // ── Aggregate: mark session ready ─────────────────────────────
    async aggregate(): Promise<void> {
      const session = await db.practiceExamSessions.get(config.sessionId)
      if (!session?.dossierContent) {
        throw new Error('Synthesis generation failed — no dossier content.')
      }

      let docCount = 0
      try {
        const docs = JSON.parse(session.dossierContent) as DossierDocument[]
        docCount = docs.length
      } catch { /* ignore */ }

      await db.practiceExamSessions.update(config.sessionId, {
        phase: 'ready',
        questionCount: docCount, // Store doc count as question count for display purposes
        timeLimitSeconds: 5 * 3600, // 5 hours
      })
    },
  }
}
