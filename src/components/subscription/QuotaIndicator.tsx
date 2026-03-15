import { useTranslation } from 'react-i18next'
import { useSubscription } from '../../hooks/useSubscription'

interface Props {
  messagesUsedToday: number
  dailyLimit?: number
}

export function QuotaIndicator({ messagesUsedToday, dailyLimit = 5 }: Props) {
  const { t } = useTranslation()
  const { isPro } = useSubscription()

  if (isPro) return null

  const pct = Math.min((messagesUsedToday / dailyLimit) * 100, 100)
  const atLimit = messagesUsedToday >= dailyLimit

  return (
    <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
      <div className="w-16 h-1.5 rounded-full bg-[var(--bg-input)] overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${atLimit ? 'bg-red-500' : 'bg-[var(--accent-text)]'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={atLimit ? 'text-red-500' : ''}>
        {t('subscription.quotaUsed', { used: messagesUsedToday, limit: dailyLimit })}
      </span>
    </div>
  )
}
