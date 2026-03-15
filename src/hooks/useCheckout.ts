import { useState } from 'react'
import { useAuth } from '@clerk/clerk-react'

const ALLOWED_STRIPE_HOSTS = ['checkout.stripe.com', 'billing.stripe.com']

function isValidStripeUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' && ALLOWED_STRIPE_HOSTS.includes(parsed.hostname)
  } catch {
    return false
  }
}

export function useCheckout() {
  const { getToken } = useAuth()
  const [loading, setLoading] = useState(false)

  const checkout = async (interval: 'month' | 'year') => {
    setLoading(true)
    try {
      const token = await getToken()
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ interval }),
      })

      if (!res.ok) {
        const err = await res.json() as { error: string }
        throw new Error(err.error || 'Checkout failed')
      }

      const { url } = (await res.json()) as { url: string }
      if (!isValidStripeUrl(url)) {
        throw new Error('Invalid checkout URL received')
      }
      window.location.href = url
    } catch (err) {
      setLoading(false)
      throw err
    }
  }

  const openPortal = async () => {
    setLoading(true)
    try {
      const token = await getToken()
      const res = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      })

      if (!res.ok) {
        const err = await res.json() as { error: string }
        throw new Error(err.error || 'Portal error')
      }

      const { url } = (await res.json()) as { url: string }
      if (!isValidStripeUrl(url)) {
        throw new Error('Invalid portal URL received')
      }
      window.location.href = url
    } catch (err) {
      setLoading(false)
      throw err
    }
  }

  return { checkout, openPortal, loading }
}
