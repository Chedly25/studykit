/**
 * POST /api/stripe/webhook — Stripe webhook handler.
 * Verifies webhook signature using Web Crypto HMAC-SHA256.
 * Updates Clerk user publicMetadata based on subscription events.
 */

import type { Env } from '../../env'
import { updateUserMetadata } from '../../lib/clerk'

// ─── Web Crypto webhook signature verification ───────────────────
async function verifyStripeSignature(
  payload: string,
  sigHeader: string,
  secret: string
): Promise<boolean> {
  const parts = sigHeader.split(',')
  let timestamp = ''
  const signatures: string[] = []

  for (const part of parts) {
    const [key, value] = part.split('=')
    if (key === 't') timestamp = value
    if (key === 'v1') signatures.push(value)
  }

  if (!timestamp || signatures.length === 0) return false

  // Check timestamp tolerance (5 minutes)
  const ts = parseInt(timestamp, 10)
  if (Math.abs(Date.now() / 1000 - ts) > 300) return false

  const signedPayload = `${timestamp}.${payload}`
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedPayload))
  const expected = Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')

  return signatures.some(s => s === expected)
}

// ─── Handler ─────────────────────────────────────────────────────
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context

  const sigHeader = request.headers.get('stripe-signature')
  if (!sigHeader) {
    return new Response('Missing stripe-signature', { status: 400 })
  }

  const rawBody = await request.text()

  const valid = await verifyStripeSignature(rawBody, sigHeader, env.STRIPE_WEBHOOK_SECRET)
  if (!valid) {
    return new Response('Invalid signature', { status: 400 })
  }

  const event = JSON.parse(rawBody) as {
    type: string
    data: { object: Record<string, unknown> }
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object
        const clerkUserId = (session.client_reference_id ||
          (session.subscription_data as Record<string, unknown>)?.metadata?.clerkUserId) as string
        const customerId = session.customer as string
        const subscriptionId = session.subscription as string

        if (clerkUserId) {
          await updateUserMetadata(env.CLERK_SECRET_KEY, clerkUserId, {
            plan: 'pro',
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
          })
        }
        break
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object
        const clerkUserId = (sub.metadata as Record<string, string>)?.clerkUserId
        if (!clerkUserId) break

        const currentPeriodEnd = sub.current_period_end as number
        const cancelAtPeriodEnd = sub.cancel_at_period_end as boolean
        const items = sub.items as { data: Array<{ price: { recurring: { interval: string } } }> }
        const interval = items?.data?.[0]?.price?.recurring?.interval

        await updateUserMetadata(env.CLERK_SECRET_KEY, clerkUserId, {
          plan: 'pro',
          stripeSubscriptionId: sub.id as string,
          billingInterval: interval || undefined,
          currentPeriodEnd: currentPeriodEnd
            ? new Date(currentPeriodEnd * 1000).toISOString()
            : undefined,
          cancelAtPeriodEnd,
          paymentFailed: false,
        })
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object
        const clerkUserId = (sub.metadata as Record<string, string>)?.clerkUserId
        if (!clerkUserId) break

        await updateUserMetadata(env.CLERK_SECRET_KEY, clerkUserId, {
          plan: 'free',
          stripeCustomerId: undefined,
          stripeSubscriptionId: undefined,
          billingInterval: undefined,
          currentPeriodEnd: undefined,
          cancelAtPeriodEnd: undefined,
          paymentFailed: undefined,
        })
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object
        const subId = invoice.subscription as string
        // Try to find clerkUserId from subscription metadata
        // The subscription object may have been expanded or we need to look it up
        const subMeta = (invoice.subscription_details as Record<string, unknown>)?.metadata as Record<string, string> | undefined
        const clerkUserId = subMeta?.clerkUserId
        if (!clerkUserId) break

        await updateUserMetadata(env.CLERK_SECRET_KEY, clerkUserId, {
          paymentFailed: true,
          stripeSubscriptionId: subId,
        })
        break
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Webhook processing error:', err)
    return new Response(
      JSON.stringify({ error: 'Webhook processing failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
