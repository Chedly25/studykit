/**
 * GET /api/library/content?examId=cpge-mp&docId=mines-ponts-mp1-2024
 * Returns a pre-processed document package (document + chunks + embeddings) from R2.
 */
import type { Env } from '../../env'
import { verifyClerkJWT } from '../../lib/auth'
import { corsHeaders } from '../../lib/cors'
import { checkRateLimit } from '../../lib/rateLimiter'
import { checkR2Limit } from '../../lib/costProtection'

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
    const rl = await checkRateLimit(env.USAGE_KV, 'library-content', userId, 120, 3600)
    if (!rl.allowed) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), { status: 429, headers: { ...cors, 'Content-Type': 'application/json' } })
    }
  }

  const url = new URL(request.url)
  const examId = url.searchParams.get('examId')
  const docId = url.searchParams.get('docId')
  if (!examId || !docId || !/^[a-z0-9-]+$/.test(examId) || !/^[a-z0-9-]+$/.test(docId)) {
    return new Response(JSON.stringify({ error: 'Missing or invalid examId/docId' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  if (!env.LIBRARY_R2) {
    return new Response(JSON.stringify({ error: 'Library not available' }), { status: 503, headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  // R2 free-tier protection: 1 Class B (GET) operation
  if (env.USAGE_KV) {
    const r2Check = await checkR2Limit(env.USAGE_KV, 'classB')
    if (!r2Check.allowed) {
      return new Response(JSON.stringify({ error: 'Library temporarily unavailable (daily R2 limit reached)' }), { status: 429, headers: { ...cors, 'Content-Type': 'application/json' } })
    }
  }

  const obj = await env.LIBRARY_R2.get(`library/${examId}/docs/${docId}.json`)
  if (!obj) {
    return new Response(JSON.stringify({ error: 'Document not found' }), { status: 404, headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  const body = await obj.text()
  return new Response(body, { status: 200, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=86400' } })
}
