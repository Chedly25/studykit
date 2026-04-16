/**
 * POST /api/random-decision
 * Returns a random Cour de cassation decision from Vectorize, optionally
 * filtered by chamber. Used by the Fiche d'arrêt Trainer.
 *
 * Randomness strategy: generate a random unit vector in 1024-dim, query
 * Vectorize with metadata filter on codeName, take top 10 and pick one
 * the client hasn't seen recently.
 */
import type { Env } from '../env'
import { verifyClerkJWT } from '../lib/auth'
import { corsHeaders } from '../lib/cors'
import { checkRateLimit } from '../lib/rateLimiter'

const VECTOR_DIM = 1024

/** Box-Muller to produce standard normal samples, then normalize to unit length. */
function randomUnitVector(dim: number): number[] {
  const v = new Array(dim)
  for (let i = 0; i < dim; i += 2) {
    // Box-Muller transform — two N(0,1) samples per pair
    const u1 = Math.max(Math.random(), 1e-10)
    const u2 = Math.random()
    const mag = Math.sqrt(-2 * Math.log(u1))
    v[i] = mag * Math.cos(2 * Math.PI * u2)
    if (i + 1 < dim) v[i + 1] = mag * Math.sin(2 * Math.PI * u2)
  }
  let norm = 0
  for (const x of v) norm += x * x
  norm = Math.sqrt(norm) || 1
  return v.map(x => x / norm)
}

export const onRequestOptions: PagesFunction<Env> = async (context) => {
  return new Response(null, { status: 204, headers: corsHeaders(context.env) })
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context
  const cors = corsHeaders(env)
  const jsonHeaders = { ...cors, 'Content-Type': 'application/json' }

  // Auth: JWT or admin API key (matches legal-search pattern)
  const authHeader = request.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: jsonHeaders })
  }

  let userId: string
  if (authHeader.startsWith('ApiKey ') && env.ADMIN_API_KEY && authHeader.slice(7) === env.ADMIN_API_KEY) {
    userId = 'admin'
  } else if (authHeader.startsWith('Bearer ')) {
    try {
      const jwt = await verifyClerkJWT(authHeader.slice(7), env.CLERK_ISSUER_URL, env.CLERK_JWT_AUDIENCE)
      userId = jwt.sub
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401, headers: jsonHeaders })
    }
  } else {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: jsonHeaders })
  }

  // Rate limit — same bucket as legal-search since it uses the same index
  if (env.USAGE_KV) {
    const rl = await checkRateLimit(env.USAGE_KV, 'legal-search', userId, 60, 3600)
    if (!rl.allowed) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), { status: 429, headers: jsonHeaders })
    }
  }

  if (!env.LEGAL_CODES_INDEX) {
    return new Response(JSON.stringify({ error: 'Legal search not available' }), { status: 503, headers: jsonHeaders })
  }

  let body: { codeName?: string; excludeIds?: string[] }
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: jsonHeaders })
  }

  const excludeIds = new Set(body.excludeIds ?? [])

  try {
    // Random unit vector + metadata filter on chamber
    const randomVector = randomUnitVector(VECTOR_DIM)
    const filter = body.codeName ? { codeName: body.codeName } : undefined
    const matches = await env.LEGAL_CODES_INDEX.query(randomVector, {
      topK: 20,
      returnMetadata: 'all',
      ...(filter ? { filter } : {}),
    })

    const candidates = (matches.matches ?? []).filter(m => !excludeIds.has(m.id))
    if (candidates.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No decision found for this chamber' }),
        { status: 404, headers: jsonHeaders },
      )
    }

    // Pick a random one from the candidates — not just top 1 — for more variety
    const picked = candidates[Math.floor(Math.random() * candidates.length)]
    const meta = (picked.metadata ?? {}) as Record<string, string>

    return new Response(
      JSON.stringify({
        id: picked.id,
        codeName: meta.codeName ?? '',
        reference: meta.num ?? '',
        breadcrumb: meta.breadcrumb ?? '',
        text: meta.text ?? '',
      }),
      { headers: jsonHeaders },
    )
  } catch (e) {
    return new Response(
      JSON.stringify({ error: `Random decision fetch failed: ${(e as Error).message}` }),
      { status: 502, headers: jsonHeaders },
    )
  }
}
