/**
 * POST /api/stripe/portal — Creates a Stripe Billing Portal session.
 * JWT-authenticated. Returns { url } for client redirect.
 */

import Stripe from 'stripe'
import type { Env } from '../../env'
import { verifyClerkJWT } from '../../lib/auth'
import { corsHeaders } from '../../lib/cors'

export const onRequestOptions: PagesFunction<Env> = async (context) => {
  return new Response(null, { status: 204, headers: corsHeaders(context.env) })
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context
  const cors = corsHeaders(env)

  // Auth
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(
      JSON.stringify({ error: 'Missing authorization' }),
      { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  }

  let stripeCustomerId: string | undefined
  try {
    const jwt = await verifyClerkJWT(authHeader.slice(7), env.CLERK_ISSUER_URL)
    stripeCustomerId = jwt.metadata?.stripeCustomerId
  } catch {
    return new Response(
      JSON.stringify({ error: 'Authentication failed' }),
      { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  }

  if (!stripeCustomerId) {
    return new Response(
      JSON.stringify({ error: 'No active subscription found' }),
      { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  }

  try {
    const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2025-04-30.basil' })
    const origin = env.ALLOWED_ORIGIN || 'https://studieskit.com'

    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${origin}/dashboard`,
    })

    return new Response(
      JSON.stringify({ url: session.url }),
      { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: `Portal error: ${err instanceof Error ? err.message : 'unknown'}` }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  }
}
