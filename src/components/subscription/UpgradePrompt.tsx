import { Link } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface Props {
  messagesUsed?: number
  dailyLimit?: number
}

export function UpgradePrompt({ messagesUsed: _messagesUsed = 5, dailyLimit = 5 }: Props) {
  const { t } = useTranslation()
  return (
    <div className="glass-card p-5 text-center space-y-3">
      <Sparkles className="w-8 h-8 text-[var(--accent-text)] mx-auto" />
      <h3 className="font-semibold text-[var(--text-heading)]">
        {t('subscription.quotaExceeded', { limit: dailyLimit })}
      </h3>
      <Link to="/pricing" className="btn-primary inline-block px-6 py-2 text-sm">
        {t('subscription.upgradeNow')}
      </Link>
    </div>
  )
}
