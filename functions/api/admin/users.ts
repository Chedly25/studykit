/**
 * Admin user management.
 * GET /api/admin/users?search=&limit=20&offset=0 — list users
 * POST /api/admin/users { userId, plan } — update user plan
 */

import type { Env } from '../../env'
import { verifyAdmin, AdminError } from '../../lib/adminAuth'
import { updateUserMetadata } from '../../lib/clerk'
import { corsHeaders } from '../../lib/cors'
import { checkRateLimit } from '../../lib/rateLimiter'

export const onRequestOptions: PagesFunction<Env> = async (context) => {
  return new Response(null, { status: 204, headers: corsHeaders(context.env) })
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
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
    const rl = await checkRateLimit(env.USAGE_KV, 'admin-users', adminUser.userId, 60, 60)
    if (!rl.allowed) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
        status: 429, headers: { ...cors, 'Content-Type': 'application/json', 'Retry-After': '60' },
      })
    }
  }

  const url = new URL(request.url)
  const search = url.searchParams.get('search') || ''
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10) || 20, 100)
  const offset = parseInt(url.searchParams.get('offset') || '0', 10) || 0

  try {
    const clerkHeaders = {
      Authorization: `Bearer ${env.CLERK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    }

    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
      order_by: '-created_at',
    })
    if (search) {
      params.set('query', search)
    }

    const [usersRes, countRes] = await Promise.all([
      fetch(`https://api.clerk.com/v1/users?${params}`, { headers: clerkHeaders }),
      fetch(
        `https://api.clerk.com/v1/users/count${search ? `?query=${encodeURIComponent(search)}` : ''}`,
        { headers: clerkHeaders }
      ),
    ])

    const usersData = (await usersRes.json()) as Array<{
      id: string
      first_name: string | null
      last_name: string | null
      email_addresses: Array<{ email_address: string }>
      image_url: string
      created_at: number
      public_metadata?: { plan?: string }
    }>

    const countData = (await countRes.json()) as { total_count?: number }

    const users = (Array.isArray(usersData) ? usersData : []).map((u) => ({
      id: u.id,
      firstName: u.first_name,
      lastName: u.last_name,
      email: u.email_addresses?.[0]?.email_address ?? '',
      imageUrl: u.image_url,
      createdAt: u.created_at,
      plan: u.public_metadata?.plan || 'free',
    }))

    return new Response(
      JSON.stringify({ users, totalCount: countData.total_count ?? 0 }),
      { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('Admin users error:', err)
    return new Response(
      JSON.stringify({ error: 'Failed to fetch users' }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  }
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
    const rl = await checkRateLimit(env.USAGE_KV, 'admin-users-write', adminUser.userId, 20, 60)
    if (!rl.allowed) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
        status: 429, headers: { ...cors, 'Content-Type': 'application/json', 'Retry-After': '60' },
      })
    }
  }

  try {
    const body = (await request.json()) as { userId: string; plan: string }
    if (!body.userId || !body.plan) {
      return new Response(
        JSON.stringify({ error: 'userId and plan are required' }),
        { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    if (body.plan !== 'pro' && body.plan !== 'free') {
      return new Response(
        JSON.stringify({ error: 'plan must be "pro" or "free"' }),
        { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    await updateUserMetadata(env.CLERK_SECRET_KEY, body.userId, { plan: body.plan })

    return new Response(
      JSON.stringify({ success: true, userId: body.userId, plan: body.plan }),
      { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('Admin user update error:', err)
    return new Response(
      JSON.stringify({ error: 'Failed to update user' }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  }
}
