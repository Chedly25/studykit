/**
 * Email notification endpoint — sends via Resend.
 * Requires Clerk JWT. Email is always sent to the authenticated user's own address.
 */
import type { Env } from '../env'
import { verifyClerkJWT } from '../lib/auth'
import { corsHeaders } from '../lib/cors'

const RATE_LIMIT = 10
const RATE_WINDOW_SECONDS = 3600

export const onRequestOptions: PagesFunction<Env> = async (context) => {
  return new Response(null, { status: 204, headers: corsHeaders(context.env) })
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env } = context
  const cors = corsHeaders(env)

  // Auth
  if (!env.CLERK_ISSUER_URL) {
    return new Response(JSON.stringify({ error: 'Auth not configured' }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const authHeader = context.request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  let userId: string
  try {
    const jwt = await verifyClerkJWT(authHeader.slice(7), env.CLERK_ISSUER_URL)
    userId = jwt.sub
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid token' }), {
      status: 401, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  // Rate limit (10 emails/hour per user)
  const rateLimitKey = `email_rate:${userId}:${Math.floor(Date.now() / (RATE_WINDOW_SECONDS * 1000))}`
  const currentCount = parseInt((await env.USAGE_KV.get(rateLimitKey)) ?? '0', 10)
  if (currentCount >= RATE_LIMIT) {
    return new Response(JSON.stringify({ error: 'Email rate limit exceeded' }), {
      status: 429, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
  await env.USAGE_KV.put(rateLimitKey, String(currentCount + 1), { expirationTtl: RATE_WINDOW_SECONDS })

  // Fetch the user's own email from Clerk (never trust client-supplied "to")
  let userEmail: string
  try {
    const userRes = await fetch(`https://api.clerk.com/v1/users/${userId}`, {
      headers: { Authorization: `Bearer ${env.CLERK_SECRET_KEY}` },
    })
    if (!userRes.ok) throw new Error('Clerk API error')
    const user = (await userRes.json()) as {
      email_addresses: Array<{ email_address: string }>
    }
    userEmail = user.email_addresses?.[0]?.email_address
    if (!userEmail) throw new Error('No email found')
  } catch {
    return new Response(JSON.stringify({ error: 'Could not resolve user email' }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const apiKey = (env as any).RESEND_API_KEY as string | undefined
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'Email service not configured' }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const body = await context.request.json() as { subject: string; html: string }

  if (!body.subject || !body.html) {
    return new Response(JSON.stringify({ error: 'Missing required fields: subject, html' }), {
      status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'StudiesKit <noreply@studieskit.com>',
        to: userEmail, // Always the authenticated user's own email
        subject: body.subject,
        html: body.html,
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      return new Response(JSON.stringify({ error: `Email send failed: ${err.slice(0, 100)}` }), {
        status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch {
    return new Response(JSON.stringify({ error: 'Failed to send email' }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
}
