/**
 * Cloud Sync API — store/retrieve profile data for Pro users.
 * Uses Cloudflare KV for storage, keyed by userId:profileId.
 */
import type { Env } from '../env'
import { verifyClerkJWT } from '../lib/auth'
import { addCorsHeaders, handleCors } from '../lib/cors'

export const onRequestOptions: PagesFunction<Env> = async (context) => {
  return handleCors(context.env)
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const token = context.request.headers.get('Authorization')?.replace('Bearer ', '')
    if (!token) return addCorsHeaders(new Response('Unauthorized', { status: 401 }), context.env)

    const jwt = await verifyClerkJWT(token, context.env.CLERK_ISSUER_URL)
    if (jwt.metadata?.plan !== 'pro') {
      return addCorsHeaders(
        new Response(JSON.stringify({ error: 'Cloud sync requires Pro plan' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }),
        context.env,
      )
    }

    const body = await context.request.text()
    if (!body || body.length > 25_000_000) {
      return addCorsHeaders(
        new Response(JSON.stringify({ error: 'Payload too large (max 25MB)' }), {
          status: 413,
          headers: { 'Content-Type': 'application/json' },
        }),
        context.env,
      )
    }

    // Extract profileId from the payload
    let profileId: string
    try {
      const parsed = JSON.parse(body)
      profileId = parsed.profile?.id
      if (!profileId) throw new Error('Missing profile ID')
    } catch {
      return addCorsHeaders(
        new Response(JSON.stringify({ error: 'Invalid payload — missing profile.id' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }),
        context.env,
      )
    }

    const key = `sync:${jwt.sub}:${profileId}`
    const syncedAt = new Date().toISOString()

    await context.env.SYNC_KV.put(key, body, {
      metadata: { syncedAt, userId: jwt.sub, profileId },
      expirationTtl: 90 * 86400, // 90 days TTL
    })

    return addCorsHeaders(
      new Response(JSON.stringify({ success: true, syncedAt }), {
        headers: { 'Content-Type': 'application/json' },
      }),
      context.env,
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Sync failed'
    return addCorsHeaders(
      new Response(JSON.stringify({ error: message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }),
      context.env,
    )
  }
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const token = context.request.headers.get('Authorization')?.replace('Bearer ', '')
    if (!token) return addCorsHeaders(new Response('Unauthorized', { status: 401 }), context.env)

    const jwt = await verifyClerkJWT(token, context.env.CLERK_ISSUER_URL)
    if (jwt.metadata?.plan !== 'pro') {
      return addCorsHeaders(
        new Response(JSON.stringify({ error: 'Cloud sync requires Pro plan' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }),
        context.env,
      )
    }

    const url = new URL(context.request.url)
    const profileId = url.searchParams.get('profileId')
    if (!profileId) {
      return addCorsHeaders(
        new Response(JSON.stringify({ error: 'Missing profileId parameter' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }),
        context.env,
      )
    }

    const key = `sync:${jwt.sub}:${profileId}`
    const { value, metadata } = await context.env.SYNC_KV.getWithMetadata(key)

    if (!value) {
      return addCorsHeaders(
        new Response(JSON.stringify({ error: 'No sync data found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }),
        context.env,
      )
    }

    return addCorsHeaders(
      new Response(value, {
        headers: {
          'Content-Type': 'application/json',
          'X-Synced-At': (metadata as any)?.syncedAt ?? '',
        },
      }),
      context.env,
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Sync failed'
    return addCorsHeaders(
      new Response(JSON.stringify({ error: message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }),
      context.env,
    )
  }
}

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  try {
    const token = context.request.headers.get('Authorization')?.replace('Bearer ', '')
    if (!token) return addCorsHeaders(new Response('Unauthorized', { status: 401 }), context.env)

    const jwt = await verifyClerkJWT(token, context.env.CLERK_ISSUER_URL)

    const url = new URL(context.request.url)
    const profileId = url.searchParams.get('profileId')
    if (!profileId) {
      return addCorsHeaders(
        new Response(JSON.stringify({ error: 'Missing profileId parameter' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }),
        context.env,
      )
    }

    const key = `sync:${jwt.sub}:${profileId}`
    await context.env.SYNC_KV.delete(key)

    return addCorsHeaders(
      new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' },
      }),
      context.env,
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Delete failed'
    return addCorsHeaders(
      new Response(JSON.stringify({ error: message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }),
      context.env,
    )
  }
}
