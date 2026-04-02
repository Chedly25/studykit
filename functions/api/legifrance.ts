/**
 * Cloudflare Pages Function: POST /api/legifrance
 * Proxies Legifrance API requests via PISTE OAuth.
 * Handles OAuth token management server-side.
 *
 * Actions:
 *   { action: "getArticle", id: "LEGIARTI000045391811" }
 *   { action: "search", fond: "CODE_ETAT", query: "lanceur alerte", pageSize?: 5 }
 *   { action: "getJorfText", textId: "JORFTEXT000045388745" }
 */

import type { Env } from '../env'
import { verifyClerkJWT } from '../lib/auth'
import { corsHeaders } from '../lib/cors'

const PISTE_OAUTH_URL = 'https://oauth.piste.gouv.fr/api/oauth/token'
const LEGIFRANCE_BASE = 'https://api.piste.gouv.fr/dila/legifrance/lf-engine-app'

// Cache OAuth token in-memory (Cloudflare Workers have per-request isolation,
// so this only helps within a single request with multiple API calls)
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

  if (!res.ok) {
    throw new Error(`PISTE OAuth failed: ${res.status}`)
  }

  const data = (await res.json()) as { access_token: string; expires_in: number }
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  }
  return data.access_token
}

export const onRequestOptions: PagesFunction<Env> = async (context) => {
  return new Response(null, { status: 204, headers: corsHeaders(context.env) })
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context
  const cors = corsHeaders(env)
  const jsonHeaders = { ...cors, 'Content-Type': 'application/json' }

  if (!env.CLERK_ISSUER_URL) {
    return new Response(
      JSON.stringify({ error: 'Server misconfigured' }),
      { status: 500, headers: jsonHeaders },
    )
  }

  if (!env.PISTE_OAUTH_CLIENT_ID || !env.PISTE_OAUTH_CLIENT_SECRET) {
    return new Response(
      JSON.stringify({ error: 'Legifrance API not configured (missing PISTE credentials)' }),
      { status: 500, headers: jsonHeaders },
    )
  }

  // Auth
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: jsonHeaders },
    )
  }

  try {
    await verifyClerkJWT(authHeader.slice(7), env.CLERK_ISSUER_URL)
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid token' }),
      { status: 401, headers: jsonHeaders },
    )
  }

  let body: { action: string; [key: string]: unknown }
  try {
    body = await request.json()
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON' }),
      { status: 400, headers: jsonHeaders },
    )
  }

  try {
    const pisteToken = await getPisteToken(env)
    const apiHeaders = {
      Authorization: `Bearer ${pisteToken}`,
      'Content-Type': 'application/json',
    }

    if (body.action === 'getArticle') {
      const res = await fetch(`${LEGIFRANCE_BASE}/consult/getArticle`, {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify({ id: body.id }),
      })
      if (!res.ok) throw new Error(`Legifrance getArticle: ${res.status}`)
      const data = await res.json()
      return new Response(JSON.stringify(data), { headers: jsonHeaders })
    }

    if (body.action === 'search') {
      const filtres: unknown[] = []
      if (body.codeNames && Array.isArray(body.codeNames)) {
        filtres.push({ facette: 'NOM_CODE', valeurs: body.codeNames })
      }
      const res = await fetch(`${LEGIFRANCE_BASE}/search`, {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify({
          fond: body.fond ?? 'CODE_ETAT',
          recherche: {
            champs: [{
              typeChamp: String(body.typeChamp ?? 'ALL'),
              criteres: [{
                typeRecherche: String(body.typeRecherche ?? 'UN_DES_MOTS'),
                valeur: String(body.query ?? ''),
                operateur: 'ET',
              }],
              operateur: 'ET',
            }],
            filtres,
            operateur: 'ET',
            pageNumber: body.page ?? 1,
            pageSize: body.pageSize ?? 5,
            sort: 'PERTINENCE',
            typePagination: 'DEFAUT',
          },
        }),
      })
      if (!res.ok) throw new Error(`Legifrance search: ${res.status}`)
      const data = await res.json()
      return new Response(JSON.stringify(data), { headers: jsonHeaders })
    }

    if (body.action === 'getJorfText') {
      const res = await fetch(`${LEGIFRANCE_BASE}/consult/jorf`, {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify({ textId: body.textId }),
      })
      if (!res.ok) throw new Error(`Legifrance JORF: ${res.status}`)
      const data = await res.json()
      return new Response(JSON.stringify(data), { headers: jsonHeaders })
    }

    return new Response(
      JSON.stringify({ error: 'Unknown action. Use "getArticle", "search", or "getJorfText".' }),
      { status: 400, headers: jsonHeaders },
    )
  } catch (e) {
    return new Response(
      JSON.stringify({ error: `Legifrance API error: ${(e as Error).message}` }),
      { status: 502, headers: jsonHeaders },
    )
  }
}
