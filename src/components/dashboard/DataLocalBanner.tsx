import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ShieldAlert, X } from 'lucide-react'

interface Props {
  isPro: boolean
}

const DISMISS_KEY = 'data_warning_dismissed'

export function DataLocalBanner({ isPro }: Props) {
  const { t } = useTranslation()
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(DISMISS_KEY) === 'true' } catch { return false }
  })

  if (isPro || dismissed) return null

  const handleDismiss = () => {
    setDismissed(true)
    try { localStorage.setItem(DISMISS_KEY, 'true') } catch {}
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3 mb-3 rounded-xl bg-[var(--color-warning-bg)] border border-[var(--color-warning-border)] animate-fade-in">
      <ShieldAlert className="w-4 h-4 text-[var(--color-warning)] shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="text-sm text-[var(--text-body)]">
          {t('dashboard.dataLocalWarning', 'Your data is stored locally in this browser only. Export regularly or upgrade for cloud backup.')}
        </span>
        <span className="flex gap-3 mt-1">
          <Link to="/settings" className="text-xs font-medium text-[var(--accent-text)] hover:underline">
            {t('dashboard.exportData', 'Export')}
          </Link>
          <Link to="/pricing" className="text-xs font-medium text-[var(--color-warning)] hover:underline">
            {t('common.upgrade')}
          </Link>
        </span>
      </div>
      <button onClick={handleDismiss} className="p-1 text-[var(--text-muted)] hover:text-[var(--text-body)] shrink-0">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
