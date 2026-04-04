/**
 * Cost protection — daily caps and global kill switch for all paid API endpoints.
 * Uses Cloudflare KV for persistence across isolates.
 */
import type { Env } from '../env'

// ─── Daily per-user caps (resets at midnight UTC) ────────────────
// Plan-aware: { free, pro }. KV get-then-put is non-atomic; soft cap
// at 80% absorbs worst-case concurrent over-count.
const SOFT_CAP_RATIO = 0.8

const DAILY_CAPS: Record<string, { free: number; pro: number }> = {
  chat:       { free: 25,  pro: 500 },
  fast:       { free: 0,   pro: 300 },
  embed:      { free: 50,  pro: 200 },
  search:     { free: 20,  pro: 100 },
  email:      { free: 2,   pro: 5 },
  push:       { free: 10,  pro: 50 },
  transcribe: { free: 0,   pro: 100 },
  vision:     { free: 0,   pro: 50 },
}

// ─── Global kill switch threshold (all users combined) ───────────
const GLOBAL_DAILY_CAP: Record<string, number> = {
  chat: 10000,
  fast: 5000,
  embed: 3000,
  search: 2000,
  transcribe: 2000,
  vision: 1000,
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Check and increment the per-user daily cap for a given endpoint.
 * Uses plan-aware limits and a soft cap at 80% to mitigate KV race conditions.
 */
export async function checkDailyCap(
  kv: KVNamespace,
  userId: string,
  endpoint: string,
  plan?: string,
): Promise<{ allowed: boolean; remaining: number; limit: number }> {
  const caps = DAILY_CAPS[endpoint]
  if (!caps) return { allowed: true, remaining: 999, limit: 999 }

  const hardCap = plan === 'pro' ? caps.pro : caps.free
  if (hardCap === 0) return { allowed: false, remaining: 0, limit: 0 }

  const softCap = Math.floor(hardCap * SOFT_CAP_RATIO)
  const key = `daily:${endpoint}:${userId}:${todayKey()}`
  const current = parseInt((await kv.get(key)) ?? '0', 10)

  if (current >= softCap) {
    return { allowed: false, remaining: 0, limit: hardCap }
  }

  // Increment (TTL 48h to auto-cleanup after day ends)
  await kv.put(key, String(current + 1), { expirationTtl: 172800 })
  return { allowed: true, remaining: softCap - current - 1, limit: hardCap }
}

/**
 * Check and increment the global daily counter for a given endpoint.
 * If the global threshold is exceeded, ALL users are blocked.
 * This is the emergency kill switch.
 */
export async function checkGlobalCap(
  kv: KVNamespace,
  endpoint: string,
): Promise<{ allowed: boolean }> {
  const cap = GLOBAL_DAILY_CAP[endpoint]
  if (!cap) return { allowed: true }

  const softCap = Math.floor(cap * SOFT_CAP_RATIO)
  const key = `global:${endpoint}:${todayKey()}`
  const current = parseInt((await kv.get(key)) ?? '0', 10)

  if (current >= softCap) {
    return { allowed: false }
  }

  await kv.put(key, String(current + 1), { expirationTtl: 172800 })
  return { allowed: true }
}

/**
 * Full cost check: per-user daily cap + global kill switch.
 * Daily cap is checked first so free users on pro-only endpoints
 * are rejected early without burning global quota.
 */
export async function checkCostLimits(
  env: Env,
  userId: string,
  endpoint: string,
  plan?: string,
): Promise<{ allowed: boolean; reason?: string; limit?: number }> {
  if (!env.USAGE_KV) return { allowed: true }

  // Check per-user daily cap first (avoids incrementing global counter for blocked users)
  const dailyCheck = await checkDailyCap(env.USAGE_KV, userId, endpoint, plan)
  if (!dailyCheck.allowed) {
    const upgradeHint = plan !== 'pro' ? ' Upgrade to Pro for higher limits.' : ''
    return {
      allowed: false,
      reason: `Daily limit reached (${dailyCheck.limit} requests). Resets at midnight UTC.${upgradeHint}`,
      limit: dailyCheck.limit,
    }
  }

  // Global kill switch — checked after per-user cap to avoid burning global quota for blocked users
  const globalCheck = await checkGlobalCap(env.USAGE_KV, endpoint)
  if (!globalCheck.allowed) {
    return { allowed: false, reason: 'Service at capacity. Please try again tomorrow.' }
  }

  return { allowed: true }
}
