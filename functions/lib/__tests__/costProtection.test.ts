import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Env type
vi.mock('../../../functions/env', () => ({}))

// We'll test the logic directly by re-implementing the test against the module
// Need to mock KVNamespace since it's a Cloudflare Workers API
function createMockKV() {
  const store = new Map<string, string>()
  return {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    put: vi.fn(async (key: string, value: string) => { store.set(key, value) }),
    _store: store,
  } as unknown as KVNamespace
}

// Mock the Env type for TypeScript
interface MockEnv {
  USAGE_KV: KVNamespace
}

// Import after mocks are set up
import { checkDailyCap, checkGlobalCap, checkCostLimits } from '../costProtection'

describe('checkDailyCap', () => {
  let kv: KVNamespace

  beforeEach(() => {
    kv = createMockKV()
  })

  it('allows request under the cap', async () => {
    const result = await checkDailyCap(kv, 'user1', 'chat')
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBeGreaterThan(0)
  })

  it('blocks request when cap is reached', async () => {
    // Simulate 500 calls (chat cap)
    const today = new Date().toISOString().slice(0, 10)
    const key = `daily:chat:user1:${today}`
    await kv.put(key, '500', { expirationTtl: 172800 } as any)

    const result = await checkDailyCap(kv, 'user1', 'chat')
    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
  })

  it('allows unknown endpoints', async () => {
    const result = await checkDailyCap(kv, 'user1', 'unknown-endpoint')
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(999)
  })

  it('increments counter on each allowed call', async () => {
    await checkDailyCap(kv, 'user1', 'chat')
    await checkDailyCap(kv, 'user1', 'chat')

    // Third call should show remaining decreased
    const result = await checkDailyCap(kv, 'user1', 'chat')
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBeLessThan(498)
  })
})

describe('checkGlobalCap', () => {
  let kv: KVNamespace

  beforeEach(() => {
    kv = createMockKV()
  })

  it('allows request under the global cap', async () => {
    const result = await checkGlobalCap(kv, 'chat')
    expect(result.allowed).toBe(true)
  })

  it('blocks when global cap is exceeded', async () => {
    const today = new Date().toISOString().slice(0, 10)
    const key = `global:chat:${today}`
    await kv.put(key, '10000', { expirationTtl: 172800 } as any)

    const result = await checkGlobalCap(kv, 'chat')
    expect(result.allowed).toBe(false)
  })

  it('allows unknown endpoints (no cap)', async () => {
    const result = await checkGlobalCap(kv, 'unknown')
    expect(result.allowed).toBe(true)
  })
})

describe('checkCostLimits', () => {
  let env: MockEnv

  beforeEach(() => {
    env = { USAGE_KV: createMockKV() }
  })

  it('allows when both checks pass', async () => {
    const result = await checkCostLimits(env as any, 'user1', 'chat')
    expect(result.allowed).toBe(true)
  })

  it('returns reason when global cap exceeded', async () => {
    const today = new Date().toISOString().slice(0, 10)
    await env.USAGE_KV.put(`global:chat:${today}`, '10000', { expirationTtl: 172800 } as any)

    const result = await checkCostLimits(env as any, 'user1', 'chat')
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('capacity')
  })

  it('returns reason when daily cap exceeded', async () => {
    const today = new Date().toISOString().slice(0, 10)
    await env.USAGE_KV.put(`daily:chat:user1:${today}`, '500', { expirationTtl: 172800 } as any)

    const result = await checkCostLimits(env as any, 'user1', 'chat')
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('Daily limit')
  })
})
