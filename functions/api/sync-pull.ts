/**
 * Incremental sync pull — returns changelog entries newer than `since`.
 * Reads KV keys with prefix changelog:{userId}:{profileId}: and filters by timestamp.
 */
import type { Env } from '../env'
import { verifyClerkJWT } from '../lib/auth'
import { corsHeaders } from '../lib/cors'
import { checkRateLimit } from '../lib/rateLimiter'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SYNC_RATE_LIMIT = 30
const SYNC_RATE_WINDOW_SECONDS = 3600

export const onRequestOptions: PagesFunction<Env> = async (context) => {
  return new Response(null, { status: 204, headers: corsHeaders(context.env) })
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
      const rl = await checkRateLimit(env.USAGE_KV, 'sync-pull', jwt.sub, SYNC_RATE_LIMIT, SYNC_RATE_WINDOW_SECONDS)
      if (!rl.allowed) {
        return new Response(JSON.stringify({ error: 'Sync rate limit exceeded. Try again later.' }), {
          status: 429, headers: { ...cors, 'Content-Type': 'application/json', 'Retry-After': '60' },
        })
      }
    }

    const url = new URL(context.request.url)
    const profileId = url.searchParams.get('profileId')
    const sinceRaw = url.searchParams.get('since') ?? '1970-01-01T00:00:00Z'
    const sinceMs = new Date(sinceRaw).getTime()
    if (isNaN(sinceMs)) {
      return new Response(JSON.stringify({ error: 'Invalid since parameter — must be ISO 8601 date' }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    if (!profileId || !UUID_RE.test(profileId)) {
      return new Response(JSON.stringify({ error: 'Invalid or missing profileId' }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const prefix = `changelog:${jwt.sub}:${profileId}:`
    const MAX_CHANGES_PER_PULL = 500

    // List changelog keys for this profile, capped at MAX_CHANGES_PER_PULL
    const allChanges: Array<{ table: string; recordId: string; operation: string; data?: unknown; timestamp: string }> = []
    let cursor: string | undefined
    let limitReached = false

    // Phase 1: collect all eligible key names
    const keysToFetch: string[] = []
    do {
      const list = await env.SYNC_KV.list({ prefix, cursor })

      for (const key of list.keys) {
        if (keysToFetch.length >= MAX_CHANGES_PER_PULL) {
          limitReached = true
          break
        }

        // Extract timestamp from key: changelog:userId:profileId:TIMESTAMP
        const keyTimestamp = key.name.slice(prefix.length)
        const keyMs = new Date(keyTimestamp).getTime()
        if (isNaN(keyMs) || keyMs <= sinceMs) continue // Skip invalid or older entries

        keysToFetch.push(key.name)
      }

      if (limitReached) break
      cursor = list.list_complete ? undefined : list.cursor
    } while (cursor)

    // Phase 2: fetch values in parallel batches of 50
    const BATCH_SIZE = 50
    for (let i = 0; i < keysToFetch.length; i += BATCH_SIZE) {
      const batch = keysToFetch.slice(i, i + BATCH_SIZE)
      const results = await Promise.all(
        batch.map(k => env.SYNC_KV.get(k, 'json') as Promise<{
          changes: Array<{ table: string; recordId: string; operation: string; data?: unknown; timestamp: string }>
        } | null>)
      )
      for (const value of results) {
        if (value?.changes) {
          allChanges.push(...value.changes)
        }
      }
    }

    // Sort by timestamp ascending
    allChanges.sort((a, b) => a.timestamp.localeCompare(b.timestamp))

    return new Response(JSON.stringify({
      changes: allChanges,
      serverTimestamp: new Date().toISOString(),
      changeCount: allChanges.length,
      hasMore: limitReached,
    }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Sync pull failed' }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
}
