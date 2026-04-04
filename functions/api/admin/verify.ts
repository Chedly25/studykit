/**
 * GET /api/admin/verify
 * Lightweight endpoint for client-side admin check.
 * Uses the same verifyAdmin logic as all other admin endpoints.
 */

import type { Env } from '../../env'
import { verifyAdmin, AdminError } from '../../lib/adminAuth'
import { corsHeaders } from '../../lib/cors'

export const onRequestOptions: PagesFunction<Env> = async (context) => {
  return new Response(null, { status: 204, headers: corsHeaders(context.env) })
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const cors = corsHeaders(context.env)
  try {
    await verifyAdmin(context.request, context.env)
    return new Response(JSON.stringify({ admin: true }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const status = err instanceof AdminError ? err.status : 403
    return new Response(JSON.stringify({ admin: false }), {
      status,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
}
