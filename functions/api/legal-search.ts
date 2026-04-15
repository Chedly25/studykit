/**
 * POST /api/legal-search
 * Semantic search across all French legal codes via Cloudflare Vectorize.
 * Embeds the query, queries the vector index, returns matching articles with metadata.
 */
import type { Env } from '../env'
import { verifyClerkJWT } from '../lib/auth'
import { corsHeaders } from '../lib/cors'
import { checkRateLimit } from '../lib/rateLimiter'
import { checkCostLimits } from '../lib/costProtection'

export const onRequestOptions: PagesFunction<Env> = async (context) => {
  return new Response(null, { status: 204, headers: corsHeaders(context.env) })
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context
  const cors = corsHeaders(env)
  const jsonHeaders = { ...cors, 'Content-Type': 'application/json' }

  // Auth: JWT or admin API key
  const authHeader = request.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: jsonHeaders })
  }

  let userId: string
  let plan = 'free'

  if (authHeader.startsWith('ApiKey ') && env.ADMIN_API_KEY && authHeader.slice(7) === env.ADMIN_API_KEY) {
    userId = 'admin'
    plan = 'pro'
  } else if (authHeader.startsWith('Bearer ')) {
    try {
      const jwt = await verifyClerkJWT(authHeader.slice(7), env.CLERK_ISSUER_URL, env.CLERK_JWT_AUDIENCE)
      userId = jwt.sub
      plan = (jwt.metadata as { plan?: string })?.plan ?? 'free'
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401, headers: jsonHeaders })
    }
  } else {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: jsonHeaders })
  }

  // Rate limit
  if (env.USAGE_KV) {
    const rl = await checkRateLimit(env.USAGE_KV, 'legal-search', userId, 60, 3600)
    if (!rl.allowed) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), { status: 429, headers: jsonHeaders })
    }
  }

  const cost = await checkCostLimits(env, userId, 'search', plan)
  if (!cost.allowed) {
    return new Response(JSON.stringify({ error: cost.reason ?? 'Daily limit reached' }), { status: 429, headers: jsonHeaders })
  }

  if (!env.LEGAL_CODES_INDEX) {
    return new Response(JSON.stringify({ error: 'Legal search not available' }), { status: 503, headers: jsonHeaders })
  }

  let body: { query?: string; topK?: number; codeName?: string; vector?: number[] }
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: jsonHeaders })
  }

  const query = String(body.query ?? '').trim()
  if (!query || query.length < 3) {
    return new Response(JSON.stringify({ error: 'Query too short' }), { status: 400, headers: jsonHeaders })
  }

  const topK = Math.min(Math.max(body.topK ?? 10, 1), 20)

  try {
    // Use pre-computed vector from client if available, else embed via HuggingFace
    let queryVector: number[] | undefined = body.vector

    if (!queryVector || queryVector.length !== 1024) {
      // Embed via HuggingFace Inference API (intfloat/multilingual-e5-large, free with token)
      const hfToken = env.HF_API_TOKEN
      if (hfToken) {
        const hfRes = await fetch('https://router.huggingface.co/hf-inference/models/intfloat/multilingual-e5-large', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${hfToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ inputs: `query: ${query}` }),
        })
        if (hfRes.ok) {
          const hfData = await hfRes.json() as number[] | number[][]
          queryVector = Array.isArray(hfData[0]) ? (hfData as number[][])[0] : hfData as number[]
        }
      }
      // Fallback: Workers AI
      if (!queryVector) {
        try {
          const embResult = await env.AI.run('@cf/baai/bge-m3', { text: [query] })
          queryVector = embResult.data?.[0]
        } catch { /* quota exhausted */ }
      }
    }

    if (!queryVector) {
      return new Response(JSON.stringify({ error: 'Embedding failed — configure HF_API_TOKEN or wait for Workers AI quota reset' }), { status: 502, headers: jsonHeaders })
    }

    // Query Vectorize
    const filter = body.codeName ? { codeName: body.codeName } : undefined
    const matches = await env.LEGAL_CODES_INDEX.query(queryVector, {
      topK,
      returnMetadata: 'all',
      ...(filter ? { filter } : {}),
    })

    const results = (matches.matches ?? []).map(m => ({
      id: m.id,
      score: m.score,
      articleNum: (m.metadata as Record<string, string>)?.num ?? '',
      codeName: (m.metadata as Record<string, string>)?.codeName ?? '',
      breadcrumb: (m.metadata as Record<string, string>)?.breadcrumb ?? '',
      text: (m.metadata as Record<string, string>)?.text ?? '',
    }))

    return new Response(JSON.stringify({ results, count: results.length }), { headers: jsonHeaders })
  } catch (e) {
    return new Response(
      JSON.stringify({ error: `Legal search failed: ${(e as Error).message}` }),
      { status: 502, headers: jsonHeaders },
    )
  }
}
