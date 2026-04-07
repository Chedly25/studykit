/**
 * Reusable step factories for building orchestrator workflows.
 */
import type { WorkflowStep, WorkflowContext } from './types'

/**
 * Try to repair truncated JSON by closing open brackets/braces.
 * Returns the parsed object or throws if repair fails.
 */
function parseJsonWithRepair<T>(text: string): T {
  // Strip markdown code blocks
  const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '')

  // First try: extract and parse as-is
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]) as T
    } catch { /* fall through to repair */ }
  }

  // Try array match
  const arrayMatch = cleaned.match(/\[[\s\S]*\]/)
  if (arrayMatch) {
    try {
      return JSON.parse(arrayMatch[0]) as T
    } catch { /* fall through to repair */ }
  }

  // Repair: find the start of JSON and try to close it
  const jsonStart = cleaned.indexOf('{')
  if (jsonStart === -1) throw new Error('No JSON found in response')

  const candidate = cleaned.slice(jsonStart)

  // Remove trailing incomplete strings (cut at last complete property)
  // Strategy: progressively trim from the end and try to close brackets
  for (let trimLen = 0; trimLen < Math.min(500, candidate.length); trimLen++) {
    const trimmed = trimLen === 0 ? candidate : candidate.slice(0, -trimLen)

    // Count open/close braces and brackets
    let braces = 0
    let brackets = 0
    let inString = false
    let escape = false

    for (const ch of trimmed) {
      if (escape) { escape = false; continue }
      if (ch === '\\' && inString) { escape = true; continue }
      if (ch === '"') { inString = !inString; continue }
      if (inString) continue
      if (ch === '{') braces++
      if (ch === '}') braces--
      if (ch === '[') brackets++
      if (ch === ']') brackets--
    }

    // If we're inside a string, close it
    let repaired = trimmed
    if (inString) repaired += '"'

    // Close any open brackets/braces
    for (let j = 0; j < brackets; j++) repaired += ']'
    for (let j = 0; j < braces; j++) repaired += '}'

    try {
      return JSON.parse(repaired) as T
    } catch { continue }
  }

  throw new Error('Failed to parse JSON from LLM response (possibly truncated)')
}

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
      return parseJsonWithRepair<T>(text)
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
