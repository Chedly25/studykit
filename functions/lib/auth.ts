/**
 * JWT verification for Clerk tokens using Web Crypto (no Node.js dependencies).
 * Returns user ID and any metadata embedded in the JWT.
 */

// Note: This cache is per-isolate on Cloudflare Workers, so it's not shared
// across requests in production. It still helps within a single isolate's lifetime.
let cachedJwks: { keys: JsonWebKey[]; fetchedAt: number } | null = null

async function fetchJwks(issuerUrl: string): Promise<JsonWebKey[]> {
  const now = Date.now()
  if (cachedJwks && now - cachedJwks.fetchedAt < 300_000) {
    return cachedJwks.keys
  }
  const res = await fetch(`${issuerUrl}/.well-known/jwks.json`)
  if (!res.ok) throw new Error('Failed to fetch JWKS')
  const body = (await res.json()) as { keys: JsonWebKey[] }
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

export interface JWTPayload {
  sub: string
  metadata?: {
    plan?: 'free' | 'pro'
    stripeCustomerId?: string
    stripeSubscriptionId?: string
    [key: string]: unknown
  }
}

export async function verifyClerkJWT(
  token: string,
  issuerUrl: string,
  expectedAudience?: string
): Promise<JWTPayload> {
  const parts = token.split('.')
  if (parts.length !== 3) throw new Error('Invalid JWT')

  const headerJson = JSON.parse(new TextDecoder().decode(base64urlDecode(parts[0])))
  if (headerJson.alg !== 'RS256') throw new Error('Unsupported JWT algorithm')
  const kid = headerJson.kid as string
  if (!kid) throw new Error('JWT missing kid')

  let keys = await fetchJwks(issuerUrl)
  let jwk = keys.find((k: Record<string, unknown>) => k.kid === kid)

  // If kid not found and we were using cached keys, refetch (key may have rotated)
  if (!jwk && cachedJwks) {
    cachedJwks = null
    keys = await fetchJwks(issuerUrl)
    jwk = keys.find((k: Record<string, unknown>) => k.kid === kid)
  }
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
  const GRACE_SECONDS = 5

  if (!payload.exp || payload.exp + GRACE_SECONDS < now) throw new Error('JWT expired')
  if (payload.nbf && payload.nbf > now + GRACE_SECONDS) throw new Error('JWT not yet valid')
  if (!payload.iss || payload.iss !== issuerUrl) throw new Error('JWT issuer mismatch')
  if (expectedAudience) {
    const audMatch = Array.isArray(payload.aud)
      ? payload.aud.includes(expectedAudience)
      : payload.aud === expectedAudience
    if (!audMatch) throw new Error('JWT audience mismatch')
  }
  if (!payload.sub) throw new Error('JWT missing sub')

  return {
    sub: payload.sub,
    metadata: payload.metadata ?? undefined,
  }
}
