import type { Env } from '../env'

export function corsHeaders(env: Env) {
  const origin = env.ALLOWED_ORIGIN || 'https://studieskit.com'
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }
}
