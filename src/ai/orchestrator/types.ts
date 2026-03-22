/**
 * Orchestrator workflow types — defines the interface for multi-step AI workflows.
 */

export type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped'

export interface StepResult<T = unknown> {
  status: 'completed' | 'failed' | 'skipped'
  data?: T
  error?: string
  durationMs: number
}

export interface WorkflowStep<TInput = unknown, TOutput = unknown> {
  id: string
  name: string
  execute: (input: TInput, ctx: WorkflowContext) => Promise<TOutput>
  optional?: boolean
  shouldRun?: (ctx: WorkflowContext) => boolean
}

export interface WorkflowContext {
  examProfileId: string
  authToken: string
  signal?: AbortSignal
  results: Record<string, StepResult>
  llm: (prompt: string, system?: string) => Promise<string>
  searchSources: (query: string, topN?: number) => Promise<string>
  searchWeb: (query: string) => Promise<string>
  /** Update the visible progress message for the current step */
  updateProgress?: (substep: string) => Promise<void>
}

export interface WorkflowDefinition<TResult = unknown> {
  id: string
  name: string
  steps: WorkflowStep[]
  aggregate: (ctx: WorkflowContext) => TResult | Promise<TResult>
}

export interface WorkflowProgress {
  workflowName: string
  currentStepIndex: number
  totalSteps: number
  currentStepName: string
  completedSteps: number
  failedSteps: number
  /** True when the current step involves an LLM call and tokens are streaming */
  isStreaming: boolean
  /** Number of characters received so far from the LLM in the current step */
  streamedChars: number
}

export interface WorkflowResult<T = unknown> {
  success: boolean
  data?: T
  stepResults: Record<string, StepResult>
  totalDurationMs: number
}
