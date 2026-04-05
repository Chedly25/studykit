/**
 * Push notification endpoint — subscribe/unsubscribe.
 * Requires Clerk JWT authentication. Rate limited.
 */
import type { Env } from '../env'
import { verifyClerkJWT } from '../lib/auth'
import { corsHeaders } from '../lib/cors'

const RATE_LIMIT = 30
const RATE_WINDOW_SECONDS = 3600

export const onRequestOptions: PagesFunction<Env> = async (context) => {
  return new Response(null, { status: 204, headers: corsHeaders(context.env) })
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const cors = corsHeaders(context.env)
  const url = new URL(context.request.url)
  const action = url.searchParams.get('action')

  if (action === 'vapid-key') {
    // VAPID public key is safe to expose (needed by browser for push subscription)
    return new Response(JSON.stringify({ publicKey: context.env.VAPID_PUBLIC_KEY || '' }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ error: 'Unknown action' }), {
    status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env } = context
  const cors = corsHeaders(env)

  // Auth required
  if (!env.CLERK_ISSUER_URL) {
    return new Response(JSON.stringify({ error: 'Auth not configured' }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const authHeader = context.request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  let userId: string
  try {
    const jwt = await verifyClerkJWT(authHeader.slice(7), env.CLERK_ISSUER_URL, env.CLERK_JWT_AUDIENCE)
    userId = jwt.sub
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid token' }), {
      status: 401, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  // Rate limit
  if (!env.USAGE_KV) {
    return new Response(JSON.stringify({ error: 'Service temporarily unavailable' }), {
      status: 503, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
  {
    const rateLimitKey = `push_rate:${userId}:${Math.floor(Date.now() / (RATE_WINDOW_SECONDS * 1000))}`
    const currentCount = parseInt((await env.USAGE_KV.get(rateLimitKey)) ?? '0', 10)
    if (currentCount >= RATE_LIMIT) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
        status: 429, headers: { ...cors, 'Content-Type': 'application/json', 'Retry-After': '60' },
      })
    }
    await env.USAGE_KV.put(rateLimitKey, String(currentCount + 1), { expirationTtl: RATE_WINDOW_SECONDS })
  }

  const kv = env.PUSH_SUBSCRIPTIONS
  if (!kv) {
    return new Response(JSON.stringify({ error: 'Push not configured' }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const body = await context.request.json() as {
    action: 'subscribe' | 'unsubscribe'
    subscription?: { endpoint: string; keys: { p256dh: string; auth: string } }
    endpoint?: string
  }

  if (body.action === 'subscribe' && body.subscription?.endpoint) {
    // Key subscriptions by userId so users can only manage their own
    const key = `${userId}:${encodeURIComponent(body.subscription.endpoint)}`
    await kv.put(key, JSON.stringify(body.subscription), { expirationTtl: 60 * 60 * 24 * 90 })
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  if (body.action === 'unsubscribe' && body.endpoint) {
    const key = `${userId}:${encodeURIComponent(body.endpoint)}`
    await kv.delete(key)
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ error: 'Unknown action or missing params' }), {
    status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
  })
}
