/**
 * Tests for POST /api/embed — embedding generation endpoint.
 */
import { vi } from 'vitest'

// ─── Mocks ───────────────────────────────────────────────────────
const mockVerifyJWT = vi.fn()
const mockCheckRateLimit = vi.fn().mockResolvedValue({ allowed: true, remaining: 10 })
const mockCheckCostLimits = vi.fn().mockResolvedValue({ allowed: true })

vi.mock('../../lib/auth', () => ({ verifyClerkJWT: (...args: unknown[]) => mockVerifyJWT(...args) }))
vi.mock('../../lib/rateLimiter', () => ({ checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args) }))
vi.mock('../../lib/costProtection', () => ({ checkCostLimits: (...args: unknown[]) => mockCheckCostLimits(...args) }))
vi.mock('../../lib/cors', () => ({
  corsHeaders: () => ({ 'Access-Control-Allow-Origin': 'https://test.com' }),
}))

import { onRequestPost, onRequestOptions } from '../embed'

// ─── Helpers ─────────────────────────────────────────────────────
function createMockKV() {
  const store = new Map<string, string>()
  return {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    put: vi.fn(async (key: string, value: string) => { store.set(key, value) }),
    _store: store,
  } as unknown as KVNamespace
}

function createContext(body: unknown, envOverrides: Record<string, unknown> = {}) {
  const mockKV = createMockKV()
  const env = {
    CLERK_ISSUER_URL: 'https://clerk.test',
    CLERK_JWT_AUDIENCE: undefined,
    USAGE_KV: mockKV,
    ALLOWED_ORIGIN: 'https://test.com',
    AI: {
      run: vi.fn().mockResolvedValue({ data: [[0.1, 0.2, 0.3]] }),
    },
    ...envOverrides,
  }

  const request = new Request('https://test.com/api/embed', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer test-token',
    },
    body: JSON.stringify(body),
  })

  return { request, env, params: {}, data: {}, next: vi.fn(), functionPath: '' } as unknown as Parameters<typeof onRequestPost>[0]
}

