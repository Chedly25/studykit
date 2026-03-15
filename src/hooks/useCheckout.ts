import { useState } from 'react'
import { useAuth } from '@clerk/clerk-react'

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
      window.location.href = url
    } catch (err) {
      setLoading(false)
      throw err
    }
  }

  return { checkout, openPortal, loading }
}
