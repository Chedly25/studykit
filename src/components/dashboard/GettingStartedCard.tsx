import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Compass, Upload, Layers, MessageCircle, X } from 'lucide-react'

interface Props {
  hasDocuments: boolean
  hasTopics: boolean
  hasActivity: boolean
}

export function GettingStartedCard({ hasDocuments, hasTopics, hasActivity }: Props) {
  const { t } = useTranslation()
  const [dismissed, setDismissed] = useState(() => {
    try { return sessionStorage.getItem('gettingStartedDismissed') === '1' } catch { return false }
  })

  const handleDismiss = () => {
    setDismissed(true)
    try { sessionStorage.setItem('gettingStartedDismissed', '1') } catch { /* noop */ }
  }

  if (dismissed || (hasDocuments && hasTopics && hasActivity)) return null

  const hints: Array<{ icon: typeof Upload; text: string; to: string }> = []

  if (!hasDocuments) {
    hints.push({ icon: Upload, text: t('dashboard.hintUpload'), to: '/sources' })
  }
  if (!hasTopics) {
    hints.push({ icon: Layers, text: t('dashboard.hintExtract'), to: '/sources' })
  }
  if (hasTopics && !hasActivity) {
    hints.push({ icon: MessageCircle, text: t('dashboard.hintExplore'), to: '/chat' })
  }

  if (hints.length === 0) return null

  return (
    <div className="glass-card p-4 mb-4 relative">
      <button
        onClick={handleDismiss}
        className="absolute top-3 right-3 text-[var(--text-faint)] hover:text-[var(--text-muted)] transition-colors"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="flex items-center gap-2 mb-3">
        <Compass className="w-5 h-5 text-[var(--accent-text)]" />
        <h3 className="font-semibold text-[var(--text-heading)]">{t('dashboard.gettingStartedTitle')}</h3>
      </div>

      <p className="text-sm text-[var(--text-muted)] mb-3">{t('dashboard.gettingStartedHint')}</p>

      <div className="space-y-2">
        {hints.map(({ icon: Icon, text, to }) => (
          <Link
            key={text}
            to={to}
            className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-[var(--accent-bg)] transition-colors group"
          >
            <div className="w-8 h-8 rounded-lg bg-[var(--accent-bg)] flex items-center justify-center shrink-0">
              <Icon className="w-4 h-4 text-[var(--accent-text)]" />
            </div>
            <span className="text-sm text-[var(--text-body)] group-hover:text-[var(--accent-text)] transition-colors">
              {text}
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
