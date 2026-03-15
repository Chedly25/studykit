/**
 * POST /api/stripe/webhook — Stripe webhook handler.
 * Verifies webhook signature using Web Crypto HMAC-SHA256.
 * Updates Clerk user publicMetadata based on subscription events.
 */

import type { Env } from '../../env'
import { updateUserMetadata } from '../../lib/clerk'

// ─── Constant-time comparison helpers ────────────────────────────
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16)
  }
  return bytes
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i]
  }
  return result === 0
}

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
  const expectedBytes = new Uint8Array(sig)

  for (const candidate of signatures) {
    const candidateBytes = hexToBytes(candidate)
    if (candidateBytes.length !== expectedBytes.length) continue
    if (timingSafeEqual(candidateBytes, expectedBytes)) return true
  }
  return false
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
