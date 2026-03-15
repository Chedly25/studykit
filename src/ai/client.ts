/**
 * SSE streaming client for the LLM proxy.
 * Parses OpenAI-compatible SSE events (used by Qwen/DashScope, OpenAI, etc.)
 *
 * To switch to Anthropic's native format later, swap the parser in this file.
 */
import type { Message, ToolDefinition } from './types'

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
  authToken?: string
  onToken?: (text: string) => void
  onToolCall?: (name: string) => void
}

export interface ChatResponse {
  content: Array<
    | { type: 'text'; text: string }
    | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  >
  stopReason: string | null
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
      result.push({ role: msg.role, content: msg.content })
      continue
    }

    // Array content — could contain text + tool_use or tool_result blocks
    if (Array.isArray(msg.content)) {
      const textParts = msg.content.filter(b => b.type === 'text')
      const toolUseParts = msg.content.filter(b => b.type === 'tool_use')
      const toolResultParts = msg.content.filter(b => b.type === 'tool_result')

      if (toolUseParts.length > 0) {
        // Assistant message with tool calls
        const textContent = textParts.map(b => ('text' in b ? b.text : '')).join('')
        result.push({
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
        })
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
  const { messages, system, tools, model, maxTokens = 4096, authToken, onToken, onToolCall } = options

  const openaiMessages = toOpenAIMessages(messages, system)
  const openaiTools = tools.length > 0 ? toOpenAITools(tools) : undefined

  const body: Record<string, unknown> = {
    messages: openaiMessages,
    max_tokens: maxTokens,
    stream: true,
  }
  if (model) body.model = model
  if (openaiTools) body.tools = openaiTools

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`

  const response = await fetch(API_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })

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
    } catch (e) {
      if (e instanceof QuotaExceededError) throw e
    }
    throw new Error(`API error ${response.status}: ${errText}`)
  }

  if (!response.body) throw new Error('No response body')

  const reader = response.body.getReader()
  const decoder = new TextDecoder()

  const content: ChatResponse['content'] = []
  let currentText = ''
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
        const choice = event.choices?.[0]
        if (!choice) continue

        const delta = choice.delta
        if (!delta) continue

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
      // Incomplete JSON
    }
    content.push({
      type: 'tool_use',
      id: tc.id,
      name: tc.name,
      input,
    })
  }

  return { content, stopReason }
}
