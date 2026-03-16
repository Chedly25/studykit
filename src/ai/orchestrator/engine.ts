/**
 * Orchestrator engine — runs multi-step AI workflows sequentially,
 * reporting progress at the step level (no token streaming to UI).
 */
import { streamChat } from '../client'
import { searchChunks } from '../../lib/sources'
import { searchWeb as searchWebClient } from '../tools/webSearchTool'
import type {
  WorkflowContext,
  WorkflowDefinition,
  WorkflowProgress,
  WorkflowResult,
  StepResult,
} from './types'

export interface RunWorkflowConfig {
  examProfileId: string
  authToken: string
  signal?: AbortSignal
}

export interface WorkflowCallbacks {
  onProgress?: (progress: WorkflowProgress) => void
}

export async function runWorkflow<T>(
  workflow: WorkflowDefinition<T>,
  config: RunWorkflowConfig,
  callbacks?: WorkflowCallbacks,
): Promise<WorkflowResult<T>> {
  const start = Date.now()
  const results: Record<string, StepResult> = {}

  // Build context with bound helpers
  const ctx: WorkflowContext = {
    examProfileId: config.examProfileId,
    authToken: config.authToken,
    signal: config.signal,
    results,

    async llm(prompt: string, system?: string): Promise<string> {
      const response = await streamChat({
        messages: [{ role: 'user', content: prompt }],
        system: system ?? 'You are a helpful assistant. Respond with the requested format only.',
        tools: [],
        authToken: config.authToken,
        signal: config.signal,
      })
      const textBlock = response.content.find(b => b.type === 'text')
      return textBlock && 'text' in textBlock ? textBlock.text : ''
    },

    async searchSources(query: string, topN = 5): Promise<string> {
      const chunks = await searchChunks(config.examProfileId, query, topN)
      if (chunks.length === 0) return ''
      return chunks.map(c => `[${c.documentTitle ?? 'Source'}]\n${c.content}`).join('\n\n---\n\n')
    },

    async searchWeb(query: string): Promise<string> {
      return searchWebClient(query, config.authToken)
    },
  }

  let completedSteps = 0
  let failedSteps = 0

  for (let i = 0; i < workflow.steps.length; i++) {
    const step = workflow.steps[i]

    // Check abort
    if (config.signal?.aborted) {
      return { success: false, stepResults: results, totalDurationMs: Date.now() - start }
    }

    // Check shouldRun
    if (step.shouldRun && !step.shouldRun(ctx)) {
      results[step.id] = { status: 'skipped', durationMs: 0 }
      callbacks?.onProgress?.({
        workflowName: workflow.name,
        currentStepIndex: i,
        totalSteps: workflow.steps.length,
        currentStepName: step.name,
        completedSteps,
        failedSteps,
      })
      continue
    }

    // Report progress: step starting
    callbacks?.onProgress?.({
      workflowName: workflow.name,
      currentStepIndex: i,
      totalSteps: workflow.steps.length,
      currentStepName: step.name,
      completedSteps,
      failedSteps,
    })

    const stepStart = Date.now()
    try {
      const data = await step.execute(undefined, ctx)
      results[step.id] = { status: 'completed', data, durationMs: Date.now() - stepStart }
      completedSteps++
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)
      results[step.id] = { status: 'failed', error, durationMs: Date.now() - stepStart }
      failedSteps++

      if (!step.optional) {
        // Abort workflow on required step failure
        callbacks?.onProgress?.({
          workflowName: workflow.name,
          currentStepIndex: i,
          totalSteps: workflow.steps.length,
          currentStepName: step.name,
          completedSteps,
          failedSteps,
        })
        return { success: false, stepResults: results, totalDurationMs: Date.now() - start }
      }
    }
  }

  // Aggregate final result
  try {
    const data = await workflow.aggregate(ctx)
    return { success: true, data, stepResults: results, totalDurationMs: Date.now() - start }
  } catch (err) {
    return { success: false, stepResults: results, totalDurationMs: Date.now() - start }
  }
}
