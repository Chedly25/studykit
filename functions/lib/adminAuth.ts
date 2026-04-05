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

  // Verify user email via Clerk Backend API
  const userRes = await fetch(`https://api.clerk.com/v1/users/${sub}`, {
    headers: { Authorization: `Bearer ${env.CLERK_SECRET_KEY}` },
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

  if (!isAdmin) {
    throw new AdminError('Forbidden', 403)
  }

  return { userId: sub }
}
