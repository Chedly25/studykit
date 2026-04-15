/**
 * POST /api/admin/legifrance-crawl
 * Admin-only Legifrance proxy with no rate limit — for bulk ingestion only.
 */
import type { Env } from '../../env'
import { verifyClerkJWT } from '../../lib/auth'
import { corsHeaders } from '../../lib/cors'

const PISTE_OAUTH_URL = 'https://oauth.piste.gouv.fr/api/oauth/token'
const LEGIFRANCE_BASE = 'https://api.piste.gouv.fr/dila/legifrance/lf-engine-app'

let cachedToken: { token: string; expiresAt: number } | null = null

async function getPisteToken(env: Env): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token
  }
  const res = await fetch(PISTE_OAUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: env.PISTE_OAUTH_CLIENT_ID ?? '',
      client_secret: env.PISTE_OAUTH_CLIENT_SECRET ?? '',
      scope: 'openid',
    }),
  })
  if (!res.ok) throw new Error(`PISTE OAuth failed: ${res.status}`)
  const data = (await res.json()) as { access_token: string; expires_in: number }
  cachedToken = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 }
  return data.access_token
}

export const onRequestOptions: PagesFunction<Env> = async (context) => {
  return new Response(null, { status: 204, headers: corsHeaders(context.env) })
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const cors = corsHeaders(context.env)
  const json = { ...cors, 'Content-Type': 'application/json' }

  try {
    // Auth: accept either ADMIN_API_KEY or admin JWT
    const auth = context.request.headers.get('Authorization')
    if (!auth) {
      return new Response(JSON.stringify({ error: 'no auth' }), { status: 401, headers: json })
    }

    if (auth.startsWith('ApiKey ')) {
      // Static API key auth for batch scripts
      if (!context.env.ADMIN_API_KEY || auth.slice(7) !== context.env.ADMIN_API_KEY) {
        return new Response(JSON.stringify({ error: 'invalid api key' }), { status: 403, headers: json })
      }
    } else if (auth.startsWith('Bearer ')) {
      // JWT auth for interactive use
      let jwt: Awaited<ReturnType<typeof verifyClerkJWT>>
      try {
        jwt = await verifyClerkJWT(auth.slice(7), context.env.CLERK_ISSUER_URL, context.env.CLERK_JWT_AUDIENCE)
      } catch (e) {
        return new Response(JSON.stringify({ error: 'jwt failed', detail: String(e) }), { status: 401, headers: json })
      }
      const role = (jwt.metadata as Record<string, unknown> | undefined)?.role
      if (role !== 'admin') {
        return new Response(JSON.stringify({ error: 'not admin' }), { status: 403, headers: json })
      }
    } else {
      return new Response(JSON.stringify({ error: 'invalid auth format' }), { status: 401, headers: json })
    }

    const body = (await context.request.json()) as { action: string; [k: string]: unknown }

    if (!context.env.PISTE_OAUTH_CLIENT_ID || !context.env.PISTE_OAUTH_CLIENT_SECRET) {
      return new Response(JSON.stringify({ error: 'no piste creds' }), { status: 503, headers: json })
    }

    const pisteToken = await getPisteToken(context.env)
    const apiH = { Authorization: `Bearer ${pisteToken}`, 'Content-Type': 'application/json' }

    let path: string
    let payload: unknown

    if (body.action === 'listCodes') {
      path = '/list/code'
      payload = { date: body.date ?? new Date().toISOString().slice(0, 10) }
    } else if (body.action === 'getTableMatieres') {
      path = '/consult/code/tableMatieres'
      payload = { textId: String(body.textId), date: body.date ?? new Date().toISOString().slice(0, 10) }
    } else if (body.action === 'getArticle') {
      path = '/consult/getArticle'
      payload = { id: String(body.id) }
    } else if (body.action === 'embed') {
      // Embed texts via Workers AI — no rate limit for admin batch jobs
      const texts = (body.texts as string[])?.slice(0, 100).map((t: string) => String(t).slice(0, 8192))
      if (!texts?.length) return new Response(JSON.stringify({ error: 'no texts' }), { status: 400, headers: json })
      const result = await context.env.AI.run('@cf/baai/bge-m3', { text: texts })
      const embeddings = (result.data ?? []).map((vec: number[]) => {
        const f32 = new Float32Array(vec)
        const bytes = new Uint8Array(f32.buffer)
        let binary = ''
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
        return btoa(binary)
      })
      return new Response(JSON.stringify({ embeddings }), { headers: json })
    } else {
      return new Response(JSON.stringify({ error: 'unknown action' }), { status: 400, headers: json })
    }

    const res = await fetch(`${LEGIFRANCE_BASE}${path}`, {
      method: 'POST',
      headers: apiH,
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const t = await res.text().catch(() => '')
      return new Response(JSON.stringify({ error: `piste ${res.status}`, body: t.slice(0, 500) }), { status: 502, headers: json })
    }

    const data = await res.json()
    return new Response(JSON.stringify(data), { headers: json })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e), stack: (e as Error).stack?.slice(0, 500) }), { status: 500, headers: json })
  }
}
