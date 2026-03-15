export interface SubscriptionMetadata {
  plan: 'free' | 'pro'
  stripeCustomerId?: string
  stripeSubscriptionId?: string
  billingInterval?: 'month' | 'year'
  currentPeriodEnd?: string
  cancelAtPeriodEnd?: boolean
  paymentFailed?: boolean
}
