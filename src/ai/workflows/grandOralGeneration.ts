/**
 * Grand Oral topic generation workflow — 2 steps:
 * 1. Gather context (DB)
 * 2. Generate topic + model plan + subsidiary questions (single LLM call)
 */
import { db } from '../../db'
import { dbQueryStep } from '../orchestrator/steps'
import type { WorkflowDefinition, WorkflowContext } from '../orchestrator/types'
import { streamChat } from '../client'
import { buildGrandOralGenerationPrompt } from '../prompts/grandOralPrompts'

export interface GrandOralGenerationConfig {
  sessionId: string
}

async function llmMain(prompt: string, system: string, ctx: WorkflowContext, maxTokens = 8192): Promise<string> {
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

export function createGrandOralGenerationWorkflow(config: GrandOralGenerationConfig): WorkflowDefinition<void> {
  return {
    id: 'grand-oral-generation',
    name: 'Generate Grand Oral Topic',
    steps: [
      dbQueryStep<{ topics: string[]; avoidTopics: string[] }>('gatherContext', 'Gathering your study data', async (ctx) => {
        const topics = await db.topics.where('examProfileId').equals(ctx.examProfileId).toArray()

        const pastSessions = await db.practiceExamSessions
          .where('examProfileId').equals(ctx.examProfileId)
          .filter(s => s.examMode === 'grand-oral' && !!s.documentContent)
          .toArray()
        const avoidTopics = pastSessions
          .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
          .slice(0, 5)
          .map(s => s.documentContent ?? '')
          .filter(Boolean)

        return { topics: topics.map(t => t.name), avoidTopics }
      }),

      {
        id: 'generateTopic',
        name: 'Generating Grand Oral topic',
        async execute(_input: unknown, ctx: WorkflowContext): Promise<void> {
          const context = ctx.results['gatherContext'].data as { topics: string[]; avoidTopics: string[] }

          const { system, user } = buildGrandOralGenerationPrompt({
            topics: context.topics,
            avoidTopics: context.avoidTopics,
          })

          ctx.updateProgress?.('Generating topic...')
          const raw = await llmMain(user, system, ctx, 4096)

          const jsonStart = raw.indexOf('{')
          const jsonEnd = raw.lastIndexOf('}')
          if (jsonStart < 0 || jsonEnd <= jsonStart) throw new Error('No JSON in response')

          let parsed: { topic?: string; context?: string; expectedPlan?: unknown; keyPoints?: string[]; subsidiaryQuestions?: string[] }
          try {
            parsed = JSON.parse(raw.slice(jsonStart, jsonEnd + 1))
          } catch {
            throw new Error('Failed to parse topic JSON')
          }

          if (!parsed.topic) throw new Error('No topic in response')

          // Store topic in documentContent, model plan in synthesisModelAnswer
          const topicDisplay = parsed.context
            ? `${parsed.topic}\n\n${parsed.context}`
            : parsed.topic

          const modelContent = JSON.stringify({
            expectedPlan: parsed.expectedPlan,
            keyPoints: parsed.keyPoints,
            subsidiaryQuestions: parsed.subsidiaryQuestions,
          })

          await db.practiceExamSessions.update(config.sessionId, {
            phase: 'ready',
            documentContent: topicDisplay,
            synthesisModelAnswer: modelContent,
            timeLimitSeconds: 3600, // 1h prep
          })
        },
      },
    ],

    async aggregate(): Promise<void> {},
  }
}
