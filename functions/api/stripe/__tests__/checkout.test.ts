import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mocks ─────────────────────────────────────────────────────
vi.mock('../../../lib/auth', () => ({
  verifyClerkJWT: vi.fn(),
}))

const mockSessionCreate = vi.fn().mockResolvedValue({ url: 'https://checkout.stripe.com/test' })
vi.mock('stripe', () => {
  const StripeMock = function () {
    return {
      checkout: {
        sessions: {
          create: mockSessionCreate,
        },
      },
    }
  }
  return { default: StripeMock }
})

import { onRequestOptions, onRequestPost } from '../checkout'
import { verifyClerkJWT } from '../../../lib/auth'

// ─── Helpers ────────────────────────────────────────────────────
function createContext(
  overrides: Partial<{
    body: Record<string, unknown>
    headers: Record<string, string>
    env: Record<string, unknown>
  }> = {}
) {
  const env = {
    CLERK_ISSUER_URL: 'https://clerk.test',
    CLERK_JWT_AUDIENCE: undefined,
    STRIPE_SECRET_KEY: 'sk_test_123',
    STRIPE_PRO_MONTHLY_PRICE_ID: 'price_monthly_123',
    STRIPE_PRO_YEARLY_PRICE_ID: 'price_yearly_456',
    ALLOWED_ORIGIN: 'https://test.com',
    ...overrides.env,
  }

  const headers = new Headers({
    'Content-Type': 'application/json',
    Authorization: 'Bearer valid-token',
    ...overrides.headers,
  })

  const bodyContent = overrides.body ?? {}
  const request = new Request('https://test.com/api/stripe/checkout', {
    method: 'POST',
    headers,
    body: JSON.stringify(bodyContent),
  })

  return {
    request,
    env,
    params: {},
    functionPath: '/api/stripe/checkout',
    waitUntil: vi.fn(),
    passThroughOnException: vi.fn(),
    next: vi.fn(),
    data: {},
  } as unknown as EventContext<typeof env, string, unknown>
}

// ─── Setup ──────────────────────────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(verifyClerkJWT).mockResolvedValue({ sub: 'user_123', metadata: { plan: 'pro' } })
  mockSessionCreate.mockResolvedValue({ url: 'https://checkout.stripe.com/test' })
})

// ─── Tests ──────────────────────────────────────────────────────
describe('POST /api/stripe/checkout', () => {
  // 1. OPTIONS returns 204
  it('OPTIONS returns 204 with CORS headers', async () => {
    const ctx = createContext()
    const res = await onRequestOptions(ctx as any)
    expect(res.status).toBe(204)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://test.com')
  })

  // 2. Missing auth -> 401
  it('returns 401 when Authorization header is missing', async () => {
    const request = new Request('https://test.com/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    const ctx = createContext()
    ;(ctx as any).request = request
    const res = await onRequestPost(ctx as any)
    expect(res.status).toBe(401)
    const body = await res.json() as { error: string }
    expect(body.error).toContain('authorization')
  })

  // 3. Invalid JWT -> 401
  it('returns 401 when JWT verification fails', async () => {
    vi.mocked(verifyClerkJWT).mockRejectedValue(new Error('Invalid'))
    const ctx = createContext()
    const res = await onRequestPost(ctx as any)
    expect(res.status).toBe(401)
    const body = await res.json() as { error: string }
    expect(body.error).toContain('Authentication failed')
  })

  // 4. Missing Stripe config -> 500
  it('returns 500 when Stripe price ID is not configured', async () => {
    const ctx = createContext({
      env: { STRIPE_PRO_MONTHLY_PRICE_ID: '', STRIPE_PRO_YEARLY_PRICE_ID: '' },
      body: { interval: 'month' },
    })
    const res = await onRequestPost(ctx as any)
    expect(res.status).toBe(500)
    const body = await res.json() as { error: string }
    expect(body.error).toContain('price not configured')
  })

  // 5. Default interval (month) uses monthly price ID
  it('defaults to monthly interval and uses monthly price ID', async () => {
    const ctx = createContext({ body: {} })
    const res = await onRequestPost(ctx as any)
    expect(res.status).toBe(200)
    expect(mockSessionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        line_items: [{ price: 'price_monthly_123', quantity: 1 }],
      })
    )
  })

  // 6. Year interval uses yearly price ID
  it('uses yearly price ID when interval is year', async () => {
    const ctx = createContext({ body: { interval: 'year' } })
    const res = await onRequestPost(ctx as any)
    expect(res.status).toBe(200)
    expect(mockSessionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        line_items: [{ price: 'price_yearly_456', quantity: 1 }],
      })
    )
  })

  // 7. Successful checkout returns URL
  it('returns checkout URL on success', async () => {
    const ctx = createContext({ body: { interval: 'month' } })
    const res = await onRequestPost(ctx as any)
    expect(res.status).toBe(200)
    const body = await res.json() as { url: string }
    expect(body.url).toBe('https://checkout.stripe.com/test')
  })

  // 8. Stripe error -> 500
  it('returns 500 when Stripe throws an error', async () => {
    mockSessionCreate.mockRejectedValue(new Error('Stripe API error'))
    const ctx = createContext({ body: { interval: 'month' } })
    const res = await onRequestPost(ctx as any)
    expect(res.status).toBe(500)
    const body = await res.json() as { error: string }
    expect(body.error).toContain('error occurred')
  })
})
