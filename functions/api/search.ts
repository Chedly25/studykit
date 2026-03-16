/**
 * Cloudflare Pages Function: POST /api/search
 * Proxies web search queries to Tavily API.
 * Shares rate limit with chat endpoint (60 req/hr).
 * Does NOT count against daily message quota.
 */

import type { Env } from '../env'
import { verifyClerkJWT } from '../lib/auth'
import { corsHeaders } from '../lib/cors'

const RATE_LIMIT = 60
const RATE_WINDOW_SECONDS = 3600

async function checkRateLimitKV(
  kv: KVNamespace,
  userId: string,
): Promise<{ allowed: boolean; remaining: number }> {
  const windowKey = `ratelimit:${userId}:${Math.floor(Date.now() / 1000 / RATE_WINDOW_SECONDS)}`
  const currentStr = await kv.get(windowKey)
  const current = currentStr ? parseInt(currentStr, 10) : 0

  if (current >= RATE_LIMIT) {
    return { allowed: false, remaining: 0 }
  }

  const newCount = current + 1
  await kv.put(windowKey, String(newCount), { expirationTtl: RATE_WINDOW_SECONDS })
  return { allowed: true, remaining: RATE_LIMIT - newCount }
}

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
  try {
    const { sub } = await verifyClerkJWT(authHeader.slice(7), env.CLERK_ISSUER_URL)
    userId = sub
  } catch {
    return new Response(
      JSON.stringify({ error: 'Authentication failed' }),
      { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } },
    )
  }

  // Rate limiting
  if (env.USAGE_KV) {
    const rl = await checkRateLimitKV(env.USAGE_KV, userId)
    if (!rl.allowed) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Try again later.' }),
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
  let query: string
  let maxResults: number
  try {
    const body = (await request.json()) as { query?: string; maxResults?: number }
    if (!body.query || typeof body.query !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Missing required field: query' }),
        { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } },
      )
    }
    query = body.query.slice(0, 400) // Limit query length
    maxResults = Math.min(body.maxResults ?? 5, 10)
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body' }),
      { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } },
    )
  }

  // Call Tavily API
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
      results?: Array<{ title: string; url: string; content: string; score: number }>
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
