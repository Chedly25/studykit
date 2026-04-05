/**
 * Incremental sync push — stores a changelog delta in KV.
 * Key: changelog:{userId}:{profileId}:{timestamp}
 */
import type { Env } from '../env'
import { verifyClerkJWT } from '../lib/auth'
import { corsHeaders } from '../lib/cors'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SYNC_RATE_LIMIT = 30
const SYNC_RATE_WINDOW_SECONDS = 3600

export const onRequestOptions: PagesFunction<Env> = async (context) => {
  return new Response(null, { status: 204, headers: corsHeaders(context.env) })
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env } = context
  const cors = corsHeaders(env)

  try {
    const authHeader = context.request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const jwt = await verifyClerkJWT(authHeader.slice(7), env.CLERK_ISSUER_URL, env.CLERK_JWT_AUDIENCE)
    if (jwt.metadata?.plan !== 'pro') {
      return new Response(JSON.stringify({ error: 'Pro plan required' }), {
        status: 403, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    // Rate limit
    if (!env.USAGE_KV) {
      return new Response(JSON.stringify({ error: 'Service temporarily unavailable' }), {
        status: 503, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }
    {
      const rateLimitKey = `sync_rate:push:${jwt.sub}:${Math.floor(Date.now() / (SYNC_RATE_WINDOW_SECONDS * 1000))}`
      const currentCount = parseInt((await env.USAGE_KV.get(rateLimitKey)) ?? '0', 10)
      if (currentCount >= SYNC_RATE_LIMIT) {
        return new Response(JSON.stringify({ error: 'Sync rate limit exceeded. Try again later.' }), {
          status: 429, headers: { ...cors, 'Content-Type': 'application/json', 'Retry-After': '60' },
        })
      }
      await env.USAGE_KV.put(rateLimitKey, String(currentCount + 1), { expirationTtl: SYNC_RATE_WINDOW_SECONDS })
    }

    const body = await context.request.json() as {
      profileId: string
      changes: Array<{ table: string; recordId: string; operation: string; data?: unknown; timestamp: string }>
      clientTimestamp: string
    }

    if (!body.profileId || !body.changes || body.changes.length === 0) {
      return new Response(JSON.stringify({ error: 'No changes to push' }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    // Validate profileId format
    if (!UUID_RE.test(body.profileId)) {
      return new Response(JSON.stringify({ error: 'Invalid profileId' }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    // Validate clientTimestamp
    const ts = new Date(body.clientTimestamp)
    if (isNaN(ts.getTime()) || ts.getTime() > Date.now() + 60_000) {
      return new Response(JSON.stringify({ error: 'Invalid timestamp' }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    // Limit payload size
    const payload = JSON.stringify(body)
    if (payload.length > 5_000_000) {
      return new Response(JSON.stringify({ error: 'Delta too large (max 5MB per push)' }), {
        status: 413, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const key = `changelog:${jwt.sub}:${body.profileId}:${body.clientTimestamp}`
    await env.SYNC_KV.put(key, payload, {
      expirationTtl: 90 * 24 * 60 * 60, // 90 days
      metadata: { timestamp: body.clientTimestamp, changeCount: body.changes.length },
    })

    return new Response(JSON.stringify({
      success: true,
      serverTimestamp: new Date().toISOString(),
      changesStored: body.changes.length,
    }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Sync push failed' }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
}
