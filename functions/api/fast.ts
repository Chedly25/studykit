/**
 * Fast pipeline LLM endpoint — uses Claude Haiku via Anthropic API.
 * For structured extraction, classification, and concept generation.
 * Non-streaming, separate rate limit from interactive chat.
 */
import type { Env } from '../env'
import { verifyClerkJWT } from '../lib/auth'
import { corsHeaders } from '../lib/cors'

const MODEL = 'claude-haiku-4-5-20251001'
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
const RATE_LIMIT = 120
const RATE_WINDOW_SECONDS = 3600

export const onRequestOptions: PagesFunction<Env> = async (context) => {
  return new Response(null, { status: 204, headers: corsHeaders(context.env) })
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env } = context
  const cors = corsHeaders(env)

  try {
    if (!env.CLERK_ISSUER_URL) {
      return new Response(JSON.stringify({ error: 'Auth not configured' }), {
        status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const apiKey = env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Fast model not configured' }), {
        status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    // Auth
    const token = context.request.headers.get('Authorization')?.replace('Bearer ', '')
    if (!token) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const jwt = await verifyClerkJWT(token, env.CLERK_ISSUER_URL)

    // Rate limit (separate from chat)
    const rateLimitKey = `fast_rate:${jwt.sub}:${Math.floor(Date.now() / (RATE_WINDOW_SECONDS * 1000))}`
    const currentCount = parseInt((await env.USAGE_KV.get(rateLimitKey)) ?? '0', 10)
    if (currentCount >= RATE_LIMIT) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded, please try again later' }), {
        status: 429, headers: { ...cors, 'Content-Type': 'application/json', 'Retry-After': '30' },
      })
    }
    await env.USAGE_KV.put(rateLimitKey, String(currentCount + 1), { expirationTtl: RATE_WINDOW_SECONDS })

    // Parse request
    const body = await context.request.json() as {
      prompt: string
      system?: string
      maxTokens?: number
    }

    if (!body.prompt) {
      return new Response(JSON.stringify({ error: 'Missing prompt' }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const maxTokens = Math.min(body.maxTokens ?? 4096, 8192)

    // Call Anthropic Messages API
    const anthropicBody = {
      model: MODEL,
      max_tokens: maxTokens,
      system: body.system ?? 'You are a helpful assistant. Respond with the requested format only.',
      messages: [{ role: 'user', content: body.prompt }],
    }

    const llmResponse = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(anthropicBody),
    })

    if (!llmResponse.ok) {
      const errText = await llmResponse.text()
      return new Response(
        JSON.stringify({ error: `AI service error: ${llmResponse.status}: ${errText.slice(0, 300)}` }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } },
      )
    }

    const result = await llmResponse.json() as {
      content: Array<{ type: string; text?: string }>
      stop_reason: string
    }

    const text = result.content
      .filter(b => b.type === 'text' && b.text)
      .map(b => b.text)
      .join('')

    return new Response(JSON.stringify({ text }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Fast model call failed'
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
}
