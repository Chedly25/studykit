/**
 * Cloudflare Pages Function: POST /api/chat
 * Proxies to an OpenAI-compatible LLM API (Kimi, OpenAI, etc.)
 * Stores ZERO student data.
 */

import type { Env } from '../env'
import { verifyClerkJWT } from '../lib/auth'
import { corsHeaders } from '../lib/cors'
import { checkCostLimits } from '../lib/costProtection'

const DEFAULT_MODEL = 'kimi-k2.5'
const DEFAULT_API_URL = 'https://api.moonshot.ai/v1/chat/completions'
const MAX_RETRIES = 1
const PRO_DAILY_LIMIT = 500

const FREE_TIER_DAILY_LIMIT = 5

// ─── KV-based rate limiter (persistent across isolates) ─────────
const RATE_LIMIT = 60
const RATE_WINDOW_SECONDS = 3600

async function checkRateLimitKV(
  kv: KVNamespace,
  userId: string
): Promise<{ allowed: boolean; remaining: number }> {
  const windowKey = `ratelimit:${userId}:${Math.floor(Date.now() / 1000 / RATE_WINDOW_SECONDS)}`
  const currentStr = await kv.get(windowKey)
  const current = currentStr ? parseInt(currentStr, 10) : 0

  if (current >= RATE_LIMIT) {
    return { allowed: false, remaining: 0 }
  }

  const newCount = current + 1
  await kv.put(windowKey, String(newCount), { expirationTtl: RATE_WINDOW_SECONDS })
  return { allowed: true, remaining: RATE_LIMIT - newCount }
}

