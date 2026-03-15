import { useUser } from '@clerk/clerk-react'
import type { SubscriptionMetadata } from '../types/subscription'

export function useSubscription() {
  const { user, isLoaded } = useUser()

  const metadata = (user?.publicMetadata ?? {}) as Partial<SubscriptionMetadata>
  const plan = metadata.plan === 'pro' ? 'pro' : 'free'

  return {
    plan,
    isPro: plan === 'pro',
    isLoading: !isLoaded,
    billingInterval: metadata.billingInterval,
    currentPeriodEnd: metadata.currentPeriodEnd,
    cancelAtPeriodEnd: metadata.cancelAtPeriodEnd ?? false,
    paymentFailed: metadata.paymentFailed ?? false,
    stripeCustomerId: metadata.stripeCustomerId,
  }
}
