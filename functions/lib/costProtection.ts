/**
 * Cost protection — daily caps and global kill switch for all paid API endpoints.
 * Uses Cloudflare KV for persistence across isolates.
 */
import type { Env } from '../env'

// ─── Daily per-user caps (hard stop, resets at midnight UTC) ─────
const DAILY_CAPS: Record<string, number> = {
  chat: 500,       // Interactive LLM (Kimi) — matches PRO_DAILY_LIMIT
  fast: 300,       // Pipeline LLM (Haiku) — background jobs only
  embed: 200,      // Embedding generation (Cloudflare AI)
  search: 100,     // Web search (Tavily)
  email: 5,        // Outbound emails (Resend)
  push: 50,        // Push subscription management
}

// ─── Global kill switch threshold (all users combined) ───────────
const GLOBAL_DAILY_CAP: Record<string, number> = {
  chat: 10000,
  fast: 5000,
  embed: 3000,
  search: 2000,
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Check and increment the per-user daily cap for a given endpoint.
 * Returns { allowed: true } if under the cap, { allowed: false } if exceeded.
 */
export async function checkDailyCap(
  kv: KVNamespace,
  userId: string,
  endpoint: string,
): Promise<{ allowed: boolean; remaining: number }> {
  const cap = DAILY_CAPS[endpoint]
  if (!cap) return { allowed: true, remaining: 999 }

  const key = `daily:${endpoint}:${userId}:${todayKey()}`
  const current = parseInt((await kv.get(key)) ?? '0', 10)

  if (current >= cap) {
    return { allowed: false, remaining: 0 }
  }

  // Increment (TTL 48h to auto-cleanup after day ends)
  await kv.put(key, String(current + 1), { expirationTtl: 172800 })
  return { allowed: true, remaining: cap - current - 1 }
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

  const key = `global:${endpoint}:${todayKey()}`
  const current = parseInt((await kv.get(key)) ?? '0', 10)

  if (current >= cap) {
    return { allowed: false }
  }

  await kv.put(key, String(current + 1), { expirationTtl: 172800 })
  return { allowed: true }
}

/**
 * Full cost check: global cap + per-user daily cap.
 * Call this at the top of every paid endpoint.
 */
export async function checkCostLimits(
  env: Env,
  userId: string,
  endpoint: string,
): Promise<{ allowed: boolean; reason?: string }> {
  const globalCheck = await checkGlobalCap(env.USAGE_KV, endpoint)
  if (!globalCheck.allowed) {
    return { allowed: false, reason: 'Service at capacity. Please try again tomorrow.' }
  }

  const dailyCheck = await checkDailyCap(env.USAGE_KV, userId, endpoint)
  if (!dailyCheck.allowed) {
    return { allowed: false, reason: `Daily limit reached for this feature. Resets at midnight UTC.` }
  }

  return { allowed: true }
}
