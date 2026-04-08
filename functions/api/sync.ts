/**
 * Cloud Sync API — store/retrieve profile data for Pro users.
 * Uses Cloudflare KV for storage, keyed by userId:profileId.
 */
import type { Env } from '../env'
import { verifyClerkJWT, type JWTPayload } from '../lib/auth'
import { corsHeaders } from '../lib/cors'
import { checkRateLimit } from '../lib/rateLimiter'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SYNC_RATE_LIMIT = 30
const SYNC_RATE_WINDOW_SECONDS = 3600

/** Shared auth + pro + rate-limit gate for all sync methods. */
async function requireSyncAuth(
  request: Request,
  env: Env,
  endpoint: string,
): Promise<{ jwt: JWTPayload; error?: undefined } | { error: Response }> {
  const cors = corsHeaders(env)
  const json = { ...cors, 'Content-Type': 'application/json' }

  if (!env.CLERK_ISSUER_URL) {
    return { error: new Response(JSON.stringify({ error: 'Auth not configured' }), { status: 500, headers: json }) }
  }

  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return { error: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: json }) }
  }

  let jwt: JWTPayload
  try {
    jwt = await verifyClerkJWT(authHeader.slice(7), env.CLERK_ISSUER_URL, env.CLERK_JWT_AUDIENCE)
  } catch {
    return { error: new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401, headers: json }) }
  }

  if (jwt.metadata?.plan !== 'pro') {
    return { error: new Response(JSON.stringify({ error: 'Cloud sync requires Pro plan' }), { status: 403, headers: json }) }
  }

  if (!env.USAGE_KV) {
    return { error: new Response(JSON.stringify({ error: 'Service temporarily unavailable' }), { status: 503, headers: json }) }
  }

  const rl = await checkRateLimit(env.USAGE_KV, endpoint, jwt.sub, SYNC_RATE_LIMIT, SYNC_RATE_WINDOW_SECONDS)
  if (!rl.allowed) {
    return { error: new Response(JSON.stringify({ error: 'Sync rate limit exceeded. Try again later.' }), { status: 429, headers: { ...json, 'Retry-After': '60' } }) }
  }

  return { jwt }
}

export const onRequestOptions: PagesFunction<Env> = async (context) => {
  return new Response(null, { status: 204, headers: corsHeaders(context.env) })
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env } = context
  const cors = corsHeaders(env)

  try {
    const auth = await requireSyncAuth(context.request, env, 'sync-store')
    if (auth.error) return auth.error
    const { jwt } = auth

    const body = await context.request.text()
    if (!body || body.length > 25_000_000) {
      return new Response(JSON.stringify({ error: 'Payload too large (max 25MB)' }), {
        status: 413, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    let profileId: string
    try {
      const parsed = JSON.parse(body)
      profileId = parsed.profile?.id
      if (!profileId) throw new Error('Missing profile ID')
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid payload — missing profile.id' }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    if (!UUID_RE.test(profileId)) {
      return new Response(JSON.stringify({ error: 'Invalid profileId' }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const key = `sync:${jwt.sub}:${profileId}`
    const syncedAt = new Date().toISOString()

    await env.SYNC_KV.put(key, body, {
      metadata: { syncedAt, userId: jwt.sub, profileId },
      expirationTtl: 90 * 86400,
    })

    return new Response(JSON.stringify({ success: true, syncedAt }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Sync failed'
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env } = context
  const cors = corsHeaders(env)

  try {
    const auth = await requireSyncAuth(context.request, env, 'sync-pull')
    if (auth.error) return auth.error
    const { jwt } = auth

    const url = new URL(context.request.url)
    const profileId = url.searchParams.get('profileId')
    if (!profileId || !UUID_RE.test(profileId)) {
      return new Response(JSON.stringify({ error: 'Invalid or missing profileId' }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const key = `sync:${jwt.sub}:${profileId}`
    const { value, metadata } = await env.SYNC_KV.getWithMetadata(key)

    if (!value) {
      return new Response(JSON.stringify({ error: 'No sync data found' }), {
        status: 404, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    return new Response(value, {
      headers: {
        ...cors,
        'Content-Type': 'application/json',
        'X-Synced-At': (metadata as Record<string, string>)?.syncedAt ?? '',
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Sync failed'
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
}

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { env } = context
  const cors = corsHeaders(env)

  try {
    const auth = await requireSyncAuth(context.request, env, 'sync-delete')
    if (auth.error) return auth.error
    const { jwt } = auth

    const url = new URL(context.request.url)
    const profileId = url.searchParams.get('profileId')
    if (!profileId || !UUID_RE.test(profileId)) {
      return new Response(JSON.stringify({ error: 'Invalid or missing profileId' }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const key = `sync:${jwt.sub}:${profileId}`
    await env.SYNC_KV.delete(key)

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Delete failed'
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
}
