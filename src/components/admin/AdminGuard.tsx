import { useUser } from '@clerk/clerk-react'
import { Navigate } from 'react-router-dom'

const ADMIN_EMAIL = 'chedlyboukhris21@gmail.com'

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoaded } = useUser()

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
      </div>
    )
  }

  if (user?.primaryEmailAddress?.emailAddress !== ADMIN_EMAIL) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
