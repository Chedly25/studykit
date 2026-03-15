/**
 * Cloudflare Pages Function: POST /api/chat
 * Uses Cloudflare Workers AI (Llama 3.3 70B) — no API key needed.
 * Stores ZERO student data.
 */

import type { Env } from '../env'
import { verifyClerkJWT } from '../lib/auth'
import { corsHeaders } from '../lib/cors'

const DEFAULT_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast'
const ALLOWED_MODELS = new Set([DEFAULT_MODEL])

const FREE_TIER_DAILY_LIMIT = 5

// ─── Rate limiter (in-memory, resets per isolate) ────────────────
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

function checkRateLimit(key: string, limit = 60, windowMs = 60 * 60 * 1000) {
  const now = Date.now()
  const entry = rateLimitStore.get(key)
  if (!entry || now > entry.resetTime) {
    rateLimitStore.set(key, { count: 1, resetTime: now + windowMs })
    return { allowed: true, remaining: limit - 1 }
  }
  if (entry.count >= limit) {
    return { allowed: false, remaining: 0 }
  }
  entry.count++
  return { allowed: true, remaining: limit - entry.count }
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
    return new Response(
      JSON.stringify({ error: `Authentication failed: ${err instanceof Error ? err.message : 'unknown'}` }),
      { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  }

  // Rate limiting (general)
  const rl = checkRateLimit(userId)
  if (!rl.allowed) {
    return new Response(
      JSON.stringify({ error: 'Rate limit exceeded. Try again later.' }),
      { status: 429, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  }

  // Free-tier daily quota check (KV-based)
  if (userPlan !== 'pro' && env.USAGE_KV) {
    const today = new Date().toISOString().slice(0, 10)
    const kvKey = `quota:${userId}:${today}`
    const currentStr = await env.USAGE_KV.get(kvKey)
    const current = currentStr ? parseInt(currentStr, 10) : 0

    if (current >= FREE_TIER_DAILY_LIMIT) {
      return new Response(
        JSON.stringify({
          error: `You've used all ${FREE_TIER_DAILY_LIMIT} free AI messages for today. Upgrade to Pro for unlimited access.`,
          code: 'QUOTA_EXCEEDED',
          limit: FREE_TIER_DAILY_LIMIT,
          used: current,
        }),
        { status: 429, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    // Increment counter with 24h TTL
    await env.USAGE_KV.put(kvKey, String(current + 1), { expirationTtl: 86400 })
  }

  // Body size check (1MB)
  const contentLength = request.headers.get('content-length')
  if (contentLength && parseInt(contentLength) > 1024 * 1024) {
    return new Response(
      JSON.stringify({ error: 'Request too large' }),
      { status: 413, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  }

  try {
    const body = await request.json() as Record<string, unknown>

    // Validate
    if (!body.messages || !Array.isArray(body.messages)) {
      return new Response(
        JSON.stringify({ error: 'Invalid request: messages required' }),
        { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    const messages = body.messages as Array<{ role: string; content: string }>

    // Add system message if provided separately
    if (body.system && typeof body.system === 'string') {
      if (messages[0]?.role !== 'system') {
        messages.unshift({ role: 'system', content: body.system })
      }
    }

    // Add tools if provided
    const tools = (body.tools && Array.isArray(body.tools) && body.tools.length > 0)
      ? body.tools as Array<Record<string, unknown>>
      : undefined

    const model = ALLOWED_MODELS.has(body.model as string) ? (body.model as string) : DEFAULT_MODEL
    const rawMaxTokens = Number(body.max_tokens)
    const maxTokens = (Number.isFinite(rawMaxTokens) && rawMaxTokens > 0)
      ? Math.min(Math.floor(rawMaxTokens), 8192)
      : 4096
    const shouldStream = body.stream !== false

    if (shouldStream) {
      const stream = await env.AI.run(model as BaseAiTextGenerationModels, {
        messages,
        max_tokens: maxTokens,
        stream: true,
        ...(tools ? { tools } : {}),
      }) as ReadableStream

      return new Response(stream, {
        status: 200,
        headers: {
          ...cors,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'X-RateLimit-Remaining': String(rl.remaining),
        },
      })
    }

    // Non-streaming response
    const result = await env.AI.run(model as BaseAiTextGenerationModels, {
      messages,
      max_tokens: maxTokens,
      stream: false,
      ...(tools ? { tools } : {}),
    })

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        ...cors,
        'Content-Type': 'application/json',
        'X-RateLimit-Remaining': String(rl.remaining),
      },
    })
  } catch (err) {
    return new Response(
      JSON.stringify({ error: `AI inference error: ${err instanceof Error ? err.message : 'unknown'}` }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  }
}
