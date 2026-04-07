/**
 * Admin verification helper.
 * Verifies the caller is the admin user via Clerk JWT + email check.
 */

import type { Env } from '../env'
import { verifyClerkJWT } from './auth'

export class AdminError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

// Per-isolate cache for admin verification (helps with burst requests within same isolate)
let adminCache: { sub: string; isAdmin: boolean; fetchedAt: number } | null = null
const ADMIN_CACHE_TTL = 60_000 // 1 minute

export async function verifyAdmin(
  request: Request,
  env: Env
): Promise<{ userId: string }> {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    throw new AdminError('Unauthorized', 401)
  }

  if (!env.ADMIN_EMAIL) {
    throw new AdminError('Admin access not configured', 503)
  }

  const { sub } = await verifyClerkJWT(authHeader.slice(7), env.CLERK_ISSUER_URL, env.CLERK_JWT_AUDIENCE)

  // Check in-memory cache
  if (adminCache && adminCache.sub === sub && Date.now() - adminCache.fetchedAt < ADMIN_CACHE_TTL) {
    if (!adminCache.isAdmin) throw new AdminError('Forbidden', 403)
    return { userId: sub }
  }

  // Verify user email via Clerk Backend API (with 5s timeout)
  const userRes = await fetch(`https://api.clerk.com/v1/users/${sub}`, {
    headers: { Authorization: `Bearer ${env.CLERK_SECRET_KEY}` },
    signal: AbortSignal.timeout(5000),
  })

  if (!userRes.ok) {
    throw new AdminError('Failed to verify user', 500)
  }

  const user = (await userRes.json()) as {
    email_addresses: Array<{ email_address: string }>
  }

  const isAdmin = user.email_addresses.some(
    (e) => e.email_address === env.ADMIN_EMAIL
  )

  adminCache = { sub, isAdmin, fetchedAt: Date.now() }

  if (!isAdmin) {
    throw new AdminError('Forbidden', 403)
  }

  return { userId: sub }
}
