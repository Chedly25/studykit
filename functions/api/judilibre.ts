/**
 * Cloudflare Pages Function: POST /api/judilibre
 * Proxies Judilibre API requests (Cour de cassation case law).
 * Keeps the PISTE API key server-side.
 *
 * Actions:
 *   { action: "search", query: "lanceur alerte", pageSize?: 10, ... }
 *   { action: "decision", id: "63da1185b78bc005de6ccd13" }
 */

import type { Env } from '../env'
import { verifyClerkJWT } from '../lib/auth'
import { corsHeaders } from '../lib/cors'
import { checkRateLimit } from '../lib/rateLimiter'

const RATE_LIMIT = 30
const RATE_WINDOW_SECONDS = 3600

const JUDILIBRE_BASE = 'https://api.piste.gouv.fr/cassation/judilibre/v1.0'

export const onRequestOptions: PagesFunction<Env> = async (context) => {
  return new Response(null, { status: 204, headers: corsHeaders(context.env) })
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context
  const cors = corsHeaders(env)
  const jsonHeaders = { ...cors, 'Content-Type': 'application/json' }

  if (!env.CLERK_ISSUER_URL) {
    return new Response(
      JSON.stringify({ error: 'Server misconfigured' }),
      { status: 500, headers: jsonHeaders },
    )
  }

  if (!env.JUDILIBRE_API_KEY) {
    return new Response(
      JSON.stringify({ error: 'Judilibre API key not configured' }),
      { status: 500, headers: jsonHeaders },
    )
  }

  // Auth
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: jsonHeaders },
    )
  }

  let userId: string
  try {
    const jwt = await verifyClerkJWT(authHeader.slice(7), env.CLERK_ISSUER_URL, env.CLERK_JWT_AUDIENCE)
    userId = jwt.sub
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid token' }),
      { status: 401, headers: jsonHeaders },
    )
  }

  // Rate limit to protect shared Judilibre API quota
  if (env.USAGE_KV) {
    const rl = await checkRateLimit(env.USAGE_KV, 'judilibre', userId, RATE_LIMIT, RATE_WINDOW_SECONDS)
    if (!rl.allowed) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Try again later.' }),
        { status: 429, headers: { ...jsonHeaders, 'Retry-After': '60' } },
      )
    }
  }

  // Parse request
  let body: { action: string; [key: string]: unknown }
  try {
    body = await request.json()
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON' }),
      { status: 400, headers: jsonHeaders },
    )
  }

  try {
    if (body.action === 'search') {
      const params = new URLSearchParams({
        query: String(body.query ?? ''),
        page_size: String(body.pageSize ?? 10),
      })
      if (body.chamber) params.set('chamber', String(body.chamber))
      if (body.dateStart) params.set('date_start', String(body.dateStart))
      if (body.dateEnd) params.set('date_end', String(body.dateEnd))
      if (body.publication) params.set('publication', String(body.publication))

      const res = await fetch(`${JUDILIBRE_BASE}/search?${params}`, {
        headers: { KeyId: env.JUDILIBRE_API_KEY },
      })
      if (!res.ok) throw new Error(`Judilibre search: ${res.status}`)
      const data = await res.json()
      return new Response(JSON.stringify(data), { headers: jsonHeaders })
    }

    if (body.action === 'decision') {
      if (!body.id) {
        return new Response(
          JSON.stringify({ error: 'Missing decision id' }),
          { status: 400, headers: jsonHeaders },
        )
      }
      const res = await fetch(`${JUDILIBRE_BASE}/decision?id=${encodeURIComponent(body.id)}`, {
        headers: { KeyId: env.JUDILIBRE_API_KEY },
      })
      if (!res.ok) throw new Error(`Judilibre decision: ${res.status}`)
      const data = await res.json()
      return new Response(JSON.stringify(data), { headers: jsonHeaders })
    }

    return new Response(
      JSON.stringify({ error: 'Unknown action. Use "search" or "decision".' }),
      { status: 400, headers: jsonHeaders },
    )
  } catch (e) {
    return new Response(
      JSON.stringify({ error: `Judilibre API error: ${(e as Error).message}` }),
      { status: 502, headers: jsonHeaders },
    )
  }
}
