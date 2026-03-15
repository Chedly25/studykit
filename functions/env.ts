export interface Env {
  AI: Ai
  USAGE_KV: KVNamespace
  ALLOWED_ORIGIN?: string
  CLERK_ISSUER_URL: string
  CLERK_SECRET_KEY: string
  STRIPE_SECRET_KEY: string
  STRIPE_WEBHOOK_SECRET: string
  STRIPE_PRO_MONTHLY_PRICE_ID: string
  STRIPE_PRO_YEARLY_PRICE_ID: string
}
