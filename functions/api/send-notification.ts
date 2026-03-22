/**
 * Email notification endpoint — sends via Resend.
 * Requires Clerk JWT authentication.
 */
import type { Env } from '../env'
import { verifyClerkJWT } from '../lib/auth'
import { corsHeaders } from '../lib/cors'

export const onRequestOptions: PagesFunction<Env> = async (context) => {
  return new Response(null, { status: 204, headers: corsHeaders(context.env) })
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env } = context
  const cors = corsHeaders(env)

  // Auth required
  if (!env.CLERK_ISSUER_URL) {
    return new Response(JSON.stringify({ error: 'Auth not configured' }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const token = context.request.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  try {
    await verifyClerkJWT(token, env.CLERK_ISSUER_URL)
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid token' }), {
      status: 401, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const apiKey = (env as any).RESEND_API_KEY as string | undefined
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'RESEND_API_KEY not configured' }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const body = await context.request.json() as {
    to: string
    subject: string
    html: string
  }

  if (!body.to || !body.subject || !body.html) {
    return new Response(JSON.stringify({ error: 'Missing required fields: to, subject, html' }), {
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
        to: body.to,
        subject: body.subject,
        html: body.html,
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      return new Response(JSON.stringify({ error: err }), {
        status: response.status, headers: { ...cors, 'Content-Type': 'application/json' },
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
