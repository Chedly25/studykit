export interface Env {
  AI: Ai
  USAGE_KV: KVNamespace
  SYNC_KV: KVNamespace
  ALLOWED_ORIGIN?: string
  LLM_API_KEY: string
  LLM_API_URL?: string
  LLM_MODEL?: string
  CLERK_ISSUER_URL: string
  CLERK_SECRET_KEY: string
  STRIPE_SECRET_KEY: string
  STRIPE_WEBHOOK_SECRET: string
  STRIPE_PRO_MONTHLY_PRICE_ID: string
  STRIPE_PRO_YEARLY_PRICE_ID: string
  TAVILY_API_KEY?: string
}
