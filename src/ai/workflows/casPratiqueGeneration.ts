/**
 * Cas pratique / consultation generation workflow — 3 steps:
 * 1. Gather context (DB)
 * 2. Generate scenario + model answer + rubric (single LLM call)
 * 3. Mark session ready
 */
import { db } from '../../db'
import { dbQueryStep, localStep } from '../orchestrator/steps'
import type { WorkflowDefinition, WorkflowContext } from '../orchestrator/types'
import { streamChat } from '../client'
import { buildCasPratiqueGenerationPrompt } from '../prompts/casPratiquePrompts'
import type { CasPratiqueSpecialty } from '../prompts/casPratiquePrompts'

export interface CasPratiqueGenerationConfig {
  sessionId: string
  specialty: CasPratiqueSpecialty
  duration: number // minutes
}

async function llmMain(prompt: string, system: string, ctx: WorkflowContext, maxTokens = 16384): Promise<string> {
  const response = await streamChat({
    messages: [{ id: crypto.randomUUID(), role: 'user', content: prompt }],
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

export function createCasPratiqueGenerationWorkflow(config: CasPratiqueGenerationConfig): WorkflowDefinition<void> {
  return {
    id: 'cas-pratique-generation',
    name: 'Generate Cas Pratique',
    steps: [
      dbQueryStep<{ topics: string[]; avoidThemes: string[] }>('gatherContext', 'Gathering your study data', async (ctx) => {
        const topics = await db.topics.where('examProfileId').equals(ctx.examProfileId).toArray()

        const pastSessions = await db.practiceExamSessions
          .where('examProfileId').equals(ctx.examProfileId)
          .filter(s => s.examMode === 'cas-pratique' && !!s.documentContent)
          .toArray()
        const avoidThemes = pastSessions
          .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
          .slice(0, 3)
          .map(s => s.documentContent?.slice(0, 100) ?? '')
          .filter(Boolean)

        return { topics: topics.map(t => t.name), avoidThemes }
      }),

      {
        id: 'generateScenario',
        name: 'Generating case scenario',
        async execute(_input: unknown, ctx: WorkflowContext): Promise<void> {
          const context = ctx.results['gatherContext'].data as { topics: string[]; avoidThemes: string[] }

          const { system, user } = buildCasPratiqueGenerationPrompt({
            specialty: config.specialty,
            topics: context.topics,
            avoidThemes: context.avoidThemes,
            duration: config.duration,
            // Legacy exam-engine path — no grounding pool wired here. The CRFPA
            // vertical uses `src/ai/coaching/casPratiqueCoach.ts` which enforces
            // a verified pool. This legacy caller remains only for non-CRFPA
            // users accessing the old /practice-exam entry point.
            groundingPool: [],
          })

          ctx.updateProgress?.('Generating case scenario...')
          const raw = await llmMain(user, system, ctx, 16384)

          // Extract JSON
          const jsonStart = raw.indexOf('{')
          const jsonEnd = raw.lastIndexOf('}')
          if (jsonStart < 0 || jsonEnd <= jsonStart) throw new Error('No JSON in response')

          let parsed: { scenario?: string; modelAnswer?: string; rubric?: unknown }
          try {
            parsed = JSON.parse(raw.slice(jsonStart, jsonEnd + 1))
          } catch {
            // Try repair
            let jsonStr = raw.slice(jsonStart, jsonEnd + 1)
            const lastBrace = jsonStr.lastIndexOf('}', jsonStr.length - 2)
            if (lastBrace > 0) {
              jsonStr = jsonStr.slice(0, lastBrace + 1) + '}'
              parsed = JSON.parse(jsonStr)
            } else {
              throw new Error('Failed to parse scenario JSON')
            }
          }

          if (!parsed.scenario) throw new Error('No scenario in response')

          await db.practiceExamSessions.update(config.sessionId, {
            documentContent: parsed.scenario,
            synthesisModelAnswer: parsed.modelAnswer ?? '',
            synthesisRubric: parsed.rubric ? JSON.stringify(parsed.rubric) : undefined,
          })
        },
      },

      localStep('markReady', 'Finalizing', async () => {
        await db.practiceExamSessions.update(config.sessionId, {
          phase: 'ready',
          timeLimitSeconds: config.duration * 60,
        })
      }),
    ],

    async aggregate(): Promise<void> {},
  }
}
