/**
 * Tests for verifyClerkJWT — functions/lib/auth.ts
 */

function base64url(obj: object | string): string {
  const str = typeof obj === 'string' ? obj : JSON.stringify(obj)
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function makeJwt(header: object, payload: object, sig = 'fakesig'): string {
  return `${base64url(header)}.${base64url(payload)}.${base64url(sig)}`
}

const ISSUER = 'https://clerk.example.com'
const KID = 'key-1'

const VALID_HEADER = { alg: 'RS256', kid: KID }
const VALID_PAYLOAD = {
  sub: 'user_abc123',
  iss: ISSUER,
  exp: Math.floor(Date.now() / 1000) + 3600,
  metadata: { plan: 'pro' },
}

const MOCK_JWK = {
  kty: 'RSA',
  kid: KID,
  alg: 'RS256',
  n: 'fake-n',
  e: 'AQAB',
  use: 'sig',
}

// We need a fresh module import per test to reset the cachedJwks module-level variable.
// Using dynamic import + vi.resetModules() achieves this.

const originalFetch = globalThis.fetch

let mockFetch: ReturnType<typeof vi.fn>
let importKeySpy: ReturnType<typeof vi.spyOn>
let verifySpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  vi.resetModules()

  mockFetch = vi.fn()
  globalThis.fetch = mockFetch as unknown as typeof fetch

  importKeySpy = vi.spyOn(crypto.subtle, 'importKey').mockResolvedValue({
    type: 'public',
  } as unknown as CryptoKey)
  verifySpy = vi.spyOn(crypto.subtle, 'verify').mockResolvedValue(true)
})

afterEach(() => {
  globalThis.fetch = originalFetch
  importKeySpy.mockRestore()
  verifySpy.mockRestore()
})

function setupJwksFetch() {
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({ keys: [MOCK_JWK] }),
  })
}

async function importVerify() {
  const mod = await import('../auth')
  return mod.verifyClerkJWT
}

describe('verifyClerkJWT', () => {
  it('rejects malformed JWT (not 3 parts)', async () => {
    const verifyClerkJWT = await importVerify()
    await expect(verifyClerkJWT('only.two', ISSUER)).rejects.toThrow('Invalid JWT')
  })

  it('rejects non-RS256 algorithm', async () => {
    const verifyClerkJWT = await importVerify()
    const token = makeJwt({ alg: 'HS256', kid: KID }, VALID_PAYLOAD)
    await expect(verifyClerkJWT(token, ISSUER)).rejects.toThrow('Unsupported JWT algorithm')
  })

  it('rejects missing kid in header', async () => {
    const verifyClerkJWT = await importVerify()
    const token = makeJwt({ alg: 'RS256' }, VALID_PAYLOAD)
    await expect(verifyClerkJWT(token, ISSUER)).rejects.toThrow('JWT missing kid')
  })

  it('throws on JWKS fetch failure (status 500)', async () => {
    const verifyClerkJWT = await importVerify()
    mockFetch.mockResolvedValue({ ok: false, status: 500 })
    const token = makeJwt(VALID_HEADER, VALID_PAYLOAD)
    await expect(verifyClerkJWT(token, ISSUER)).rejects.toThrow('Failed to fetch JWKS')
  })

  it('throws when kid is not found in JWKS', async () => {
    const verifyClerkJWT = await importVerify()
    // Return JWKS with a different kid
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ keys: [{ ...MOCK_JWK, kid: 'other-key' }] }),
    })
    const token = makeJwt(VALID_HEADER, VALID_PAYLOAD)
    await expect(verifyClerkJWT(token, ISSUER)).rejects.toThrow('No matching key found')
  })

  it('throws on invalid signature', async () => {
    const verifyClerkJWT = await importVerify()
    setupJwksFetch()
    verifySpy.mockResolvedValue(false)
    const token = makeJwt(VALID_HEADER, VALID_PAYLOAD)
    await expect(verifyClerkJWT(token, ISSUER)).rejects.toThrow('Invalid JWT signature')
  })

  it('throws when exp claim is missing', async () => {
    const verifyClerkJWT = await importVerify()
    setupJwksFetch()
    const token = makeJwt(VALID_HEADER, { sub: 'user_1', iss: ISSUER })
    await expect(verifyClerkJWT(token, ISSUER)).rejects.toThrow('JWT expired')
  })

  it('throws when token is expired', async () => {
    const verifyClerkJWT = await importVerify()
    setupJwksFetch()
    const token = makeJwt(VALID_HEADER, {
      ...VALID_PAYLOAD,
      exp: Math.floor(Date.now() / 1000) - 3600,
    })
    await expect(verifyClerkJWT(token, ISSUER)).rejects.toThrow('JWT expired')
  })

  it('throws when iss claim is missing', async () => {
    const verifyClerkJWT = await importVerify()
    setupJwksFetch()
    const payload = { ...VALID_PAYLOAD }
    delete (payload as Record<string, unknown>).iss
    const token = makeJwt(VALID_HEADER, payload)
    await expect(verifyClerkJWT(token, ISSUER)).rejects.toThrow('JWT issuer mismatch')
  })

  it('throws when iss does not match', async () => {
    const verifyClerkJWT = await importVerify()
    setupJwksFetch()
    const token = makeJwt(VALID_HEADER, { ...VALID_PAYLOAD, iss: 'https://evil.example.com' })
    await expect(verifyClerkJWT(token, ISSUER)).rejects.toThrow('JWT issuer mismatch')
  })

  it('throws when audience does not match (expectedAudience provided)', async () => {
    const verifyClerkJWT = await importVerify()
    setupJwksFetch()
    const token = makeJwt(VALID_HEADER, { ...VALID_PAYLOAD, aud: 'wrong-aud' })
    await expect(verifyClerkJWT(token, ISSUER, 'my-app')).rejects.toThrow('JWT audience mismatch')
  })

  it('throws when sub claim is missing', async () => {
    const verifyClerkJWT = await importVerify()
    setupJwksFetch()
    const payload = { ...VALID_PAYLOAD }
    delete (payload as Record<string, unknown>).sub
    const token = makeJwt(VALID_HEADER, payload)
    await expect(verifyClerkJWT(token, ISSUER)).rejects.toThrow('JWT missing sub')
  })

  it('returns sub and metadata for a valid token (signature mocked)', async () => {
    // Note: crypto.subtle.verify is mocked to return true, so this test validates
    // claim parsing and return shape, not actual cryptographic verification.
    const verifyClerkJWT = await importVerify()
    setupJwksFetch()
    const token = makeJwt(VALID_HEADER, VALID_PAYLOAD)
    const result = await verifyClerkJWT(token, ISSUER)
    expect(result).toEqual({
      sub: 'user_abc123',
      metadata: { plan: 'pro' },
    })
  })
})
