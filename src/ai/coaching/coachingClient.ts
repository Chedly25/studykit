/**
 * Shared helpers for CRFPA coaching features (syllogisme, fiche d'arrêt, plan détaillé).
 *
 * Routes all calls through /api/legal-chat (Claude Sonnet 4.6) with a simple
 * non-streaming text response. Grading calls pass no tools; scenario generation
 * can optionally supply tools (e.g. searchLegalCodes to ground in a real article).
 */
import { streamChat } from '../client'
import type { Message, ToolDefinition } from '../types'

const LEGAL_CHAT_URL = '/api/legal-chat'
const DEFAULT_MAX_TOKENS = 4000

export interface CoachingCallOptions {
  system: string
  user: string
  maxTokens?: number
  tools?: ToolDefinition[]
  authToken?: string
  getToken?: () => Promise<string | null>
  signal?: AbortSignal
  onToken?: (text: string) => void
  /** Opt in to Opus 4.7 for the call. Default backend model is Sonnet 4.6. */
  model?: 'sonnet' | 'opus'
}

/**
 * One-shot call to Claude Sonnet 4.6. Returns the concatenated text response.
 *
 * For grading, pass `tools: []` (the default) so the model produces text only.
 * For scenario generation, pass `tools: [searchLegalCodesTool]` and the caller
 * is responsible for running a tool loop (see runAgentLoop for the pattern).
 */
export async function coachingCall(opts: CoachingCallOptions): Promise<string> {
  const messages: Message[] = [
    { id: crypto.randomUUID(), role: 'user', content: opts.user },
  ]

  const response = await streamChat({
    messages,
    system: opts.system,
    tools: opts.tools ?? [],
    maxTokens: opts.maxTokens ?? DEFAULT_MAX_TOKENS,
    toolChoice: opts.tools && opts.tools.length > 0 ? 'auto' : 'none',
    authToken: opts.authToken,
    getToken: opts.getToken,
    onToken: opts.onToken,
    signal: opts.signal,
    url: LEGAL_CHAT_URL,
    model: opts.model,
  })

  return response.content
    .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
    .map(c => c.text)
    .join('')
}

/**
 * Call Claude and parse a JSON object out of the response.
 *
 * Resilient to:
 * - Leading/trailing prose around the JSON
 * - Markdown code fences (```json ... ```)
 * - A stray trailing character that breaks strict JSON.parse
 *
 * Throws if no JSON object can be recovered.
 */
export async function coachingCallJson<T>(opts: CoachingCallOptions): Promise<T> {
  const raw = await coachingCall(opts)
  return extractJson<T>(raw)
}

/** Exported for reuse in tests and by workflows that already have raw text. */
export function extractJson<T>(raw: string): T {
  // Strip code fences if present
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  const candidate = fenced ? fenced[1] : raw

  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start < 0 || end <= start) {
    throw new Error('No JSON object found in model response')
  }

  const slice = candidate.slice(start, end + 1)
  try {
    return JSON.parse(slice) as T
  } catch {
    // Attempt simple repair: drop characters until the last balanced closing brace
    const lastBrace = slice.lastIndexOf('}', slice.length - 2)
    if (lastBrace > start) {
      try {
        return JSON.parse(slice.slice(0, lastBrace + 1) + '}') as T
      } catch {
        /* fall through */
      }
    }
    throw new Error('Failed to parse JSON from model response')
  }
}
