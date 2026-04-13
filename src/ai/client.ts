/**
 * SSE streaming client for the LLM proxy.
 * Parses OpenAI-compatible SSE events (used by Qwen/DashScope, OpenAI, etc.)
 *
 * To switch to Anthropic's native format later, swap the parser in this file.
 */
import type { Message, ToolDefinition } from './types'
import { llmGate, fetchWithGate } from '../lib/requestGate'

const API_URL = import.meta.env.VITE_API_URL || '/api/chat'

export class QuotaExceededError extends Error {
  code = 'QUOTA_EXCEEDED' as const
  limit: number
  used: number

  constructor(message: string, limit: number, used: number) {
    super(message)
    this.name = 'QuotaExceededError'
    this.limit = limit
    this.used = used
  }
}

export interface ChatRequestOptions {
  messages: Message[]
  system: string
  tools: ToolDefinition[]
  model?: string
  maxTokens?: number
  toolChoice?: 'auto' | 'required' | 'none'
  authToken?: string
  getToken?: () => Promise<string | null>
  onToken?: (text: string) => void
  onToolCall?: (name: string) => void
  signal?: AbortSignal
}

export interface ChatResponse {
  content: Array<
    | { type: 'text'; text: string }
    | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  >
  stopReason: string | null
  reasoningContent?: string
}

/**
 * Convert our tool definitions to OpenAI function-calling format.
 */
function toOpenAITools(tools: ToolDefinition[]) {
  return tools.map(t => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.input_schema,
    },
  }))
}

/**
 * Convert our Message[] to OpenAI messages format.
 * Handles tool_use / tool_result blocks → assistant tool_calls / tool role messages.
 */
function toOpenAIMessages(messages: Message[], system: string) {
  const result: Array<Record<string, unknown>> = []

  // System message first
  if (system) {
    result.push({ role: 'system', content: system })
  }

  for (const msg of messages) {
    if (typeof msg.content === 'string') {
      const converted: Record<string, unknown> = { role: msg.role, content: msg.content }
      if (msg.reasoning_content) converted.reasoning_content = msg.reasoning_content
      result.push(converted)
      continue
    }

    // Array content — could contain text + tool_use or tool_result blocks
    if (Array.isArray(msg.content)) {
      const textParts = msg.content.filter(b => b.type === 'text')
      const toolUseParts = msg.content.filter(b => b.type === 'tool_use')
      const toolResultParts = msg.content.filter(b => b.type === 'tool_result')

      if (toolUseParts.length > 0) {
        // Assistant message with tool calls — preserve reasoning_content for thinking models
        const textContent = textParts.map(b => ('text' in b ? b.text : '')).join('')
        const assistantMsg: Record<string, unknown> = {
          role: 'assistant',
          content: textContent || null,
          tool_calls: toolUseParts.map(b => ({
            id: 'id' in b ? b.id : '',
            type: 'function',
            function: {
              name: 'name' in b ? b.name : '',
              arguments: JSON.stringify('input' in b ? b.input : {}),
            },
          })),
        }
        if (msg.reasoning_content) assistantMsg.reasoning_content = msg.reasoning_content
        result.push(assistantMsg)
      } else if (toolResultParts.length > 0) {
        // Tool result messages (one per tool call)
        for (const b of toolResultParts) {
          if ('tool_use_id' in b) {
            result.push({
              role: 'tool',
              tool_call_id: b.tool_use_id,
              content: 'content' in b ? b.content : '',
            })
          }
        }
      } else if (textParts.length > 0) {
        const text = textParts.map(b => ('text' in b ? b.text : '')).join('')
        result.push({ role: msg.role, content: text })
      }
    }
  }

  return result
}

