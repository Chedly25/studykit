/**
 * Branded loading component — replaces bare spinners with app icon + study tip.
 * Compact mode for inline Suspense fallbacks (just the pulsing icon).
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { GraduationCap } from 'lucide-react'

interface Props {
  compact?: boolean
}

export function BrandedLoader({ compact }: Props) {
  const { t } = useTranslation()
  const tips = t('loading.tips', { returnObjects: true }) as string[]
  const [tipIndex] = useState(() => Array.isArray(tips) ? Math.floor(Math.random() * tips.length) : 0)

  if (compact) {
    return (
      <div className="flex items-center justify-center py-12">
        <GraduationCap className="w-8 h-8 text-[var(--accent-text)] animate-gentle-pulse" />
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center py-24 animate-fade-in">
      <GraduationCap className="w-10 h-10 text-[var(--accent-text)] animate-gentle-pulse mb-4" />
      {Array.isArray(tips) && tips.length > 0 && (
        <p className="text-sm text-[var(--text-muted)] max-w-xs text-center leading-relaxed">
          {tips[tipIndex]}
        </p>
      )}
    </div>
  )
}
