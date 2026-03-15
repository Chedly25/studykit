/**
 * Cloudflare Pages Function: POST /api/chat
 * Proxies requests to Alibaba Cloud DashScope (Qwen) with our API key.
 * Stores ZERO student data — only adds the key and forwards.
 *
 * To switch providers later, change BASE_URL, model default, and auth header.
 */

interface Env {
  DASHSCOPE_API_KEY?: string
  ALLOWED_ORIGIN?: string
  CLERK_ISSUER_URL?: string
}

// ─── Rate limiter (in-memory, resets per isolate) ────────────────
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

function checkRateLimit(ip: string, limit = 60, windowMs = 60 * 60 * 1000) {
  const now = Date.now()
  const entry = rateLimitStore.get(ip)
  if (!entry || now > entry.resetTime) {
    rateLimitStore.set(ip, { count: 1, resetTime: now + windowMs })
    return { allowed: true, remaining: limit - 1 }
  }
  if (entry.count >= limit) {
    return { allowed: false, remaining: 0 }
  }
  entry.count++
  return { allowed: true, remaining: limit - entry.count }
}

// ─── Provider config ─────────────────────────────────────────────
// Switch these three values to change LLM provider:
const PROVIDER = {
  // Alibaba Cloud DashScope (OpenAI-compatible)
  baseUrl: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions',
  defaultModel: 'qwen-plus',
  authHeader: (key: string) => ({ Authorization: `Bearer ${key}` }),

  // To switch to Anthropic later, uncomment below and comment above:
  // baseUrl: 'https://api.anthropic.com/v1/messages',
  // defaultModel: 'claude-sonnet-4-6',
  // authHeader: (key: string) => ({
  //   'x-api-key': key,
  //   'anthropic-version': '2023-06-01',
  // }),
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

  // API key check
  const apiKey = env.DASHSCOPE_API_KEY
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'LLM API key not configured. Set DASHSCOPE_API_KEY secret.' }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  }

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
    // Fallback to IP-based rate limiting when auth is not configured
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

    // Build upstream request (OpenAI-compatible format)
    const upstreamBody: Record<string, unknown> = {
      model: (body.model as string) || PROVIDER.defaultModel,
      messages: body.messages,
      max_tokens: Math.min((body.max_tokens as number) || 4096, 8192),
      stream: body.stream !== false,
    }

    // Add system message as first message if provided separately
    if (body.system && typeof body.system === 'string') {
      const messages = upstreamBody.messages as Array<{ role: string; content: unknown }>
      if (messages[0]?.role !== 'system') {
        messages.unshift({ role: 'system', content: body.system })
      }
      upstreamBody.messages = messages
    }

    // Add tools if provided
    if (body.tools && Array.isArray(body.tools) && body.tools.length > 0) {
      upstreamBody.tools = body.tools
    }

    const response = await fetch(PROVIDER.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...PROVIDER.authHeader(apiKey),
      },
      body: JSON.stringify(upstreamBody),
    })

    if (!response.ok) {
      const errText = await response.text()
      return new Response(errText, {
        status: response.status,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    // Stream passthrough
    if (upstreamBody.stream && response.body) {
      return new Response(response.body, {
        status: 200,
        headers: {
          ...cors,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'X-RateLimit-Remaining': String(rl.remaining),
        },
      })
    }

    // Non-streaming passthrough
    const data = await response.text()
    return new Response(data, {
      status: 200,
      headers: {
        ...cors,
        'Content-Type': 'application/json',
        'X-RateLimit-Remaining': String(rl.remaining),
      },
    })
  } catch {
    return new Response(
      JSON.stringify({ error: 'Internal proxy error' }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  }
}
