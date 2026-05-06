/**
 * Shows a subtle toast when a new service worker is available.
 * Auto-dismisses after 8s — the user can reload manually later if they want.
 */
import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { RefreshCw } from 'lucide-react'

export function UpdatePrompt() {
  const { t } = useTranslation()
  const [show, setShow] = useState(false)
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const handler = () => {
      setShow(true)
      // Auto-dismiss after 8 seconds so it doesn't block the UI
      dismissTimer.current = setTimeout(() => setShow(false), 8000)
    }
    window.addEventListener('sw-update-available', handler)
    return () => {
      window.removeEventListener('sw-update-available', handler)
      if (dismissTimer.current) clearTimeout(dismissTimer.current)
    }
  }, [])

  if (!show) return null

  const handleReload = () => {
    if (dismissTimer.current) clearTimeout(dismissTimer.current)
    window.location.reload()
  }

  return (
    <div className="fixed top-16 right-4 z-50 animate-fade-in">
      <button
        onClick={handleReload}
        className="flex items-center gap-2 px-3 py-2 rounded-full bg-[var(--accent-text)] text-white text-xs font-medium shadow-lg hover:opacity-90 transition-opacity"
        title={t('common.updateAvailable')}
      >
        <RefreshCw className="w-3 h-3" />
        {t('common.reload')}
      </button>
    </div>
  )
}
