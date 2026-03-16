/**
 * Reusable step factories for building orchestrator workflows.
 */
import type { WorkflowStep, WorkflowContext } from './types'

/**
 * Call LLM with a prompt and extract JSON from the response.
 */
export function llmJsonStep<T = unknown>(
  id: string,
  name: string,
  buildPrompt: (ctx: WorkflowContext) => string | Promise<string>,
  systemPrompt?: string,
): WorkflowStep<unknown, T> {
  return {
    id,
    name,
    async execute(_input, ctx) {
      const prompt = await Promise.resolve(buildPrompt(ctx))
      const text = await ctx.llm(prompt, systemPrompt)

      // Extract JSON from response (greedy match from first { to last })
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        // Try array match
        const arrayMatch = text.match(/\[[\s\S]*\]/)
        if (!arrayMatch) throw new Error(`No JSON found in LLM response for step "${id}"`)
        return JSON.parse(arrayMatch[0]) as T
      }
      return JSON.parse(jsonMatch[0]) as T
    },
  }
}

/**
 * Read from IndexedDB via a query function.
 */
export function dbQueryStep<T = unknown>(
  id: string,
  name: string,
  queryFn: (ctx: WorkflowContext) => Promise<T>,
): WorkflowStep<unknown, T> {
  return {
    id,
    name,
    async execute(_input, ctx) {
      return queryFn(ctx)
    },
  }
}

/**
 * Search uploaded documents via searchChunks().
 */
export function sourceSearchStep(
  id: string,
  name: string,
  buildQuery: (ctx: WorkflowContext) => string,
  topN = 5,
): WorkflowStep<unknown, string> {
  return {
    id,
    name,
    async execute(_input, ctx) {
      const query = buildQuery(ctx)
      return ctx.searchSources(query, topN)
    },
  }
}

/**
 * Search the web via /api/search (Tavily).
 */
export function webSearchStep(
  id: string,
  name: string,
  buildQuery: (ctx: WorkflowContext) => string,
): WorkflowStep<unknown, string> {
  return {
    id,
    name,
    async execute(_input, ctx) {
      const query = buildQuery(ctx)
      return ctx.searchWeb(query)
    },
  }
}

/**
 * Run arbitrary local logic (no LLM, no network).
 */
export function localStep<T = unknown>(
  id: string,
  name: string,
  fn: (ctx: WorkflowContext) => Promise<T> | T,
): WorkflowStep<unknown, T> {
  return {
    id,
    name,
    async execute(_input, ctx) {
      return fn(ctx)
    },
  }
}
