/**
 * GET /api/admin/usage?days=30
 * Returns daily and total API usage stats from KV counters.
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
    const rl = await checkRateLimit(env.USAGE_KV, 'admin-usage', adminUser.userId, 30, 60)
    if (!rl.allowed) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
        status: 429, headers: { ...cors, 'Content-Type': 'application/json', 'Retry-After': '60' },
      })
    }
  }

  const url = new URL(request.url)
  const days = Math.min(parseInt(url.searchParams.get('days') || '30', 10), 90)

  if (!env.USAGE_KV) {
    return new Response(
      JSON.stringify({ daily: [], totals: { chat: 0, embed: 0, search: 0 } }),
      { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  }

  try {
    const today = new Date()
    const types = ['chat', 'embed', 'search'] as const
    const promises: Promise<string | null>[] = []
    const keyMap: Array<{ type: string; date: string; index: number }> = []

    for (let i = 0; i < days; i++) {
      const date = new Date(today.getTime() - i * 86400_000).toISOString().slice(0, 10)
      for (const type of types) {
        keyMap.push({ type, date, index: promises.length })
        promises.push(env.USAGE_KV.get(`usage:${type}:${date}`))
      }
    }

    const results = await Promise.all(promises)

    const dailyMap = new Map<string, { date: string; chat: number; embed: number; search: number }>()
    const totals = { chat: 0, embed: 0, search: 0 }

    for (const { type, date, index } of keyMap) {
      const count = results[index] ? parseInt(results[index]!, 10) : 0
      if (!dailyMap.has(date)) {
        dailyMap.set(date, { date, chat: 0, embed: 0, search: 0 })
      }
      const day = dailyMap.get(date)!
      day[type as keyof typeof totals] = count
      totals[type as keyof typeof totals] += count
    }

    // Sort by date ascending
    const daily = Array.from(dailyMap.values()).sort(
      (a, b) => a.date.localeCompare(b.date)
    )

    return new Response(
      JSON.stringify({ daily, totals }),
      { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('Admin usage error:', err)
    return new Response(
      JSON.stringify({ error: 'Failed to fetch usage data' }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  }
}
