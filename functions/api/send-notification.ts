/**
 * Email notification endpoint — sends via Resend.
 * Requires Clerk JWT. Email is always sent to the authenticated user's own address.
 */
import type { Env } from '../env'
import { verifyClerkJWT } from '../lib/auth'
import { corsHeaders } from '../lib/cors'
import { checkRateLimit } from '../lib/rateLimiter'
import { renderTemplate, VALID_TEMPLATES } from '../lib/emailTemplates'

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
    const jwt = await verifyClerkJWT(authHeader.slice(7), env.CLERK_ISSUER_URL, env.CLERK_JWT_AUDIENCE)
    userId = jwt.sub
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid token' }), {
      status: 401, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  if (!env.USAGE_KV) {
    return new Response(JSON.stringify({ error: 'Service temporarily unavailable' }), {
      status: 503, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  // Fetch the user's own email from Clerk BEFORE consuming rate limit (never trust client-supplied "to")
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

  // Rate limit (10 emails/hour per user) — checked after Clerk fetch so failures don't consume quota
  {
    const rl = await checkRateLimit(env.USAGE_KV, 'email', userId, 10, 3600)
    if (!rl.allowed) {
      return new Response(JSON.stringify({ error: 'Email rate limit exceeded' }), {
        status: 429, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }
  }

  const apiKey = env.RESEND_API_KEY
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'Email service not configured' }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  let body: { template?: string; data?: Record<string, unknown> }
  try {
    body = await context.request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  if (!body.template || !body.data) {
    return new Response(JSON.stringify({
      error: `Missing required fields: template, data. Valid templates: ${VALID_TEMPLATES.join(', ')}`,
    }), {
      status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const baseUrl = env.ALLOWED_ORIGIN || 'https://studieskit.com'
  const rendered = renderTemplate(body.template, body.data, baseUrl)
  if (!rendered) {
    return new Response(JSON.stringify({
      error: `Unknown template: ${body.template}. Valid templates: ${VALID_TEMPLATES.join(', ')}`,
    }), {
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
        from: env.EMAIL_FROM || 'StudiesKit <noreply@studieskit.com>',
        to: userEmail, // Always the authenticated user's own email
        subject: rendered.subject,
        html: rendered.html,
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
