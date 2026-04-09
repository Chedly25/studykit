/**
 * GET /api/admin/revenue?period=30
 * Returns MRR, ARR, active subscriptions, and recent charges.
 */

import type { Env } from '../../env'
import { verifyAdmin, AdminError } from '../../lib/adminAuth'
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
    const rl = await checkRateLimit(env.USAGE_KV, 'admin-revenue', adminUser.userId, 30, 60)
    if (!rl.allowed) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
        status: 429, headers: { ...cors, 'Content-Type': 'application/json', 'Retry-After': '60' },
      })
    }
  }

  const url = new URL(request.url)
  const period = parseInt(url.searchParams.get('period') || '30', 10) || 30
  const since = Math.floor((Date.now() - period * 86400_000) / 1000)

  if (!env.STRIPE_SECRET_KEY) {
    return new Response(
      JSON.stringify({ mrr: 0, arr: 0, activeSubscriptions: [], recentCharges: [] }),
      { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  }

  try {
    const stripeAuth = { Authorization: `Basic ${btoa(env.STRIPE_SECRET_KEY + ':')}` }

    // Fetch charges
    const chargesRes = await fetch(
      `https://api.stripe.com/v1/charges?limit=25&created[gte]=${since}`,
      { headers: stripeAuth }
    )
    if (!chargesRes.ok) throw new Error(`Stripe charges API error: ${chargesRes.status}`)
    const chargesData = (await chargesRes.json()) as {
      data: Array<{
        id: string
        amount: number
        status: string
        created: number
        customer: string
        description: string | null
      }>
    }

    // Fetch all subscriptions with pagination
    type SubEntry = {
      id: string
      status: string
      current_period_end: number
      customer: { id: string; email: string; name: string | null } | string
      items: { data: Array<{ price: { unit_amount: number; recurring: { interval: string } } }> }
    }
    const allSubs: SubEntry[] = []
    let startingAfter: string | undefined
    while (true) {
      const params = new URLSearchParams({ status: 'active', limit: '100', 'expand[]': 'data.customer' })
      if (startingAfter) params.set('starting_after', startingAfter)
      const subsRes = await fetch(
        `https://api.stripe.com/v1/subscriptions?${params}`,
        { headers: stripeAuth }
      )
      if (!subsRes.ok) throw new Error(`Stripe subscriptions API error: ${subsRes.status}`)
      const page = (await subsRes.json()) as { data: SubEntry[]; has_more: boolean }
      allSubs.push(...page.data)
      if (!page.has_more || page.data.length === 0) break
      startingAfter = page.data[page.data.length - 1]?.id
    }

    let mrr = 0
    const activeSubscriptions = allSubs.map((sub) => {
      let subMrr = 0
      for (const item of sub.items.data) {
        const amount = item.price.unit_amount / 100
        if (item.price.recurring.interval === 'year') {
          subMrr += amount / 12
        } else {
          subMrr += amount
        }
      }
      mrr += subMrr

      const customer = typeof sub.customer === 'string'
        ? { id: sub.customer, email: '', name: null }
        : sub.customer

      return {
        id: sub.id,
        customerEmail: customer.email,
        customerName: customer.name,
        mrr: Math.round(subMrr * 100) / 100,
        currentPeriodEnd: sub.current_period_end,
      }
    })

    const recentCharges = chargesData.data
      .filter((c) => c.status === 'succeeded')
      .map((c) => ({
        id: c.id,
        amount: c.amount / 100,
        created: c.created,
        customer: c.customer,
        description: c.description,
      }))

    return new Response(
      JSON.stringify({
        mrr: Math.round(mrr * 100) / 100,
        arr: Math.round(mrr * 12 * 100) / 100,
        activeSubscriptions,
        recentCharges,
      }),
      { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('Admin revenue error:', err)
    return new Response(
      JSON.stringify({ error: 'Failed to fetch revenue data' }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  }
}
