/**
 * Push notification endpoint — subscribe/unsubscribe/send.
 * Stores subscriptions in KV.
 */

interface Env {
  VAPID_PUBLIC_KEY: string
  VAPID_PRIVATE_KEY: string
  PUSH_SUBSCRIPTIONS: KVNamespace
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url)
  const action = url.searchParams.get('action')

  if (action === 'vapid-key') {
    return new Response(JSON.stringify({ publicKey: context.env.VAPID_PUBLIC_KEY || '' }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ error: 'Unknown action' }), {
    status: 400,
    headers: { 'Content-Type': 'application/json' },
  })
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const body = await context.request.json() as {
    action: 'subscribe' | 'unsubscribe' | 'send'
    subscription?: { endpoint: string; keys: { p256dh: string; auth: string } }
    endpoint?: string
    title?: string
    body?: string
    url?: string
  }

  const kv = context.env.PUSH_SUBSCRIPTIONS
  if (!kv) {
    return new Response(JSON.stringify({ error: 'KV not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (body.action === 'subscribe' && body.subscription) {
    const key = encodeURIComponent(body.subscription.endpoint)
    await kv.put(key, JSON.stringify(body.subscription), { expirationTtl: 60 * 60 * 24 * 90 })
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (body.action === 'unsubscribe' && body.endpoint) {
    const key = encodeURIComponent(body.endpoint)
    await kv.delete(key)
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ error: 'Unknown action or missing params' }), {
    status: 400,
    headers: { 'Content-Type': 'application/json' },
  })
}
