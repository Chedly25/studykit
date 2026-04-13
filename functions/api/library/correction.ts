/**
 * GET  /api/library/correction?paperId=mines-ponts-mp1-2024 — check if cached correction exists
 * POST /api/library/correction { paperId, correction } — save a correction (first-write-wins)
 */
import type { Env } from '../../env'
import { verifyClerkJWT } from '../../lib/auth'
import { corsHeaders } from '../../lib/cors'
import { checkRateLimit } from '../../lib/rateLimiter'

export const onRequestOptions: PagesFunction<Env> = async (context) => {
  return new Response(null, { status: 204, headers: corsHeaders(context.env) })
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context
  const cors = corsHeaders(env)

  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  try {
    const { sub } = await verifyClerkJWT(authHeader.slice(7), env.CLERK_ISSUER_URL, env.CLERK_JWT_AUDIENCE)
    if (env.USAGE_KV) {
      const rl = await checkRateLimit(env.USAGE_KV, 'library-correction', sub, 60, 3600)
      if (!rl.allowed) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), { status: 429, headers: { ...cors, 'Content-Type': 'application/json' } })
      }
    }
  } catch {
    return new Response(JSON.stringify({ error: 'Authentication failed' }), { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  const url = new URL(request.url)
  const paperId = url.searchParams.get('paperId')
  if (!paperId || !/^[a-z0-9-]+$/.test(paperId)) {
    return new Response(JSON.stringify({ error: 'Missing or invalid paperId' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  if (!env.LIBRARY_R2) {
    return new Response(JSON.stringify({ exists: false }), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  const obj = await env.LIBRARY_R2.get(`library/corrections/${paperId}.json`)
  if (!obj) {
    return new Response(JSON.stringify({ exists: false }), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  const body = await obj.text()
  return new Response(JSON.stringify({ exists: true, correction: JSON.parse(body) }), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } })
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context
  const cors = corsHeaders(env)

  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  let userId: string
  try {
    const { sub } = await verifyClerkJWT(authHeader.slice(7), env.CLERK_ISSUER_URL, env.CLERK_JWT_AUDIENCE)
    userId = sub
    if (env.USAGE_KV) {
      const rl = await checkRateLimit(env.USAGE_KV, 'library-correction-write', sub, 10, 3600)
      if (!rl.allowed) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), { status: 429, headers: { ...cors, 'Content-Type': 'application/json' } })
      }
    }
  } catch {
    return new Response(JSON.stringify({ error: 'Authentication failed' }), { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  if (!env.LIBRARY_R2) {
    return new Response(JSON.stringify({ error: 'Library not available' }), { status: 503, headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  const body = await request.json() as { paperId?: string; correction?: string; metadata?: Record<string, unknown> }
  const { paperId, correction, metadata } = body

  if (!paperId || !correction || !/^[a-z0-9-]+$/.test(paperId)) {
    return new Response(JSON.stringify({ error: 'Missing paperId or correction' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  if (correction.length > 500_000) {
    return new Response(JSON.stringify({ error: 'Correction too large (max 500KB)' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  // First-write-wins: don't overwrite existing corrections
  const existing = await env.LIBRARY_R2.head(`library/corrections/${paperId}.json`)
  if (existing) {
    return new Response(JSON.stringify({ success: true, alreadyExists: true }), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  await env.LIBRARY_R2.put(
    `library/corrections/${paperId}.json`,
    JSON.stringify({ paperId, correction, metadata, createdAt: new Date().toISOString(), createdBy: userId, version: 1 }),
  )

  return new Response(JSON.stringify({ success: true }), { status: 201, headers: { ...cors, 'Content-Type': 'application/json' } })
}
