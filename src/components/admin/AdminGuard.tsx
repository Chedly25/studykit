import { useUser } from '@clerk/clerk-react'
import { Navigate } from 'react-router-dom'

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoaded } = useUser()

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
      </div>
    )
  }

  // Admin access is verified server-side via ADMIN_EMAIL env var.
  // Client-side check uses Clerk publicMetadata.role (set by admin API).
  const isAdmin = (user?.publicMetadata as any)?.role === 'admin'
  if (!isAdmin) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
