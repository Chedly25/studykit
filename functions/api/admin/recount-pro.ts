/**
 * POST /api/admin/recount-pro
 * Forces a full recount of Pro users and updates the KV cache.
 * Admin-only. Use for initial seeding or manual correction.
 */

import type { Env } from '../../env'
import { verifyAdmin, AdminError } from '../../lib/adminAuth'
import { corsHeaders } from '../../lib/cors'
import { checkRateLimit } from '../../lib/rateLimiter'

export const onRequestOptions: PagesFunction<Env> = async (context) => {
  return new Response(null, { status: 204, headers: corsHeaders(context.env) })
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context
  const cors = corsHeaders(env)

  let adminUser: { userId: string }
  try {
    adminUser = await verifyAdmin(request, env)
  } catch (e) {
    const status = e instanceof AdminError ? e.status : 403
    const message = e instanceof Error ? e.message : 'Unauthorized'
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  if (env.USAGE_KV) {
    const rl = await checkRateLimit(env.USAGE_KV, 'admin-recount', adminUser.userId, 5, 3600)
    if (!rl.allowed) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
        status: 429, headers: { ...cors, 'Content-Type': 'application/json', 'Retry-After': '3600' },
      })
    }
  }

  const clerkHeaders = {
    Authorization: `Bearer ${env.CLERK_SECRET_KEY}`,
    'Content-Type': 'application/json',
  }

  let count = 0
  let offset = 0
  const limit = 100
  let hasMore = true

  while (hasMore) {
    const res = await fetch(
      `https://api.clerk.com/v1/users?limit=${limit}&offset=${offset}`,
      { headers: clerkHeaders }
    )
    if (!res.ok) throw new Error(`Clerk API error: ${res.status}`)
    const users = (await res.json()) as Array<{ public_metadata?: { plan?: string } }>
    count += users.filter(u => u.public_metadata?.plan === 'pro').length
    hasMore = users.length === limit
    offset += limit
  }

  if (env.USAGE_KV) {
    await env.USAGE_KV.put('stats:pro_users', String(count), { expirationTtl: 3600 })
  }

  return new Response(JSON.stringify({ proUsers: count, cached: !!env.USAGE_KV }), {
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}
