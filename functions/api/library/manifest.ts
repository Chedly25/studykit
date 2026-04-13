/**
 * GET /api/library/manifest?examId=cpge-mp
 * Returns the content manifest for a library exam ID from R2.
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

  let userId: string
  try {
    const { sub } = await verifyClerkJWT(authHeader.slice(7), env.CLERK_ISSUER_URL, env.CLERK_JWT_AUDIENCE)
    userId = sub
  } catch {
    return new Response(JSON.stringify({ error: 'Authentication failed' }), { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  if (env.USAGE_KV) {
    const rl = await checkRateLimit(env.USAGE_KV, 'library-manifest', userId, 30, 3600)
    if (!rl.allowed) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), { status: 429, headers: { ...cors, 'Content-Type': 'application/json' } })
    }
  }

  const url = new URL(request.url)
  const examId = url.searchParams.get('examId')
  if (!examId || !/^[a-z0-9-]+$/.test(examId)) {
    return new Response(JSON.stringify({ error: 'Missing or invalid examId' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  if (!env.LIBRARY_R2) {
    return new Response(JSON.stringify({ error: 'Library not available' }), { status: 503, headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  const obj = await env.LIBRARY_R2.get(`library/${examId}/manifest.json`)
  if (!obj) {
    return new Response(JSON.stringify({ error: 'No library found for this exam' }), { status: 404, headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  const body = await obj.text()
  return new Response(body, { status: 200, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600' } })
}
