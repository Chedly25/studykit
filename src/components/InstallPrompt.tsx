/**
 * PWA install prompt — shows "Add to Home Screen" banner after 3+ visits.
 * Captures the beforeinstallprompt event and shows a dismissible banner.
 */
import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Download, X } from 'lucide-react'

const VISIT_KEY = 'studieskit_visit_count'
const DISMISSED_KEY = 'studieskit_install_dismissed'

export function InstallPrompt() {
  const { t } = useTranslation()
  const [show, setShow] = useState(false)
  const deferredPromptRef = useRef<any>(null)

  useEffect(() => {
    // Don't show if already dismissed
    if (localStorage.getItem(DISMISSED_KEY) === 'true') return

    // Increment visit count
    const visits = parseInt(localStorage.getItem(VISIT_KEY) ?? '0', 10) + 1
    localStorage.setItem(VISIT_KEY, String(visits))

    // Only show after 3+ visits
    if (visits < 3) return

    const handler = (e: Event) => {
      e.preventDefault()
      deferredPromptRef.current = e
      setShow(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  if (!show) return null

  const handleInstall = async () => {
    const prompt = deferredPromptRef.current
    if (prompt) {
      prompt.prompt()
      await prompt.userChoice
    }
    setShow(false)
  }

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, 'true')
    setShow(false)
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 glass-card p-3 flex items-center gap-3 shadow-lg animate-fade-in max-w-sm">
      <Download className="w-4 h-4 text-[var(--accent-text)] shrink-0" />
      <span className="text-sm text-[var(--text-body)] flex-1">
        {t('common.installApp', 'Install StudiesKit for a better experience')}
      </span>
      <button
        onClick={handleInstall}
        className="btn-primary text-xs px-3 py-1 shrink-0"
      >
        {t('common.install', 'Install')}
      </button>
      <button
        onClick={handleDismiss}
        className="p-1 text-[var(--text-muted)] hover:text-[var(--text-body)]"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