// ─── Handler ─────────────────────────────────────────────────────
export const onRequestOptions: PagesFunction<Env> = async (context) => {
  return new Response(null, { status: 204, headers: corsHeaders(context.env) })
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context
  const cors = corsHeaders(env)

  // Require authentication
  if (!env.CLERK_ISSUER_URL) {
    return new Response(
      JSON.stringify({ error: 'Server misconfigured: authentication not set up' }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  }

  // JWT authentication
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(
      JSON.stringify({ error: 'Missing or invalid Authorization header' }),
      { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  }

  let userId: string
  let userPlan: string | undefined

  try {
    const { sub, metadata } = await verifyClerkJWT(authHeader.slice(7), env.CLERK_ISSUER_URL)
    userId = sub
    userPlan = metadata?.plan
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    console.error('JWT verification failed:', reason)
    return new Response(
      JSON.stringify({ error: `Authentication failed: ${reason}` }),
      { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  }

  // Rate limiting (KV-based, persistent across isolates)
  const rl = env.USAGE_KV
    ? await checkRateLimitKV(env.USAGE_KV, userId)
    : { allowed: true, remaining: RATE_LIMIT }
  if (!rl.allowed) {
    return new Response(
      JSON.stringify({ error: 'Rate limit exceeded. Try again later.' }),
      { status: 429, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  }

  // Free-tier daily quota check (KV-based, optimistic increment to minimize TOCTOU window)
  if (userPlan !== 'pro' && env.USAGE_KV) {
    const today = new Date().toISOString().slice(0, 10)
    const kvKey = `quota:${userId}:${today}`
    const currentStr = await env.USAGE_KV.get(kvKey)
    const current = currentStr ? parseInt(currentStr, 10) : 0
    const newCount = current + 1

    // Write the incremented value immediately to minimize race window
    await env.USAGE_KV.put(kvKey, String(newCount), { expirationTtl: 86400 })

    if (newCount > FREE_TIER_DAILY_LIMIT) {
      return new Response(
        JSON.stringify({
          error: `You've used all ${FREE_TIER_DAILY_LIMIT} free AI messages for today. Upgrade to Pro for unlimited access.`,
          code: 'QUOTA_EXCEEDED',
          limit: FREE_TIER_DAILY_LIMIT,
          used: Math.min(newCount, FREE_TIER_DAILY_LIMIT),
        }),
        { status: 429, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }
  }

  // Pro-tier daily safety cap (prevents runaway costs)
  if (userPlan === 'pro' && env.USAGE_KV) {
    const today = new Date().toISOString().slice(0, 10)
    const kvKey = `quota:${userId}:${today}`
    const currentStr = await env.USAGE_KV.get(kvKey)
    const current = currentStr ? parseInt(currentStr, 10) : 0
    const newCount = current + 1
    await env.USAGE_KV.put(kvKey, String(newCount), { expirationTtl: 86400 })

    if (newCount > PRO_DAILY_LIMIT) {
      return new Response(
        JSON.stringify({ error: 'Daily safety limit reached (500 requests). Resets at midnight UTC.' }),
        { status: 429, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }
  }

  // Global kill switch — if total daily chat calls exceed threshold, block everyone
  {
    const costCheck = await checkCostLimits(env, userId, 'chat')
    if (!costCheck.allowed) {
      return new Response(
        JSON.stringify({ error: costCheck.reason }),
        { status: 429, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }
  }

  // Global usage counter for admin dashboard
  if (env.USAGE_KV) {
    const today = new Date().toISOString().slice(0, 10)
    const chatKey = `usage:chat:${today}`
    const chatCount = await env.USAGE_KV.get(chatKey)
    await env.USAGE_KV.put(chatKey, String((chatCount ? parseInt(chatCount, 10) : 0) + 1), { expirationTtl: 86400 * 90 })
  }

  // Body size check — read actual body, don't trust Content-Length
  const MAX_BODY_SIZE = 4 * 1024 * 1024 // 4MB — agent loop accumulates tool results across iterations
  let rawBody: string
  try {
    const reader = request.body?.getReader()
    if (!reader) {
      return new Response(
        JSON.stringify({ error: 'Missing request body' }),
        { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }
    const chunks: Uint8Array[] = []
    let totalSize = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (value) {
        totalSize += value.length
        if (totalSize > MAX_BODY_SIZE) {
          reader.cancel()
          return new Response(
            JSON.stringify({ error: 'Request too large' }),
            { status: 413, headers: { ...cors, 'Content-Type': 'application/json' } }
          )
        }
        chunks.push(value)
      }
    }
    const decoder = new TextDecoder()
    rawBody = chunks.map(c => decoder.decode(c, { stream: true })).join('') + decoder.decode()
  } catch {
    return new Response(
      JSON.stringify({ error: 'Failed to read request body' }),
      { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  }

  try {
    const body = JSON.parse(rawBody) as Record<string, unknown>

    // Validate
    if (!body.messages || !Array.isArray(body.messages)) {
      return new Response(
        JSON.stringify({ error: 'Invalid request: messages required' }),
        { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    // Sanitize messages: strip any client-injected system-role messages
    const messages = (body.messages as Array<Record<string, unknown>>).filter(
      m => m.role !== 'system'
    )
    body.messages = messages

    const apiUrl = env.LLM_API_URL || DEFAULT_API_URL
    const model = (env.LLM_MODEL || DEFAULT_MODEL) as string
    const apiKey = env.LLM_API_KEY

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'Server misconfigured: LLM API key not set' }),
        { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    const rawMaxTokens = Number(body.max_tokens)
    const maxTokens = (Number.isFinite(rawMaxTokens) && rawMaxTokens > 0)
      ? Math.min(Math.floor(rawMaxTokens), 8192)
      : 4096
    const shouldStream = body.stream !== false

    // Build the request body for the OpenAI-compatible API
    const llmBody: Record<string, unknown> = {
      model,
      messages: body.messages,
      max_tokens: maxTokens,
      stream: shouldStream,
    }

    // Add tools if provided
    if (body.tools && Array.isArray(body.tools) && body.tools.length > 0) {
      llmBody.tools = body.tools
    }

    // Fetch with retry for transient failures
    let llmResponse: Response | null = null
    let lastError = ''
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        llmResponse = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify(llmBody),
        })
        if (llmResponse.ok) break
        lastError = `${llmResponse.status}: ${await llmResponse.text()}`
        console.error(`LLM API error (attempt ${attempt + 1}):`, lastError)
        llmResponse = null
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err)
        console.error(`LLM fetch error (attempt ${attempt + 1}):`, lastError)
        llmResponse = null
      }
    }

    if (!llmResponse || !llmResponse.ok) {
      console.error('[chat] LLM upstream error:', lastError.slice(0, 500))
      return new Response(
        JSON.stringify({ error: 'AI service temporarily unavailable. Please try again.' }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    if (shouldStream) {
      // Pass through the SSE stream directly
      return new Response(llmResponse.body, {
        status: 200,
        headers: {
          ...cors,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'X-RateLimit-Remaining': String(rl.remaining),
        },
      })
    }

    // Non-streaming: pass through the JSON response
    const result = await llmResponse.text()
    return new Response(result, {
      status: 200,
      headers: {
        ...cors,
        'Content-Type': 'application/json',
        'X-RateLimit-Remaining': String(rl.remaining),
      },
    })
  } catch (err) {
    console.error('AI inference error:', err)
    return new Response(
      JSON.stringify({ error: 'An error occurred processing your request.' }),
      { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  }
}
