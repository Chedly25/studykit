import { useAuth } from '@clerk/clerk-react'
import { useCallback } from 'react'

export function useAdmin() {
  const { getToken } = useAuth()

  const fetchAdmin = useCallback(
    async <T>(path: string): Promise<T> => {
      const token = await getToken()
      const res = await fetch(path, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const err = (await res.json().catch(() => ({ error: 'Request failed' }))) as { error: string }
        throw new Error(err.error || `HTTP ${res.status}`)
      }
      return res.json() as Promise<T>
    },
    [getToken]
  )

  const postAdmin = useCallback(
    async <T>(path: string, body: unknown): Promise<T> => {
      const token = await getToken()
      const res = await fetch(path, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = (await res.json().catch(() => ({ error: 'Request failed' }))) as { error: string }
        throw new Error(err.error || `HTTP ${res.status}`)
      }
      return res.json() as Promise<T>
    },
    [getToken]
  )

  return { fetchAdmin, postAdmin }
}
