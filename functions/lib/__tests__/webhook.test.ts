/**
 * Tests for Stripe webhook handler — functions/api/stripe/webhook.ts
 */

import type { Env } from '../../env'

// ─── Helpers ─────────────────────────────────────────────────────

function createMockKV() {
  const store = new Map<string, string>()
  return {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    put: vi.fn(async (key: string, value: string) => {
      store.set(key, value)
    }),
    delete: vi.fn(async (key: string) => {
      store.delete(key)
    }),
    _store: store,
  } as unknown as KVNamespace
}

async function signPayload(
  payload: string,
  secret: string,
  timestamp: number
): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${timestamp}.${payload}`)
  )
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

const WEBHOOK_SECRET = 'whsec_test_secret_key'
const CLERK_SECRET = 'sk_test_clerk'

function makeEnv(kvOverride?: KVNamespace): Env {
  return {
    AI: {} as Ai,
    SYNC_KV: createMockKV() as unknown as KVNamespace,
    USAGE_KV: kvOverride ?? createMockKV(),
    CLERK_SECRET_KEY: CLERK_SECRET,
    CLERK_ISSUER_URL: 'https://clerk.example.com',
    STRIPE_SECRET_KEY: 'sk_test_stripe',
    STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET,
    STRIPE_PRO_MONTHLY_PRICE_ID: 'price_monthly',
    STRIPE_PRO_YEARLY_PRICE_ID: 'price_yearly',
    LLM_API_KEY: 'test',
    ADMIN_EMAIL: 'admin@test.com',
  }
}

async function buildRequest(
  body: string,
  secret: string,
  timestampOverride?: number
): Promise<Request> {
  const timestamp = timestampOverride ?? Math.floor(Date.now() / 1000)
  const signature = await signPayload(body, secret, timestamp)
  return new Request('https://example.com/api/stripe/webhook', {
    method: 'POST',
    headers: {
      'stripe-signature': `t=${timestamp},v1=${signature}`,
      'Content-Type': 'application/json',
    },
    body,
  })
}

function makeEvent(
  type: string,
  dataObject: Record<string, unknown>,
  id = 'evt_' + Math.random().toString(36).slice(2)
) {
  return { id, type, data: { object: dataObject } }
}

// ─── Tests ───────────────────────────────────────────────────────

// We mock the clerk module so updateUserMetadata doesn't actually call fetch
vi.mock('../../lib/clerk', () => ({
  updateUserMetadata: vi.fn(async () => {}),
}))

// Import after vi.mock so the mock is in place
const clerkModule = await import('../../lib/clerk')
const mockUpdateUserMetadata = clerkModule.updateUserMetadata as ReturnType<typeof vi.fn>

let onRequestPost: PagesFunction<Env>

beforeAll(async () => {
  const mod = await import('../../api/stripe/webhook')
  onRequestPost = mod.onRequestPost
})

beforeEach(() => {
  mockUpdateUserMetadata.mockClear()
})

function callHandler(request: Request, env: Env) {
  return onRequestPost({
    request,
    env,
    params: {},
    functionPath: '',
    waitUntil: () => {},
    passThroughOnException: () => {},
    next: async () => new Response(),
    data: {},
  } as unknown as EventContext<Env, string, unknown>)
}

describe('Stripe webhook handler', () => {
  it('handles checkout.session.completed — updates Clerk metadata to pro', async () => {
    const env = makeEnv()
    const event = makeEvent('checkout.session.completed', {
      client_reference_id: 'user_clerk_1',
      customer: 'cus_123',
      subscription: 'sub_456',
    })
    const body = JSON.stringify(event)
    const request = await buildRequest(body, WEBHOOK_SECRET)
    const response = await callHandler(request, env)

    expect(response.status).toBe(200)
    expect(mockUpdateUserMetadata).toHaveBeenCalledWith(CLERK_SECRET, 'user_clerk_1', {
      plan: 'pro',
      stripeCustomerId: 'cus_123',
      stripeSubscriptionId: 'sub_456',
    })
  })

  it('handles customer.subscription.deleted — sets plan to free', async () => {
    const env = makeEnv()
    const event = makeEvent('customer.subscription.deleted', {
      id: 'sub_456',
      metadata: { clerkUserId: 'user_clerk_2' },
    })
    const body = JSON.stringify(event)
    const request = await buildRequest(body, WEBHOOK_SECRET)
    const response = await callHandler(request, env)

    expect(response.status).toBe(200)
    expect(mockUpdateUserMetadata).toHaveBeenCalledWith(CLERK_SECRET, 'user_clerk_2', {
      plan: 'free',
      stripeCustomerId: undefined,
      stripeSubscriptionId: undefined,
      billingInterval: undefined,
      currentPeriodEnd: undefined,
      cancelAtPeriodEnd: undefined,
      paymentFailed: undefined,
    })
  })

  it('returns 400 for invalid signature', async () => {
    const env = makeEnv()
    const event = makeEvent('checkout.session.completed', {
      client_reference_id: 'user_1',
    })
    const body = JSON.stringify(event)
    // Sign with wrong secret
    const request = await buildRequest(body, 'wrong_secret')
    const response = await callHandler(request, env)

    expect(response.status).toBe(400)
    const text = await response.text()
    expect(text).toBe('Invalid signature')
    expect(mockUpdateUserMetadata).not.toHaveBeenCalled()
  })

  it('returns 400 for expired timestamp (>5 min old)', async () => {
    const env = makeEnv()
    const event = makeEvent('checkout.session.completed', {
      client_reference_id: 'user_1',
    })
    const body = JSON.stringify(event)
    // Timestamp 10 minutes in the past
    const oldTimestamp = Math.floor(Date.now() / 1000) - 600
    const request = await buildRequest(body, WEBHOOK_SECRET, oldTimestamp)
    const response = await callHandler(request, env)

    expect(response.status).toBe(400)
    expect(mockUpdateUserMetadata).not.toHaveBeenCalled()
  })

  it('deduplicates events — second call returns 200 without Clerk call', async () => {
    const kv = createMockKV()
    const env = makeEnv(kv)
    const event = makeEvent('checkout.session.completed', {
      client_reference_id: 'user_clerk_3',
      customer: 'cus_999',
      subscription: 'sub_999',
    }, 'evt_dedup_test')

    const body = JSON.stringify(event)
    const req1 = await buildRequest(body, WEBHOOK_SECRET)
    const res1 = await callHandler(req1, env)
    expect(res1.status).toBe(200)
    expect(mockUpdateUserMetadata).toHaveBeenCalledTimes(1)

    mockUpdateUserMetadata.mockClear()

    // Second request with the same event id
    const req2 = await buildRequest(body, WEBHOOK_SECRET)
    const res2 = await callHandler(req2, env)
    expect(res2.status).toBe(200)
    const json = await res2.json()
    expect(json).toEqual({ received: true, deduplicated: true })
    expect(mockUpdateUserMetadata).not.toHaveBeenCalled()
  })

  it('checkout.session.completed without userId in metadata returns 200 but skips Clerk call', async () => {
    const env = makeEnv()
    // No client_reference_id and no subscription_data metadata
    const event = makeEvent('checkout.session.completed', {
      customer: 'cus_orphan',
      subscription: 'sub_orphan',
    })
    const body = JSON.stringify(event)
    const request = await buildRequest(body, WEBHOOK_SECRET)
    const response = await callHandler(request, env)

    // Handler returns 200 since it processed the event (just had no userId)
    expect(response.status).toBe(200)
    expect(mockUpdateUserMetadata).not.toHaveBeenCalled()
  })

  it('returns 400 when stripe-signature header is missing', async () => {
    const env = makeEnv()
    const request = new Request('https://example.com/api/stripe/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })
    const response = await callHandler(request, env)
    expect(response.status).toBe(400)
    const text = await response.text()
    expect(text).toBe('Missing stripe-signature')
  })
})
