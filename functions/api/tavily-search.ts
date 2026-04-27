/**
 * POST /api/tavily-search
 *
 * Proxies Tavily's search API with:
 *  - Clerk JWT auth
 *  - Tight rate limiting (fiche enrichment should be rare)
 *  - Cost protection
 *  - Server-side domain allowlist validation (defense against client bypass)
 *  - URL allowlist post-filter on Tavily's response
 *
 * Only used by the CRFPA legal fiche coach for the Actualité enrichment pass.
 */

import type { Env } from '../env'
import { verifyClerkJWT } from '../lib/auth'
import { corsHeaders } from '../lib/cors'
import { checkCostLimits } from '../lib/costProtection'
import { checkRateLimit } from '../lib/rateLimiter'

const TAVILY_URL = 'https://api.tavily.com/search'
const RATE_LIMIT = 20                    // 20 searches / hour / user
const RATE_WINDOW_SECONDS = 3600
const MAX_RESULTS_HARD_CAP = 20
const TAVILY_TIMEOUT_MS = 15000

/**
 * Server-side whitelist of domains we ever allow for Tavily searches.
 * Clients may pass a SUBSET of these per request; anything outside is rejected.
 * Keep in sync with TAVILY_DOMAINS in src/ai/prompts/legalFichePrompts.ts.
 */
const SERVER_DOMAIN_WHITELIST = new Set([
  'courdecassation.fr',
  'conseil-etat.fr',
  'conseil-constitutionnel.fr',
  'legifrance.gouv.fr',
  'dalloz-actualite.fr',
  'travail-emploi.gouv.fr',
  'impots.gouv.fr',
  'echr.coe.int',
])

interface TavilyApiResponse {
  results?: Array<{
    url?: string
    title?: string
    content?: string
    score?: number
    published_date?: string
  }>
}

interface RequestBody {
  query: string
  includeDomains: string[]
  maxResults?: number
  topic?: 'general' | 'news'
  days?: number
}

function isBareDomain(s: unknown): s is string {
  if (typeof s !== 'string') return false
  if (s.length === 0 || s.length > 253) return false
  if (/[\s/:]/.test(s)) return false
  return /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(s)
}

