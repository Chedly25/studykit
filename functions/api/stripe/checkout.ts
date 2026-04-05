/**
 * POST /api/stripe/checkout — Creates a Stripe Checkout Session.
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

  let userId: string
  try {
    const jwt = await verifyClerkJWT(authHeader.slice(7), env.CLERK_ISSUER_URL, env.CLERK_JWT_AUDIENCE)
    userId = jwt.sub
  } catch {
    return new Response(
      JSON.stringify({ error: 'Authentication failed' }),
      { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  }

  try {
    const body = (await request.json()) as { interval?: string }
    const interval = body.interval === 'year' ? 'year' : 'month'

    const priceId = interval === 'year'
      ? env.STRIPE_PRO_YEARLY_PRICE_ID
      : env.STRIPE_PRO_MONTHLY_PRICE_ID

    if (!priceId) {
      return new Response(
        JSON.stringify({ error: 'Stripe price not configured' }),
        { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2025-04-30.basil' })
    const origin = env.ALLOWED_ORIGIN || 'https://studieskit.com'

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: userId,
      subscription_data: {
        metadata: { clerkUserId: userId },
      },
      success_url: `${origin}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/pricing`,
    })

    return new Response(
      JSON.stringify({ url: session.url }),
      { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('Checkout session creation error:', err)
    return new Response(
      JSON.stringify({ error: 'An error occurred. Please try again.' }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  }
}
