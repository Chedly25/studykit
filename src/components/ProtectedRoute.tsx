import { useAuth, RedirectToSignIn } from '@clerk/clerk-react'

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth()

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
      </div>
    )
  }

  if (!isSignedIn) {
    return <RedirectToSignIn />
  }

  return <>{children}</>
}
