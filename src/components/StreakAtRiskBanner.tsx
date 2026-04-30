/**
 * Dismissible banner shown when the user's streak is at risk (hasn't studied today).
 * Appears above page content in the Layout. Resets daily.
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Flame, X, ArrowRight } from 'lucide-react'
import { useProfileVertical } from '../hooks/useProfileVertical'

interface Props {
  streak: number
  profileId: string
}

function isDismissedToday(profileId: string): boolean {
  try {
    const today = new Date().toISOString().slice(0, 10)
    return localStorage.getItem(`streak_banner_dismissed_${profileId}_${today}`) === 'true'
  } catch { return false }
}

function dismiss(profileId: string) {
  try {
    const today = new Date().toISOString().slice(0, 10)
    localStorage.setItem(`streak_banner_dismissed_${profileId}_${today}`, 'true')
  } catch { /* noop */ }
}

export function StreakAtRiskBanner({ streak, profileId }: Props) {
  const { t } = useTranslation()
  const { isCRFPA } = useProfileVertical()
  const [dismissed, setDismissed] = useState(() => isDismissedToday(profileId))

  if (dismissed || streak <= 0) return null

  // CRFPA users have no /queue — their daily action lives on /accueil.
  const ctaTarget = isCRFPA ? '/accueil' : '/queue'

  return (
    <div className="max-w-2xl mx-auto px-4 pt-4 animate-slide-up">
      <div className="glass-card p-3 flex items-center gap-3 border-l-4 border-l-amber-500">
        <Flame className="w-5 h-5 text-[var(--color-warning)] shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[var(--text-heading)]">
            {t('streak.atRiskTitle', { count: streak })}
          </p>
        </div>
        <Link to={ctaTarget} className="btn-primary px-3 py-1.5 text-xs shrink-0 flex items-center gap-1">
          {t('streak.atRiskAction')} <ArrowRight className="w-3 h-3" />
        </Link>
        <button
          onClick={() => { dismiss(profileId); setDismissed(true) }}
          className="p-1 text-[var(--text-muted)] hover:text-[var(--text-body)] shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
