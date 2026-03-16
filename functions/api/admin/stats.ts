/**
 * GET /api/admin/stats
 * Returns overview statistics: users, revenue, AI usage.
 */

import type { Env } from '../../env'
import { verifyAdmin, AdminError } from '../../lib/adminAuth'
import { corsHeaders } from '../../lib/cors'

export const onRequestOptions: PagesFunction<Env> = async (context) => {
  return new Response(null, { status: 204, headers: corsHeaders(context.env) })
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context
  const cors = corsHeaders(env)

  try {
    await verifyAdmin(request, env)
  } catch (e) {
    const status = e instanceof AdminError ? e.status : 403
    const message = e instanceof Error ? e.message : 'Unauthorized'
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  try {
    const clerkHeaders = {
      Authorization: `Bearer ${env.CLERK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    }

    const today = new Date()
    const sevenDaysAgo = new Date(today.getTime() - 7 * 86400_000)
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 86400_000)

    const [totalCountRes, recentUsersRes, subscriptionsRes, chargesRes, aiCalls7d] =
      await Promise.all([
        // Total user count
        fetch('https://api.clerk.com/v1/users/count', { headers: clerkHeaders }),
        // Recent users (last 7 days)
        fetch(
          `https://api.clerk.com/v1/users?limit=100&order_by=-created_at`,
          { headers: clerkHeaders }
        ),
        // Active Stripe subscriptions
        env.STRIPE_SECRET_KEY
          ? fetch(
              'https://api.stripe.com/v1/subscriptions?status=active&limit=100',
              {
                headers: { Authorization: `Basic ${btoa(env.STRIPE_SECRET_KEY + ':')}` },
              }
            )
          : Promise.resolve(null),
        // Recent charges (last 30 days)
        env.STRIPE_SECRET_KEY
          ? fetch(
              `https://api.stripe.com/v1/charges?limit=100&created[gte]=${Math.floor(thirtyDaysAgo.getTime() / 1000)}`,
              {
                headers: { Authorization: `Basic ${btoa(env.STRIPE_SECRET_KEY + ':')}` },
              }
            )
          : Promise.resolve(null),
        // AI calls last 7 days from KV
        (async () => {
          if (!env.USAGE_KV) return 0
          let total = 0
          const promises = []
          for (let i = 0; i < 7; i++) {
            const date = new Date(today.getTime() - i * 86400_000)
              .toISOString()
              .slice(0, 10)
            promises.push(env.USAGE_KV.get(`usage:chat:${date}`))
          }
          const results = await Promise.all(promises)
          for (const r of results) {
            if (r) total += parseInt(r, 10)
          }
          return total
        })(),
      ])

    const totalCountData = (await totalCountRes.json()) as { total_count?: number; object?: string }
    const totalUsers = totalCountData.total_count ?? 0

    const recentUsers = (await recentUsersRes.json()) as Array<{
      created_at: number
      public_metadata?: { plan?: string }
    }>

    const newUsers7d = Array.isArray(recentUsers)
      ? recentUsers.filter((u) => u.created_at > sevenDaysAgo.getTime()).length
      : 0

    const proUsers = Array.isArray(recentUsers)
      ? recentUsers.filter((u) => u.public_metadata?.plan === 'pro').length
      : 0

    let mrr = 0
    let revenue30d = 0

    if (subscriptionsRes) {
      const subData = (await subscriptionsRes.json()) as {
        data: Array<{
          items: { data: Array<{ price: { unit_amount: number; recurring: { interval: string } } }> }
        }>
      }
      for (const sub of subData.data) {
        for (const item of sub.items.data) {
          const amount = item.price.unit_amount / 100
          if (item.price.recurring.interval === 'year') {
            mrr += amount / 12
          } else {
            mrr += amount
          }
        }
      }
    }

    if (chargesRes) {
      const chargeData = (await chargesRes.json()) as {
        data: Array<{ amount: number; status: string }>
      }
      revenue30d = chargeData.data
        .filter((c) => c.status === 'succeeded')
        .reduce((sum, c) => sum + c.amount / 100, 0)
    }

    return new Response(
      JSON.stringify({
        totalUsers,
        newUsers7d,
        proUsers,
        mrr: Math.round(mrr * 100) / 100,
        revenue30d: Math.round(revenue30d * 100) / 100,
        aiCalls7d,
      }),
      { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('Admin stats error:', err)
    return new Response(
      JSON.stringify({ error: 'Failed to fetch stats' }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  }
}
