/**
 * Shows a toast-style banner when a new service worker is available.
 * Listens for 'sw-update-available' custom event dispatched by main.tsx.
 */
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { RefreshCw, X } from 'lucide-react'

export function UpdatePrompt() {
  const { t } = useTranslation()
  const [show, setShow] = useState(false)

  useEffect(() => {
    const handler = () => setShow(true)
    window.addEventListener('sw-update-available', handler)
    return () => window.removeEventListener('sw-update-available', handler)
  }, [])

  if (!show) return null

  const handleReload = () => {
    window.location.reload()
  }

  return (
    <div className="fixed bottom-4 left-4 z-50 glass-card p-3 flex items-center gap-3 shadow-lg animate-fade-in max-w-sm">
      <RefreshCw className="w-4 h-4 text-[var(--accent-text)] shrink-0" />
      <span className="text-sm text-[var(--text-body)] flex-1">
        {t('common.updateAvailable')}
      </span>
      <button
        onClick={handleReload}
        className="btn-primary text-xs px-3 py-1 shrink-0"
      >
        {t('common.reload')}
      </button>
      <button
        onClick={() => setShow(false)}
        className="p-1 text-[var(--text-muted)] hover:text-[var(--text-body)]"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
