/**
 * Cloud Sync API — store/retrieve profile data for Pro users.
 * Uses Cloudflare KV for storage, keyed by userId:profileId.
 */
import type { Env } from '../env'
import { verifyClerkJWT } from '../lib/auth'
import { corsHeaders } from '../lib/cors'

export const onRequestOptions: PagesFunction<Env> = async (context) => {
  return new Response(null, { status: 204, headers: corsHeaders(context.env) })
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env } = context
  const cors = corsHeaders(env)

  try {
    if (!env.CLERK_ISSUER_URL) {
      return new Response(JSON.stringify({ error: 'Auth not configured' }), {
        status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const syncAuthHeader = context.request.headers.get('Authorization')
    if (!syncAuthHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const jwt = await verifyClerkJWT(syncAuthHeader.slice(7), env.CLERK_ISSUER_URL)
    if (jwt.metadata?.plan !== 'pro') {
      return new Response(JSON.stringify({ error: 'Cloud sync requires Pro plan' }), {
        status: 403, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

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
    if (!env.CLERK_ISSUER_URL) {
      return new Response(JSON.stringify({ error: 'Auth not configured' }), {
        status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const syncAuthHeader = context.request.headers.get('Authorization')
    if (!syncAuthHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const jwt = await verifyClerkJWT(syncAuthHeader.slice(7), env.CLERK_ISSUER_URL)
    if (jwt.metadata?.plan !== 'pro') {
      return new Response(JSON.stringify({ error: 'Cloud sync requires Pro plan' }), {
        status: 403, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const url = new URL(context.request.url)
    const profileId = url.searchParams.get('profileId')
    if (!profileId) {
      return new Response(JSON.stringify({ error: 'Missing profileId parameter' }), {
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
    if (!env.CLERK_ISSUER_URL) {
      return new Response(JSON.stringify({ error: 'Auth not configured' }), {
        status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const syncAuthHeader = context.request.headers.get('Authorization')
    if (!syncAuthHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const jwt = await verifyClerkJWT(syncAuthHeader.slice(7), env.CLERK_ISSUER_URL)
    if (jwt.metadata?.plan !== 'pro') {
      return new Response(JSON.stringify({ error: 'Cloud sync requires Pro plan' }), {
        status: 403, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const url = new URL(context.request.url)
    const profileId = url.searchParams.get('profileId')
    if (!profileId) {
      return new Response(JSON.stringify({ error: 'Missing profileId parameter' }), {
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
