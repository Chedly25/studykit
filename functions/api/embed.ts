/**
 * Cloudflare Pages Function: POST /api/embed
 * Generates text embeddings via Workers AI (@cf/baai/bge-m3, 1024-dim).
 * Does NOT count against daily message quota.
 */

import type { Env } from '../env'
import { verifyClerkJWT } from '../lib/auth'
import { corsHeaders } from '../lib/cors'
import { checkCostLimits } from '../lib/costProtection'
import { checkRateLimit } from '../lib/rateLimiter'

const RATE_LIMIT = 120
const RATE_WINDOW_SECONDS = 3600
const MAX_TEXTS = 100
const MAX_TEXT_LENGTH = 8192

export const onRequestOptions: PagesFunction<Env> = async (context) => {
  return new Response(null, { status: 204, headers: corsHeaders(context.env) })
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context
  const cors = corsHeaders(env)

  if (!env.CLERK_ISSUER_URL) {
    return new Response(
      JSON.stringify({ error: 'Server misconfigured' }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  }

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
    const { sub, metadata } = await verifyClerkJWT(authHeader.slice(7), env.CLERK_ISSUER_URL, env.CLERK_JWT_AUDIENCE)
    userId = sub
    userPlan = metadata?.plan
  } catch {
    return new Response(
      JSON.stringify({ error: 'Authentication failed' }),
      { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  }

  // Rate limiting (separate from chat)
  if (!env.USAGE_KV) {
    return new Response(
      JSON.stringify({ error: 'Service temporarily unavailable' }),
      { status: 503, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  }
  {
    const rl = await checkRateLimit(env.USAGE_KV, 'embed', userId, RATE_LIMIT, RATE_WINDOW_SECONDS)
    if (!rl.allowed) {
      return new Response(
        JSON.stringify({ error: 'Embedding rate limit exceeded. Try again later.' }),
        { status: 429, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }
  }

  // Daily cap + global kill switch
  {
    const costCheck = await checkCostLimits(env, userId, 'embed', userPlan)
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
    const embedKey = `usage:embed:${today}`
    const embedCount = await env.USAGE_KV.get(embedKey)
    await env.USAGE_KV.put(embedKey, String((embedCount ? parseInt(embedCount, 10) : 0) + 1), { expirationTtl: 86400 * 90 })
  }

  try {
    const body = (await request.json()) as { texts?: string[] }

    if (!body.texts || !Array.isArray(body.texts) || body.texts.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Invalid request: texts array required' }),
        { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    if (body.texts.length > MAX_TEXTS) {
      return new Response(
        JSON.stringify({ error: `Maximum ${MAX_TEXTS} texts per request` }),
        { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    // Truncate long texts
    const texts = body.texts.map(t => typeof t === 'string' ? t.slice(0, MAX_TEXT_LENGTH) : '')

    const result = await env.AI.run('@cf/baai/bge-m3', { text: texts }) as {
      data: number[][]
    }

    // Encode embeddings as base64 Float32Array for compact storage
    const embeddings = result.data.map(vec => {
      const float32 = new Float32Array(vec)
      const bytes = new Uint8Array(float32.buffer)
      let binary = ''
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i])
      }
      return btoa(binary)
    })

    return new Response(
      JSON.stringify({ embeddings }),
      { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('Embedding error:', err)
    return new Response(
      JSON.stringify({ error: 'Failed to generate embeddings' }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  }
}