function hostOf(u: string): string | null {
  try {
    let cand = u.trim()
    if (!cand) return null
    if (!/^https?:\/\//i.test(cand)) cand = 'https://' + cand
    const url = new URL(cand)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    let h = url.hostname.toLowerCase()
    if (h.endsWith('.')) h = h.slice(0, -1)
    return h
  } catch {
    return null
  }
}

function isInAllowlist(url: string, allowlist: string[]): boolean {
  const h = hostOf(url)
  if (!h) return false
  for (const a of allowlist) {
    const bare = a.toLowerCase()
    if (h === bare || h.endsWith('.' + bare)) return true
  }
  return false
}

export const onRequestOptions: PagesFunction<Env> = async (context) => {
  return new Response(null, { status: 204, headers: corsHeaders(context.env) })
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context
  const cors = corsHeaders(env)
  const jsonH = { ...cors, 'Content-Type': 'application/json' }

  if (!env.TAVILY_API_KEY) {
    return new Response(
      JSON.stringify({ error: 'Tavily not configured' }),
      { status: 503, headers: jsonH },
    )
  }

  // Auth
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Missing Authorization header' }), { status: 401, headers: jsonH })
  }
  if (!env.CLERK_ISSUER_URL) {
    return new Response(JSON.stringify({ error: 'Server misconfigured' }), { status: 500, headers: jsonH })
  }
  let userId: string
  let userPlan: string | undefined
  try {
    const { sub, metadata } = await verifyClerkJWT(authHeader.slice(7), env.CLERK_ISSUER_URL, env.CLERK_JWT_AUDIENCE)
    userId = sub
    userPlan = metadata?.plan
  } catch {
    return new Response(JSON.stringify({ error: 'Authentication failed' }), { status: 401, headers: jsonH })
  }

  // Rate limit
  if (!env.USAGE_KV) {
    return new Response(JSON.stringify({ error: 'Service temporarily unavailable' }), { status: 503, headers: jsonH })
  }
  {
    const rl = await checkRateLimit(env.USAGE_KV, 'tavily', userId, RATE_LIMIT, RATE_WINDOW_SECONDS)
    if (!rl.allowed) {
      return new Response(JSON.stringify({ error: 'Tavily rate limit exceeded' }), { status: 429, headers: jsonH })
    }
  }

  // Cost protection — Tavily is cheap but we still gate it under the chat cost budget
  {
    const costCheck = await checkCostLimits(env, userId, 'chat', userPlan)
    if (!costCheck.allowed) {
      return new Response(JSON.stringify({ error: costCheck.reason ?? 'Daily limit reached' }), { status: 429, headers: jsonH })
    }
  }

  // Parse + validate body
  let body: RequestBody
  try {
    body = await request.json() as RequestBody
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: jsonH })
  }

  if (typeof body.query !== 'string' || body.query.trim().length === 0 || body.query.length > 500) {
    return new Response(JSON.stringify({ error: 'query must be a non-empty string (≤ 500 chars)' }), { status: 400, headers: jsonH })
  }
  if (!Array.isArray(body.includeDomains) || body.includeDomains.length === 0) {
    return new Response(JSON.stringify({ error: 'includeDomains must be a non-empty array' }), { status: 400, headers: jsonH })
  }

  // Every requested domain must be bare AND in the server whitelist
  for (const d of body.includeDomains) {
    if (!isBareDomain(d)) {
      return new Response(JSON.stringify({ error: `Invalid domain shape: ${d}` }), { status: 400, headers: jsonH })
    }
    if (!SERVER_DOMAIN_WHITELIST.has(d.toLowerCase())) {
      return new Response(JSON.stringify({ error: `Domain not in server whitelist: ${d}` }), { status: 400, headers: jsonH })
    }
  }

  const maxResults = Math.min(Math.max(1, body.maxResults ?? 10), MAX_RESULTS_HARD_CAP)
  const topic = body.topic === 'news' ? 'news' : 'general'
  const days = Math.min(Math.max(1, body.days ?? 540), 730)

  // Global usage counter for admin dashboard
  {
    const today = new Date().toISOString().slice(0, 10)
    const key = `usage:tavily:${today}`
    const count = await env.USAGE_KV.get(key)
    await env.USAGE_KV.put(key, String((count ? parseInt(count, 10) : 0) + 1), { expirationTtl: 86400 * 90 })
  }

  // Call Tavily
  const tavilyBody = {
    api_key: env.TAVILY_API_KEY,
    query: body.query,
    search_depth: 'basic',
    topic,
    days,
    max_results: maxResults,
    include_domains: body.includeDomains,
    include_answer: false,
    include_raw_content: false,
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), TAVILY_TIMEOUT_MS)
  let tavilyRes: Response
  try {
    tavilyRes = await fetch(TAVILY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tavilyBody),
      signal: controller.signal,
    })
  } catch (err) {
    clearTimeout(timeoutId)
    return new Response(
      JSON.stringify({ error: `Tavily unreachable: ${(err as Error).message}` }),
      { status: 502, headers: jsonH },
    )
  }
  clearTimeout(timeoutId)

  if (!tavilyRes.ok) {
    const text = await tavilyRes.text().catch(() => '')
    return new Response(
      JSON.stringify({ error: `Tavily responded ${tavilyRes.status}`, detail: text.slice(0, 500) }),
      { status: 502, headers: jsonH },
    )
  }

  let tavilyPayload: TavilyApiResponse
  try {
    tavilyPayload = await tavilyRes.json() as TavilyApiResponse
  } catch {
    return new Response(JSON.stringify({ error: 'Unparseable Tavily response' }), { status: 502, headers: jsonH })
  }

  const rawResults = Array.isArray(tavilyPayload.results) ? tavilyPayload.results : []
  // Strict: only keep entries whose URL is definitively in the requested allowlist.
  const results = rawResults
    .filter(r => typeof r.url === 'string' && isInAllowlist(r.url, body.includeDomains))
    .map(r => ({
      url: r.url as string,
      title: typeof r.title === 'string' ? r.title : '',
      content: typeof r.content === 'string' ? r.content : '',
      score: typeof r.score === 'number' ? r.score : 0,
      publishedDate: typeof r.published_date === 'string' ? r.published_date : undefined,
    }))

  const reason = results.length === 0
    ? (rawResults.length === 0 ? 'Tavily returned no results' : 'All Tavily results were rejected by the allowlist')
    : undefined

  return new Response(
    JSON.stringify({ results, reason }),
    { status: 200, headers: jsonH },
  )
}
