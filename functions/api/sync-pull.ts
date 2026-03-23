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

    // List all changelog keys for this profile
    const allChanges: Array<{ table: string; recordId: string; operation: string; data?: unknown; timestamp: string }> = []
    let cursor: string | undefined

    // Paginate through KV list (max 1000 per call)
    do {
      const list = await env.SYNC_KV.list({ prefix, cursor })

      for (const key of list.keys) {
        // Extract timestamp from key: changelog:userId:profileId:TIMESTAMP
        const keyTimestamp = key.name.slice(prefix.length)
        if (keyTimestamp <= since) continue // Skip entries older than since

        const value = await env.SYNC_KV.get(key.name, 'json') as {
          changes: Array<{ table: string; recordId: string; operation: string; data?: unknown; timestamp: string }>
        } | null

        if (value?.changes) {
          allChanges.push(...value.changes)
        }
      }

      cursor = list.list_complete ? undefined : list.cursor
    } while (cursor)

    // Sort by timestamp ascending
    allChanges.sort((a, b) => a.timestamp.localeCompare(b.timestamp))

    return new Response(JSON.stringify({
      changes: allChanges,
      serverTimestamp: new Date().toISOString(),
      changeCount: allChanges.length,
    }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Sync pull failed' }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
}