export async function streamChat(options: ChatRequestOptions): Promise<ChatResponse> {
  const { messages, system, tools, model, maxTokens = 4096, toolChoice, authToken, getToken, onToken, onToolCall, signal } = options

  const openaiMessages = toOpenAIMessages(messages, system)
  const openaiTools = tools.length > 0 ? toOpenAITools(tools) : undefined

  const body: Record<string, unknown> = {
    messages: openaiMessages,
    max_tokens: maxTokens,
    stream: true,
  }
  if (model) body.model = model
  if (openaiTools) body.tools = openaiTools
  if (toolChoice && openaiTools) body.tool_choice = toolChoice

  let currentToken = authToken

  const doFetch = (token?: string) => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token) headers['Authorization'] = `Bearer ${token}`
    return fetch(API_URL, { method: 'POST', headers, body: JSON.stringify(body), signal })
  }

  // Use the global LLM gate for concurrency control + automatic 429 retry
  let response = await fetchWithGate(llmGate, () => doFetch(currentToken), { signal })

  // Retry once with fresh token on 401 (JWT expired)
  if (response.status === 401 && getToken) {
    const freshToken = await getToken()
    if (freshToken) {
      currentToken = freshToken
      response = await fetchWithGate(llmGate, () => doFetch(freshToken), { signal })
    }
  }

  if (!response.ok) {
    const errText = await response.text()
    try {
      const errJson = JSON.parse(errText) as { code?: string; error?: string; limit?: number; used?: number }
      if (errJson.code === 'QUOTA_EXCEEDED') {
        throw new QuotaExceededError(
          errJson.error || 'Daily quota exceeded',
          errJson.limit ?? 5,
          errJson.used ?? 5
        )
      }
      if (errJson.error) throw new Error(errJson.error)
    } catch (e) {
      if (e instanceof QuotaExceededError) throw e
      if (e instanceof Error && !e.message.startsWith('API error')) throw e
    }
    throw new Error(`API error ${response.status}: ${errText.slice(0, 200)}`)
  }

  // Check for JSON error responses returned as 200 (to avoid Cloudflare 502 interception)
  const contentType = response.headers.get('Content-Type') || ''
  if (contentType.includes('application/json')) {
    const json = await response.json() as { error?: string; code?: string; detail?: string }
    if (json.error) {
      throw new Error(json.detail ? `${json.error} [${json.detail}]` : json.error)
    }
  }

  if (!response.body) throw new Error('No response body')

  const reader = response.body.getReader()
  const decoder = new TextDecoder()

  const content: ChatResponse['content'] = []
  let currentText = ''
  let currentReasoning = ''
  // Track tool calls by index
  const toolCalls = new Map<number, { id: string; name: string; args: string }>()
  let stopReason: string | null = null
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const data = line.slice(6).trim()
      if (data === '[DONE]') continue

      try {
        const event = JSON.parse(data)

        // Cloudflare Workers AI format: { response: "token" }
        if ('response' in event && typeof event.response === 'string') {
          currentText += event.response
          onToken?.(event.response)
          continue
        }

        // OpenAI-compatible format: { choices: [{ delta: { content: "token" } }] }
        const choice = event.choices?.[0]
        if (!choice) continue

        const delta = choice.delta
        if (!delta) continue

        // Reasoning/thinking content (Kimi K2.5)
        if (delta.reasoning_content) {
          currentReasoning += delta.reasoning_content
        }

        // Text content
        if (delta.content) {
          currentText += delta.content
          onToken?.(delta.content)
        }

        // Tool calls
        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index ?? 0
            if (!toolCalls.has(idx)) {
              toolCalls.set(idx, { id: tc.id || '', name: '', args: '' })
            }
            const existing = toolCalls.get(idx)!
            if (tc.id) existing.id = tc.id
            if (tc.function?.name) {
              existing.name = tc.function.name
              onToolCall?.(tc.function.name)
            }
            if (tc.function?.arguments) {
              existing.args += tc.function.arguments
            }
          }
        }

        // Finish reason
        if (choice.finish_reason) {
          stopReason = choice.finish_reason
        }
      } catch {
        // Skip unparseable
      }
    }
  }

  // Flush text
  if (currentText) {
    content.push({ type: 'text', text: currentText })
  }

  // Flush tool calls
  for (const [, tc] of toolCalls) {
    let input: Record<string, unknown> = {}
    try {
      input = JSON.parse(tc.args)
    } catch {
      // Attempt JSON repair: find last valid closing brace
      try {
        const lastBrace = tc.args.lastIndexOf('}')
        if (lastBrace > 0) input = JSON.parse(tc.args.slice(0, lastBrace + 1))
      } catch {
        console.warn(`[ai/client] Failed to parse tool args for ${tc.name}:`, tc.args.slice(0, 200))
      }
    }
    content.push({
      type: 'tool_use',
      id: tc.id,
      name: tc.name,
      input,
    })
  }

  return { content, stopReason, reasoningContent: currentReasoning || undefined }
}
