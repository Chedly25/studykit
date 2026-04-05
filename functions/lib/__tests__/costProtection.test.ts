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

  it('allows pro request under the cap', async () => {
    const result = await checkDailyCap(kv, 'user1', 'chat', 'pro')
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBeGreaterThan(0)
    expect(result.limit).toBe(500)
  })

  it('allows free request under the cap', async () => {
    const result = await checkDailyCap(kv, 'user1', 'chat')
    expect(result.allowed).toBe(true)
    expect(result.limit).toBe(25)
  })

  it('blocks pro request when cap is reached', async () => {
    const today = new Date().toISOString().slice(0, 10)
    const key = `daily:chat:user1:${today}`
    await kv.put(key, '500', { expirationTtl: 172800 } as any)

    const result = await checkDailyCap(kv, 'user1', 'chat', 'pro')
    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
  })

  it('blocks free request at soft cap (80% of 25)', async () => {
    const today = new Date().toISOString().slice(0, 10)
    const key = `daily:chat:user1:${today}`
    await kv.put(key, '20', { expirationTtl: 172800 } as any)

    const result = await checkDailyCap(kv, 'user1', 'chat')
    expect(result.allowed).toBe(false)
    expect(result.limit).toBe(25)
  })

  it('allows unknown endpoints', async () => {
    const result = await checkDailyCap(kv, 'user1', 'unknown-endpoint')
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(999)
  })

  it('increments counter on each allowed call', async () => {
    await checkDailyCap(kv, 'user1', 'chat', 'pro')
    await checkDailyCap(kv, 'user1', 'chat', 'pro')

    // Third call should show remaining decreased (soft cap = 400)
    const result = await checkDailyCap(kv, 'user1', 'chat', 'pro')
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBeLessThan(398)
  })

  it('blocks free users on pro-only endpoints', async () => {
    const result = await checkDailyCap(kv, 'user1', 'fast')
    expect(result.allowed).toBe(false)
    expect(result.limit).toBe(0)
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
    const result = await checkCostLimits(env as any, 'user1', 'chat', 'pro')
    expect(result.allowed).toBe(true)
  })

  it('returns reason when global cap exceeded', async () => {
    const today = new Date().toISOString().slice(0, 10)
    await env.USAGE_KV.put(`global:chat:${today}`, '10000', { expirationTtl: 172800 } as any)

    const result = await checkCostLimits(env as any, 'user1', 'chat', 'pro')
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('capacity')
  })

  it('returns reason when pro daily cap exceeded', async () => {
    const today = new Date().toISOString().slice(0, 10)
    await env.USAGE_KV.put(`daily:chat:user1:${today}`, '500', { expirationTtl: 172800 } as any)

    const result = await checkCostLimits(env as any, 'user1', 'chat', 'pro')
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('Daily limit')
  })

  it('blocks free user at lower cap with upgrade hint', async () => {
    const today = new Date().toISOString().slice(0, 10)
    await env.USAGE_KV.put(`daily:chat:user1:${today}`, '25', { expirationTtl: 172800 } as any)

    const result = await checkCostLimits(env as any, 'user1', 'chat')
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('Upgrade to Pro')
  })

  it('blocks when USAGE_KV is absent (fail closed)', async () => {
    const result = await checkCostLimits({ USAGE_KV: undefined } as any, 'user1', 'chat')
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('rate limiter not configured')
  })
})
