/**
 * Cloudflare Pages Function: POST /api/chat
 * Uses Cloudflare Workers AI (Llama 3.3 70B) — no API key needed.
 * Stores ZERO student data.
 */

interface Env {
  AI: Ai
  ALLOWED_ORIGIN?: string
  CLERK_ISSUER_URL?: string
}

const DEFAULT_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast'

// ─── Rate limiter (in-memory, resets per isolate) ────────────────
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

function checkRateLimit(key: string, limit = 60, windowMs = 60 * 60 * 1000) {
  const now = Date.now()
  const entry = rateLimitStore.get(key)
  if (!entry || now > entry.resetTime) {
    rateLimitStore.set(key, { count: 1, resetTime: now + windowMs })
    return { allowed: true, remaining: limit - 1 }
  }
  if (entry.count >= limit) {
    return { allowed: false, remaining: 0 }
  }
  entry.count++
  return { allowed: true, remaining: limit - entry.count }
}

// ─── CORS ────────────────────────────────────────────────────────
function corsHeaders(env: Env) {
  const origin = env.ALLOWED_ORIGIN || '*'
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }
}

// ─── JWT verification (pure Web Crypto, no dependencies) ────────
let cachedJwks: { keys: JsonWebKey[]; fetchedAt: number } | null = null

async function fetchJwks(issuerUrl: string): Promise<JsonWebKey[]> {
  const now = Date.now()
  if (cachedJwks && now - cachedJwks.fetchedAt < 3600_000) {
    return cachedJwks.keys
  }
  const res = await fetch(`${issuerUrl}/.well-known/jwks.json`)
  if (!res.ok) throw new Error('Failed to fetch JWKS')
  const body = await res.json() as { keys: JsonWebKey[] }
  cachedJwks = { keys: body.keys, fetchedAt: now }
  return body.keys
}

function base64urlDecode(str: string): Uint8Array {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/')
  const pad = base64.length % 4 === 0 ? '' : '='.repeat(4 - (base64.length % 4))
  const binary = atob(base64 + pad)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function verifyClerkJWT(
  token: string,
  issuerUrl: string
): Promise<{ sub: string }> {
  const parts = token.split('.')
  if (parts.length !== 3) throw new Error('Invalid JWT')

  const headerJson = JSON.parse(new TextDecoder().decode(base64urlDecode(parts[0])))
  const kid = headerJson.kid as string
  if (!kid) throw new Error('JWT missing kid')

  const keys = await fetchJwks(issuerUrl)
  const jwk = keys.find((k: Record<string, unknown>) => k.kid === kid)
  if (!jwk) throw new Error('No matching key found')

  const key = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify']
  )

  const data = new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
  const signature = base64urlDecode(parts[2])

  const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature, data)
  if (!valid) throw new Error('Invalid JWT signature')

  const payload = JSON.parse(new TextDecoder().decode(base64urlDecode(parts[1])))
  const now = Math.floor(Date.now() / 1000)
  const GRACE_SECONDS = 120

  if (payload.exp && payload.exp + GRACE_SECONDS < now) throw new Error('JWT expired')
  if (payload.nbf && payload.nbf > now + GRACE_SECONDS) throw new Error('JWT not yet valid')
  if (payload.iss && payload.iss !== issuerUrl) throw new Error('JWT issuer mismatch')

  return { sub: payload.sub }
}

// ─── Handler ─────────────────────────────────────────────────────
export const onRequestOptions: PagesFunction<Env> = async (context) => {
  return new Response(null, { status: 204, headers: corsHeaders(context.env) })
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context
  const cors = corsHeaders(env)

  // JWT authentication
  const issuerUrl = env.CLERK_ISSUER_URL
  let rateLimitKey: string
  if (issuerUrl) {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid Authorization header' }),
        { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }
    try {
      const { sub } = await verifyClerkJWT(authHeader.slice(7), issuerUrl)
      rateLimitKey = sub
    } catch (err) {
      return new Response(
        JSON.stringify({ error: `Authentication failed: ${err instanceof Error ? err.message : 'unknown'}` }),
        { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }
  } else {
    rateLimitKey = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  }

  // Rate limiting
  const rl = checkRateLimit(rateLimitKey)
  if (!rl.allowed) {
    return new Response(
      JSON.stringify({ error: 'Rate limit exceeded. Try again later.' }),
      { status: 429, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  }

  // Body size check (1MB)
  const contentLength = request.headers.get('content-length')
  if (contentLength && parseInt(contentLength) > 1024 * 1024) {
    return new Response(
      JSON.stringify({ error: 'Request too large' }),
      { status: 413, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  }

  try {
    const body = await request.json() as Record<string, unknown>

    // Validate
    if (!body.messages || !Array.isArray(body.messages)) {
      return new Response(
        JSON.stringify({ error: 'Invalid request: messages required' }),
        { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    const messages = body.messages as Array<{ role: string; content: string }>

    // Add system message if provided separately
    if (body.system && typeof body.system === 'string') {
      if (messages[0]?.role !== 'system') {
        messages.unshift({ role: 'system', content: body.system })
      }
    }

    // Add tools if provided
    const tools = (body.tools && Array.isArray(body.tools) && body.tools.length > 0)
      ? body.tools as Array<Record<string, unknown>>
      : undefined

    const model = (body.model as string) || DEFAULT_MODEL
    const shouldStream = body.stream !== false

    if (shouldStream) {
      // Streaming response
      const stream = await env.AI.run(model as BaseAiTextGenerationModels, {
        messages,
        max_tokens: Math.min((body.max_tokens as number) || 4096, 8192),
        stream: true,
        ...(tools ? { tools } : {}),
      }) as ReadableStream

      return new Response(stream, {
        status: 200,
        headers: {
          ...cors,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'X-RateLimit-Remaining': String(rl.remaining),
        },
      })
    }

    // Non-streaming response
    const result = await env.AI.run(model as BaseAiTextGenerationModels, {
      messages,
      max_tokens: Math.min((body.max_tokens as number) || 4096, 8192),
      stream: false,
      ...(tools ? { tools } : {}),
    })

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        ...cors,
        'Content-Type': 'application/json',
        'X-RateLimit-Remaining': String(rl.remaining),
      },
    })
  } catch (err) {
    return new Response(
      JSON.stringify({ error: `AI inference error: ${err instanceof Error ? err.message : 'unknown'}` }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  }
}