// ─── Tests ───────────────────────────────────────────────────────
describe('POST /api/embed', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockVerifyJWT.mockResolvedValue({ sub: 'user-1', metadata: { plan: 'pro' } })
    mockCheckRateLimit.mockResolvedValue({ allowed: true, remaining: 10 })
    mockCheckCostLimits.mockResolvedValue({ allowed: true })
  })

  it('returns 401 when Authorization header is missing', async () => {
    const ctx = createContext({ texts: ['hello'] })
    const req = new Request('https://test.com/api/embed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texts: ['hello'] }),
    })
    Object.defineProperty(ctx, 'request', { value: req })

    const res = await onRequestPost(ctx)
    expect(res.status).toBe(401)
  })

  it('returns 401 when JWT verification fails', async () => {
    mockVerifyJWT.mockRejectedValue(new Error('Invalid JWT'))
    const ctx = createContext({ texts: ['hello'] })

    const res = await onRequestPost(ctx)
    expect(res.status).toBe(401)
    const body = await res.json() as { error: string }
    expect(body.error).toContain('Authentication failed')
  })

  it('returns 503 when USAGE_KV is missing', async () => {
    const ctx = createContext({ texts: ['hello'] }, { USAGE_KV: undefined })

    const res = await onRequestPost(ctx)
    expect(res.status).toBe(503)
  })

  it('returns 429 when rate limit exceeded', async () => {
    mockCheckRateLimit.mockResolvedValue({ allowed: false, remaining: 0 })
    const ctx = createContext({ texts: ['hello'] })

    const res = await onRequestPost(ctx)
    expect(res.status).toBe(429)
  })

  it('returns 429 when cost limit exceeded', async () => {
    mockCheckCostLimits.mockResolvedValue({ allowed: false, reason: 'Daily limit reached' })
    const ctx = createContext({ texts: ['hello'] })

    const res = await onRequestPost(ctx)
    expect(res.status).toBe(429)
    const body = await res.json() as { error: string }
    expect(body.error).toContain('Daily limit reached')
  })

  it('returns 400 when texts array is missing', async () => {
    const ctx = createContext({})

    const res = await onRequestPost(ctx)
    expect(res.status).toBe(400)
    const body = await res.json() as { error: string }
    expect(body.error).toContain('texts array required')
  })

  it('returns 400 when texts array is empty', async () => {
    const ctx = createContext({ texts: [] })

    const res = await onRequestPost(ctx)
    expect(res.status).toBe(400)
  })

  it('returns 400 when texts exceeds max count (100)', async () => {
    const texts = Array(101).fill('hello')
    const ctx = createContext({ texts })

    const res = await onRequestPost(ctx)
    expect(res.status).toBe(400)
    const body = await res.json() as { error: string }
    expect(body.error).toContain('100')
  })

  it('truncates texts longer than 8192 chars', async () => {
    const longText = 'a'.repeat(10000)
    const ctx = createContext({ texts: [longText] })

    await onRequestPost(ctx)

    // Workers AI should receive truncated text
    const aiCall = (ctx.env as any).AI.run
    expect(aiCall).toHaveBeenCalledWith(
      '@cf/baai/bge-m3',
      expect.objectContaining({
        text: [expect.any(String)],
      }),
    )
    const passedText = aiCall.mock.calls[0][1].text[0]
    expect(passedText.length).toBe(8192)
  })

  it('returns base64-encoded embeddings on success', async () => {
    const ctx = createContext({ texts: ['hello world'] })

    const res = await onRequestPost(ctx)
    expect(res.status).toBe(200)

    const body = await res.json() as { embeddings: string[] }
    expect(body.embeddings).toHaveLength(1)
    expect(typeof body.embeddings[0]).toBe('string')
    // Verify it's valid base64
    expect(() => atob(body.embeddings[0])).not.toThrow()
  })

  it('handles multiple texts in a single request', async () => {
    const mockAI = vi.fn().mockResolvedValue({
      data: [[0.1, 0.2], [0.3, 0.4], [0.5, 0.6]],
    })
    const ctx = createContext({ texts: ['one', 'two', 'three'] }, {
      AI: { run: mockAI },
    })

    const res = await onRequestPost(ctx)
    expect(res.status).toBe(200)

    const body = await res.json() as { embeddings: string[] }
    expect(body.embeddings).toHaveLength(3)
  })

  it('returns 500 when Workers AI fails', async () => {
    const mockAI = vi.fn().mockRejectedValue(new Error('AI service down'))
    const ctx = createContext({ texts: ['hello'] }, {
      AI: { run: mockAI },
    })

    const res = await onRequestPost(ctx)
    expect(res.status).toBe(500)
    const body = await res.json() as { error: string }
    expect(body.error).toContain('Failed to generate embeddings')
  })

  it('increments global usage counter', async () => {
    const ctx = createContext({ texts: ['hello'] })

    await onRequestPost(ctx)

    const kv = (ctx.env as any).USAGE_KV
    expect(kv.put).toHaveBeenCalled()
    // Should have written a usage:embed:YYYY-MM-DD key
    const putCalls = kv.put.mock.calls
    const usageCall = putCalls.find((c: string[]) => c[0].startsWith('usage:embed:'))
    expect(usageCall).toBeTruthy()
  })

  it('returns 500 when CLERK_ISSUER_URL is missing', async () => {
    const ctx = createContext({ texts: ['hello'] }, { CLERK_ISSUER_URL: undefined })

    const res = await onRequestPost(ctx)
    expect(res.status).toBe(500)
    const body = await res.json() as { error: string }
    expect(body.error).toContain('misconfigured')
  })
})

describe('OPTIONS /api/embed', () => {
  it('returns 204 with CORS headers', async () => {
    const ctx = {
      env: { ALLOWED_ORIGIN: 'https://test.com' },
    } as unknown as Parameters<typeof onRequestOptions>[0]

    const res = await onRequestOptions(ctx)
    expect(res.status).toBe(204)
  })
})
