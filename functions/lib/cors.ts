import type { Env } from '../env'

export function corsHeaders(env: Env) {
  const origin = env.ALLOWED_ORIGIN || 'https://studieskit.com'
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Vary': 'Origin',
  }
}

/**
 * Security headers for HTML responses (Cloudflare Pages _headers or middleware).
 * API endpoints return JSON so CSP is less critical there, but these can be
 * applied globally via Cloudflare Pages _headers file.
 */
export function securityHeaders(_env: Env) {
  return {
    'Content-Security-Policy': [
      "default-src 'self'",
      `script-src 'self'`,
      `style-src 'self' 'unsafe-inline'`,
      `img-src 'self' data: blob: https://img.clerk.com`,
      `font-src 'self'`,
      `connect-src 'self' https://api.clerk.com https://*.clerk.accounts.dev https://api.stripe.com https://*.posthog.com https://*.sentry.io`,
      `frame-src 'self' https://js.stripe.com https://*.clerk.accounts.dev`,
      `worker-src 'self' blob:`,
      `base-uri 'self'`,
      `form-action 'self'`,
    ].join('; '),
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(self), geolocation=()',
  }
}
