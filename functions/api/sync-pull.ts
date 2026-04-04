/**
 * Incremental sync pull — returns changelog entries newer than `since`.
 * Reads KV keys with prefix changelog:{userId}:{profileId}: and filters by timestamp.
 */
import type { Env } from '../env'
import { verifyClerkJWT } from '../lib/auth'
import { corsHeaders } from '../lib/cors'

export const onRequestOptions: PagesFunction<Env> = async (context) => {
  return new Response(null, { status: 204, headers: corsHeaders(context.env) })
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env } = context
  const cors = corsHeaders(env)

  try {
    const authHeader = context.request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const jwt = await verifyClerkJWT(authHeader.slice(7), env.CLERK_ISSUER_URL)
    if (jwt.metadata?.plan !== 'pro') {
      return new Response(JSON.stringify({ error: 'Pro plan required' }), {
        status: 403, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const url = new URL(context.request.url)
    const profileId = url.searchParams.get('profileId')
    const since = url.searchParams.get('since') ?? '1970-01-01T00:00:00Z'

    if (!profileId) {
      return new Response(JSON.stringify({ error: 'profileId required' }), {
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
        if (keyTimestamp <= since) continue // Skip entries older than since

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
