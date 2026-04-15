/**
 * POST /api/legal-chat
 * Streaming legal chat via Claude Sonnet 4.6 (Anthropic API).
 * Converts Anthropic SSE → OpenAI SSE format so the client parses it unchanged.
 * Supports tool calling (searchLegalCodes, createFlashcardDeck).
 */
import type { Env } from '../env'
import { verifyClerkJWT } from '../lib/auth'
import { corsHeaders } from '../lib/cors'
import { checkRateLimit } from '../lib/rateLimiter'
import { checkCostLimits } from '../lib/costProtection'
import { SERVER_TOOLS } from '../lib/toolDefinitions'

const MODEL = 'claude-sonnet-4-6'
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'

export const onRequestOptions: PagesFunction<Env> = async (context) => {
  return new Response(null, { status: 204, headers: corsHeaders(context.env) })
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context
  const cors = corsHeaders(env)
  const jsonH = { ...cors, 'Content-Type': 'application/json' }

  try {

  const apiKey = env.ANTHROPIC_API_KEY
  if (!apiKey) return new Response(JSON.stringify({ error: 'Legal chat not configured' }), { status: 503, headers: jsonH })

  // Auth: JWT or admin API key
  const authHeader = request.headers.get('Authorization')
  if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: jsonH })

  let userId: string
  let plan = 'free'

  if (authHeader.startsWith('ApiKey ') && env.ADMIN_API_KEY && authHeader.slice(7) === env.ADMIN_API_KEY) {
    userId = 'admin'
    plan = 'pro'
  } else if (authHeader.startsWith('Bearer ')) {
    try {
      const jwt = await verifyClerkJWT(authHeader.slice(7), env.CLERK_ISSUER_URL, env.CLERK_JWT_AUDIENCE)
      userId = jwt.sub
      plan = (jwt.metadata as { plan?: string })?.plan ?? 'free'
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401, headers: jsonH })
    }
  } else {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: jsonH })
  }

  // Rate limit + cost
  if (env.USAGE_KV) {
    const rl = await checkRateLimit(env.USAGE_KV, 'legal-chat', userId, 30, 3600)
    if (!rl.allowed) return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), { status: 429, headers: jsonH })
  }
  const cost = await checkCostLimits(env, userId, 'chat', plan)
  if (!cost.allowed) return new Response(JSON.stringify({ error: cost.reason ?? 'Daily limit reached' }), { status: 429, headers: jsonH })

  // Parse OpenAI-format request body
  let body: {
    messages: Array<{ role: string; content: unknown }>
    max_tokens?: number
    tools?: Array<{ type: string; function: { name: string; description: string; parameters: unknown } }>
  }
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: jsonH })
  }

  // Convert OpenAI messages → Anthropic messages
  let systemPrompt = ''
  const anthropicMessages: Array<{ role: string; content: unknown }> = []

  for (const msg of body.messages) {
    if (msg.role === 'system') {
      systemPrompt += (typeof msg.content === 'string' ? msg.content : '') + '\n'
      continue
    }

    if (msg.role === 'user' && Array.isArray(msg.content)) {
      // Convert OpenAI tool_result blocks to Anthropic format
      const blocks = (msg.content as Array<Record<string, unknown>>).map(b => {
        if (b.type === 'tool_result') {
          return { type: 'tool_result', tool_use_id: b.tool_use_id, content: String(b.content ?? '') }
        }
        return b
      })
      anthropicMessages.push({ role: 'user', content: blocks })
    } else if (msg.role === 'assistant' && Array.isArray(msg.content)) {
      // Convert OpenAI tool_use blocks to Anthropic format
      const blocks = (msg.content as Array<Record<string, unknown>>).map(b => {
        if (b.type === 'tool_use') {
          return { type: 'tool_use', id: b.id, name: b.name, input: b.input }
        }
        if (b.type === 'text') return { type: 'text', text: b.text }
        return b
      })
      anthropicMessages.push({ role: 'assistant', content: blocks })
    } else {
      anthropicMessages.push(msg)
    }
  }

  // Convert OpenAI tools → Anthropic tools, using server-side canonical definitions
  const toolNames = (body.tools ?? []).map(t => t.function?.name).filter(Boolean)
  const anthropicTools = toolNames.map(name => {
    const serverTool = SERVER_TOOLS.get(name)
    if (serverTool) {
      return { name: serverTool.function.name, description: serverTool.function.description, input_schema: serverTool.function.parameters }
    }
    return null
  }).filter(Boolean)

  // Call Anthropic Messages API with streaming
  const anthropicBody: Record<string, unknown> = {
    model: MODEL,
    max_tokens: Math.min(body.max_tokens ?? 4096, 8192),
    stream: true,
    messages: anthropicMessages,
  }
  if (systemPrompt.trim()) anthropicBody.system = systemPrompt.trim()
  if (anthropicTools.length > 0) anthropicBody.tools = anthropicTools

  const anthropicRes = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(anthropicBody),
  })

  if (!anthropicRes.ok) {
    const err = await anthropicRes.text().catch(() => '')
    return new Response(JSON.stringify({ error: `Claude error: ${anthropicRes.status} ${err.slice(0, 300)}` }), { status: 502, headers: jsonH })
  }

  if (!anthropicRes.body) return new Response(JSON.stringify({ error: 'No stream body' }), { status: 502, headers: jsonH })

  // Stream: convert Anthropic SSE → OpenAI SSE
  const { readable, writable } = new TransformStream()
  const writer = writable.getWriter()
  const encoder = new TextEncoder()

  // Track current tool call index for OpenAI format
  let toolIndex = -1
  const toolIds = new Map<number, string>() // Anthropic content_block index → tool_use id

  const pump = async () => {
    const reader = anthropicRes.body!.getReader()
    const decoder = new TextDecoder()
    let buf = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6).trim()
          if (!data || data === '[DONE]') continue

          try {
            const event = JSON.parse(data)

            // content_block_start — detect tool_use blocks
            if (event.type === 'content_block_start') {
              const block = event.content_block
              if (block?.type === 'tool_use') {
                toolIndex++
                toolIds.set(event.index, block.id)
                // Emit OpenAI tool_call start
                const openaiChunk = {
                  choices: [{
                    index: 0,
                    delta: {
                      tool_calls: [{
                        index: toolIndex,
                        id: block.id,
                        type: 'function',
                        function: { name: block.name, arguments: '' },
                      }],
                    },
                  }],
                }
                await writer.write(encoder.encode(`data: ${JSON.stringify(openaiChunk)}\n\n`))
              }
            }

            // content_block_delta — text or tool input
            if (event.type === 'content_block_delta') {
              const delta = event.delta
              if (delta?.type === 'text_delta' && delta.text) {
                const openaiChunk = { choices: [{ index: 0, delta: { content: delta.text } }] }
                await writer.write(encoder.encode(`data: ${JSON.stringify(openaiChunk)}\n\n`))
              }
              if (delta?.type === 'input_json_delta' && delta.partial_json) {
                const openaiChunk = {
                  choices: [{
                    index: 0,
                    delta: {
                      tool_calls: [{
                        index: toolIndex,
                        function: { arguments: delta.partial_json },
                      }],
                    },
                  }],
                }
                await writer.write(encoder.encode(`data: ${JSON.stringify(openaiChunk)}\n\n`))
              }
            }

            // message_delta — stop reason
            if (event.type === 'message_delta') {
              const reason = event.delta?.stop_reason
              const finishReason = reason === 'tool_use' ? 'tool_calls' : reason === 'end_turn' ? 'stop' : reason
              if (finishReason) {
                const openaiChunk = { choices: [{ index: 0, delta: {}, finish_reason: finishReason }] }
                await writer.write(encoder.encode(`data: ${JSON.stringify(openaiChunk)}\n\n`))
              }
            }
          } catch { /* skip unparseable */ }
        }
      }
    } finally {
      await writer.write(encoder.encode('data: [DONE]\n\n'))
      await writer.close()
    }
  }

  // Start the streaming conversion in the background
  context.waitUntil(pump())

  return new Response(readable, {
    headers: { ...cors, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
  })

  } catch (e) {
    const cors = corsHeaders(context.env)
    return new Response(
      JSON.stringify({ error: String((e as Error).message ?? e), stack: String((e as Error).stack ?? '').slice(0, 500) }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } },
    )
  }
}
