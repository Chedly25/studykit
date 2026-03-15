import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useUser } from '@clerk/clerk-react'
import { PartyPopper } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export default function SubscriptionSuccess() {
  const { t } = useTranslation()
  const { user } = useUser()
  const [refreshed, setRefreshed] = useState(false)

  useEffect(() => {
    // Reload Clerk user data to pick up the updated publicMetadata from the webhook
    if (user && !refreshed) {
      user.reload().then(() => setRefreshed(true)).catch(() => setRefreshed(true))
    }
  }, [user, refreshed])

  return (
    <div className="max-w-md mx-auto px-4 py-16 text-center animate-fade-in">
      <PartyPopper className="w-16 h-16 text-[var(--accent-text)] mx-auto mb-6" />
      <h1 className="text-2xl font-bold text-[var(--text-heading)] mb-3">
        {t('subscription.successTitle')}
      </h1>
      <p className="text-[var(--text-muted)] mb-8">
        {t('subscription.successSubtitle')}
      </p>
      <Link to="/dashboard" className="btn-primary inline-block px-8 py-2.5">
        {t('subscription.goToDashboard')}
      </Link>
    </div>
  )
}
