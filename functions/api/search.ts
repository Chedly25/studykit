/**
 * Cloudflare Pages Function: POST /api/search
 * Proxies web search queries to Tavily API.
 * Shares rate limit with chat endpoint (60 req/hr).
 * Does NOT count against daily message quota.
 */

import type { Env } from '../env'
import { verifyClerkJWT } from '../lib/auth'
import { corsHeaders } from '../lib/cors'
import { checkCostLimits } from '../lib/costProtection'
import { checkRateLimit } from '../lib/rateLimiter'

const RATE_LIMIT = 60
const RATE_WINDOW_SECONDS = 3600

export const onRequestOptions: PagesFunction<Env> = async (context) => {
  return new Response(null, { status: 204, headers: corsHeaders(context.env) })
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context
  const cors = corsHeaders(env)

  // Require authentication config
  if (!env.CLERK_ISSUER_URL) {
    return new Response(
      JSON.stringify({ error: 'Server misconfigured: authentication not set up' }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } },
    )
  }

  // JWT authentication
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(
      JSON.stringify({ error: 'Missing or invalid Authorization header' }),
      { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } },
    )
  }

  let userId: string
  let userPlan: string | undefined
  try {
    const { sub, metadata } = await verifyClerkJWT(authHeader.slice(7), env.CLERK_ISSUER_URL, env.CLERK_JWT_AUDIENCE)
    userId = sub
    userPlan = metadata?.plan
  } catch {
    return new Response(
      JSON.stringify({ error: 'Authentication failed' }),
      { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } },
    )
  }

  // Rate limiting
  if (!env.USAGE_KV) {
    return new Response(
      JSON.stringify({ error: 'Service temporarily unavailable' }),
      { status: 503, headers: { ...cors, 'Content-Type': 'application/json' } },
    )
  }
  {
    const rl = await checkRateLimit(env.USAGE_KV, 'search', userId, RATE_LIMIT, RATE_WINDOW_SECONDS)
    if (!rl.allowed) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Try again later.' }),
        { status: 429, headers: { ...cors, 'Content-Type': 'application/json' } },
      )
    }
  }

  // Daily cap + global kill switch
  {
    const costCheck = await checkCostLimits(env, userId, 'search', userPlan)
    if (!costCheck.allowed) {
      return new Response(
        JSON.stringify({ error: costCheck.reason }),
        { status: 429, headers: { ...cors, 'Content-Type': 'application/json' } },
      )
    }
  }

  // Global usage counter for admin dashboard
  if (env.USAGE_KV) {
    const today = new Date().toISOString().slice(0, 10)
    const searchKey = `usage:search:${today}`
    const searchCount = await env.USAGE_KV.get(searchKey)
    await env.USAGE_KV.put(searchKey, String((searchCount ? parseInt(searchCount, 10) : 0) + 1), { expirationTtl: 86400 * 90 })
  }

  // Check Tavily API key
  if (!env.TAVILY_API_KEY) {
    return new Response(
      JSON.stringify({ results: [], unavailable: true }),
      { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } },
    )
  }

  // Parse request body
  let body: { query?: string; maxResults?: number; action?: string; urls?: string[] }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body' }),
      { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } },
    )
  }

  // ── Extract action: fetch full page content from URLs ──
  if (body.action === 'extract') {
    const urls = (body.urls ?? []).slice(0, 5).filter((u: string) => {
      try {
        const parsed = new URL(u)
        if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false
        const host = parsed.hostname.toLowerCase()
        if (host === 'localhost' || host === '127.0.0.1' || host === '[::1]') return false
        if (/^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.)/.test(host)) return false
        return true
      } catch { return false }
    })
    if (urls.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Missing urls array' }),
        { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } },
      )
    }
    try {
      const extractResponse = await fetch('https://api.tavily.com/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: env.TAVILY_API_KEY, urls }),
      })
      if (!extractResponse.ok) {
        return new Response(
          JSON.stringify({ results: [], error: 'Extract service unavailable' }),
          { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } },
        )
      }
      const data = await extractResponse.json()
      return new Response(JSON.stringify(data), {
        status: 200, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    } catch {
      return new Response(
        JSON.stringify({ results: [], error: 'Extract request failed' }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } },
      )
    }
  }

  // ── Search action (default) ──
  if (!body.query || typeof body.query !== 'string') {
    return new Response(
      JSON.stringify({ error: 'Missing required field: query' }),
      { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } },
    )
  }
  const query = body.query.slice(0, 400)
  const maxResults = Math.min(body.maxResults ?? 5, 10)

  try {
    const tavilyResponse = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: env.TAVILY_API_KEY,
        query,
        max_results: maxResults,
        include_answer: true,
        include_raw_content: false,
      }),
    })

    if (!tavilyResponse.ok) {
      console.error('Tavily API error:', tavilyResponse.status)
      return new Response(
        JSON.stringify({ results: [], error: 'Search service unavailable' }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } },
      )
    }

    const tavilyData = (await tavilyResponse.json()) as {
      results?: Array<{ title: string; url: string; content: string; score: number; raw_content?: string }>
      answer?: string
    }

    return new Response(
      JSON.stringify({
        results: (tavilyData.results ?? []).map(r => ({
          title: r.title,
          url: r.url,
          content: r.content,
          score: r.score,
        })),
        answer: tavilyData.answer,
      }),
      { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('Search error:', err)
    return new Response(
      JSON.stringify({ results: [], error: 'Search request failed' }),
      { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } },
    )
  }
}
