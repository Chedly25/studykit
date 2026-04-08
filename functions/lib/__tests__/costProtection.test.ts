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

// Current cap values (keep in sync with costProtection.ts)
const CHAT_FREE_CAP = 15
const CHAT_PRO_CAP = 65
const CHAT_FREE_SOFT = Math.floor(CHAT_FREE_CAP * 0.8) // 12
const CHAT_PRO_SOFT = Math.floor(CHAT_PRO_CAP * 0.8)   // 52
const CHAT_GLOBAL_CAP = 5000
const CHAT_GLOBAL_SOFT = Math.floor(CHAT_GLOBAL_CAP * 0.8) // 4000

describe('checkDailyCap', () => {
  let kv: KVNamespace

  beforeEach(() => {
    kv = createMockKV()
  })

  it('allows pro request under the cap', async () => {
    const result = await checkDailyCap(kv, 'user1', 'chat', 'pro')
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBeGreaterThan(0)
    expect(result.limit).toBe(CHAT_PRO_CAP)
  })

  it('allows free request under the cap', async () => {
    const result = await checkDailyCap(kv, 'user1', 'chat')
    expect(result.allowed).toBe(true)
    expect(result.limit).toBe(CHAT_FREE_CAP)
  })

  it('blocks pro request when cap is reached', async () => {
    const today = new Date().toISOString().slice(0, 10)
    const key = `daily:chat:user1:${today}`
    await kv.put(key, String(CHAT_PRO_CAP), { expirationTtl: 172800 } as any)

    const result = await checkDailyCap(kv, 'user1', 'chat', 'pro')
    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
  })

  it('blocks free request at soft cap', async () => {
    const today = new Date().toISOString().slice(0, 10)
    const key = `daily:chat:user1:${today}`
    await kv.put(key, String(CHAT_FREE_SOFT), { expirationTtl: 172800 } as any)

    const result = await checkDailyCap(kv, 'user1', 'chat')
    expect(result.allowed).toBe(false)
    expect(result.limit).toBe(CHAT_FREE_CAP)
  })

  it('allows unknown endpoints', async () => {
    const result = await checkDailyCap(kv, 'user1', 'unknown-endpoint')
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(999)
  })

  it('increments counter on each allowed call', async () => {
    await checkDailyCap(kv, 'user1', 'chat', 'pro')
    await checkDailyCap(kv, 'user1', 'chat', 'pro')

    const result = await checkDailyCap(kv, 'user1', 'chat', 'pro')
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(CHAT_PRO_SOFT - 3)
  })

  it('blocks free users on pro-only endpoints', async () => {
    const result = await checkDailyCap(kv, 'user1', 'fast')
    expect(result.allowed).toBe(false)
    expect(result.limit).toBe(0)
  })

  it('blocks at exact soft cap boundary', async () => {
    const today = new Date().toISOString().slice(0, 10)
    const key = `daily:chat:user1:${today}`
    await kv.put(key, String(CHAT_FREE_SOFT - 1), { expirationTtl: 172800 } as any)

    // Call at counter=softCap-1 → allowed (returns remaining=0)
    const result1 = await checkDailyCap(kv, 'user1', 'chat')
    expect(result1.allowed).toBe(true)
    expect(result1.remaining).toBe(0)

    // Counter is now softCap → blocked
    const result2 = await checkDailyCap(kv, 'user1', 'chat')
    expect(result2.allowed).toBe(false)
    expect(result2.remaining).toBe(0)
  })

  it('sequential calls eventually block', async () => {
    let blocked = false
    let callCount = 0
    for (let i = 0; i < CHAT_FREE_CAP + 5; i++) {
      const result = await checkDailyCap(kv, 'user1', 'chat')
      callCount++
      if (!result.allowed) {
        blocked = true
        break
      }
    }
    expect(blocked).toBe(true)
    // Should block after softCap+1 calls (softCap allowed, then blocked)
    expect(callCount).toBe(CHAT_FREE_SOFT + 1)
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
    await kv.put(key, String(CHAT_GLOBAL_CAP), { expirationTtl: 172800 } as any)

    const result = await checkGlobalCap(kv, 'chat')
    expect(result.allowed).toBe(false)
  })

  it('allows unknown endpoints (no cap)', async () => {
    const result = await checkGlobalCap(kv, 'unknown')
    expect(result.allowed).toBe(true)
  })

  it('blocks at exact global soft cap boundary', async () => {
    const today = new Date().toISOString().slice(0, 10)
    const key = `global:chat:${today}`

    // Set to softCap-1 (one below soft cap)
    await kv.put(key, String(CHAT_GLOBAL_SOFT - 1), { expirationTtl: 172800 } as any)
    const result1 = await checkGlobalCap(kv, 'chat')
    expect(result1.allowed).toBe(true)

    // Counter is now softCap → blocked
    const result2 = await checkGlobalCap(kv, 'chat')
    expect(result2.allowed).toBe(false)
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
    await env.USAGE_KV.put(`global:chat:${today}`, String(CHAT_GLOBAL_CAP), { expirationTtl: 172800 } as any)

    const result = await checkCostLimits(env as any, 'user1', 'chat', 'pro')
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('capacity')
  })

  it('returns reason when pro daily cap exceeded', async () => {
    const today = new Date().toISOString().slice(0, 10)
    await env.USAGE_KV.put(`daily:chat:user1:${today}`, String(CHAT_PRO_CAP), { expirationTtl: 172800 } as any)

    const result = await checkCostLimits(env as any, 'user1', 'chat', 'pro')
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('Daily limit')
  })

  it('blocks free user at lower cap with upgrade hint', async () => {
    const today = new Date().toISOString().slice(0, 10)
    await env.USAGE_KV.put(`daily:chat:user1:${today}`, String(CHAT_FREE_CAP), { expirationTtl: 172800 } as any)

    const result = await checkCostLimits(env as any, 'user1', 'chat')
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('Upgrade to Pro')
  })

  it('blocks when USAGE_KV is absent (fail closed)', async () => {
    const result = await checkCostLimits({ USAGE_KV: undefined } as any, 'user1', 'chat')
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('rate limiter not configured')
  })

  it('blocks when global cap exceeded even for pro user', async () => {
    const today = new Date().toISOString().slice(0, 10)
    await env.USAGE_KV.put(`global:chat:${today}`, String(CHAT_GLOBAL_CAP), { expirationTtl: 172800 } as any)

    const result = await checkCostLimits(env as any, 'user1', 'chat', 'pro')
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('capacity')
  })
})
