/**
 * Shared KV-based rate limiter for all API endpoints.
 * Uses soft cap at 80% to absorb concurrent over-count from non-atomic KV reads.
 */

export interface RateLimitResult {
  allowed: boolean
  remaining: number
}

export async function checkRateLimit(
  kv: KVNamespace,
  endpoint: string,
  userId: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const windowKey = `ratelimit:${endpoint}:${userId}:${Math.floor(Date.now() / 1000 / windowSeconds)}`
  const currentStr = await kv.get(windowKey)
  const current = currentStr ? parseInt(currentStr, 10) : 0

  const softLimit = Math.floor(limit * 0.8)
  if (current >= softLimit) {
    return { allowed: false, remaining: 0 }
  }

  const newCount = current + 1
  await kv.put(windowKey, String(newCount), { expirationTtl: windowSeconds })
  return { allowed: true, remaining: softLimit - newCount }
}
