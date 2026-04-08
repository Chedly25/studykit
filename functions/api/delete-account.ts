/**
 * Account Deletion API — GDPR right-to-erasure endpoint.
 * Deletes cloud sync data, changelog entries, and the Clerk user account.
 */
import type { Env } from '../env'
import { verifyClerkJWT } from '../lib/auth'
import { corsHeaders } from '../lib/cors'
import { checkRateLimit } from '../lib/rateLimiter'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const onRequestOptions: PagesFunction<Env> = async (context) => {
  return new Response(null, { status: 204, headers: corsHeaders(context.env) })
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env } = context
  const cors = corsHeaders(env)
  const json = { ...cors, 'Content-Type': 'application/json' }

  try {
    // --- Auth ---
    if (!env.CLERK_ISSUER_URL) {
      return new Response(JSON.stringify({ error: 'Auth not configured' }), { status: 500, headers: json })
    }

    const authHeader = context.request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: json })
    }

    let jwt
    try {
      jwt = await verifyClerkJWT(authHeader.slice(7), env.CLERK_ISSUER_URL, env.CLERK_JWT_AUDIENCE)
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401, headers: json })
    }

    const userId = jwt.sub

    // --- Rate limit: 1 request per hour ---
    if (!env.USAGE_KV) {
      return new Response(JSON.stringify({ error: 'Service temporarily unavailable' }), { status: 503, headers: json })
    }

    const rl = await checkRateLimit(env.USAGE_KV, 'delete-account', userId, 1, 3600)
    if (!rl.allowed) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded. You can only request account deletion once per hour.' }), {
        status: 429, headers: { ...json, 'Retry-After': '3600' },
      })
    }

    // --- Parse & validate body ---
    let body: { confirm?: string; profileIds?: string[] }
    try {
      body = await context.request.json()
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers: json })
    }

    if (body.confirm !== 'DELETE') {
      return new Response(JSON.stringify({ error: 'You must send {confirm: "DELETE"} to confirm account deletion.' }), {
        status: 400, headers: json,
      })
    }

    // Validate profileIds if provided
    const profileIds = body.profileIds ?? []
    for (const id of profileIds) {
      if (!UUID_RE.test(id)) {
        return new Response(JSON.stringify({ error: `Invalid profileId: ${id}` }), { status: 400, headers: json })
      }
    }

    const warnings: string[] = []

    // --- Delete cloud sync data ---
    if (env.SYNC_KV && profileIds.length > 0) {
      const deletePromises: Promise<void>[] = []
      for (const profileId of profileIds) {
        // Delete sync data
        deletePromises.push(env.SYNC_KV.delete(`sync:${userId}:${profileId}`))
        // Delete changelog entries
        deletePromises.push(env.SYNC_KV.delete(`changelog:${userId}:${profileId}`))
      }
      try {
        await Promise.all(deletePromises)
      } catch {
        warnings.push('Some cloud sync data may not have been fully deleted.')
      }
    }

    // --- Delete Clerk user account ---
    let clerkDeleted = false
    if (env.CLERK_SECRET_KEY) {
      try {
        const clerkRes = await fetch(`https://api.clerk.com/v1/users/${userId}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${env.CLERK_SECRET_KEY}`,
            'Content-Type': 'application/json',
          },
        })

        if (clerkRes.ok || clerkRes.status === 404) {
          // 404 means user already deleted — that's fine
          clerkDeleted = true
        } else {
          const errBody = await clerkRes.text().catch(() => 'Unknown error')
          warnings.push(`Clerk account deletion failed (status ${clerkRes.status}): ${errBody}`)
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        warnings.push(`Clerk account deletion failed: ${message}`)
      }
    } else {
      warnings.push('Clerk secret key not configured — user account was not deleted from auth provider.')
    }

    return new Response(
      JSON.stringify({
        success: true,
        clerkDeleted,
        profilesDeleted: profileIds.length,
        ...(warnings.length > 0 ? { warnings } : {}),
      }),
      { headers: json },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Account deletion failed'
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: json,
    })
  }
}
