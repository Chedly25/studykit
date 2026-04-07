import { useState, useEffect } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { Navigate } from 'react-router-dom'

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { getToken, isLoaded, userId } = useAuth()
  const [status, setStatus] = useState<'loading' | 'admin' | 'denied'>('loading')

  useEffect(() => {
    if (!isLoaded || !userId) return

    // Check sessionStorage cache keyed by userId (avoids re-fetching on every navigation,
    // but invalidates if a different user signs in within the same tab)
    try {
      const cached = JSON.parse(sessionStorage.getItem('adminVerified') ?? '{}')
      if (cached.userId === userId && Date.now() - cached.ts < 5 * 60 * 1000) {
        setStatus('admin')
        return
      }
    } catch { /* malformed cache — proceed to verify */ }

    let cancelled = false
    ;(async () => {
      try {
        const token = await getToken()
        const res = await fetch('/api/admin/verify', {
          headers: { Authorization: `Bearer ${token}` },
        })
        const data = await res.json() as { admin: boolean }
        if (cancelled) return
        if (data.admin) {
          sessionStorage.setItem('adminVerified', JSON.stringify({ userId, ts: Date.now() }))
          setStatus('admin')
        } else {
          sessionStorage.removeItem('adminVerified')
          setStatus('denied')
        }
      } catch {
        if (!cancelled) setStatus('denied')
      }
    })()

    return () => { cancelled = true }
  }, [isLoaded, userId, getToken])

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
      </div>
    )
  }

  if (status === 'denied') {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
