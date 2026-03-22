/**
 * Small dismissible alert when significant calibration gaps exist.
 */
import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, TrendingUp, X } from 'lucide-react'
import type { Topic } from '../../db/schema'

interface Props {
  topics: Topic[]
  profileId: string
}

export function CalibrationAlert({ topics, profileId }: Props) {
  const { t } = useTranslation()
  const today = new Date().toISOString().slice(0, 10)
  const dismissKey = `calibration_dismissed_${profileId}_${today}`
  // Re-read localStorage every render so it resets when the date changes
  const [dismissCount, setDismissCount] = useState(0)
  const dismissed = localStorage.getItem(dismissKey) === 'true'

  const dismiss = useCallback(() => {
    localStorage.setItem(dismissKey, 'true')
    setDismissCount(c => c + 1) // force re-render
  }, [dismissKey])

  if (dismissed) return null

  // Find most extreme calibration gap
  const calibrated = topics.filter(t => t.questionsAttempted >= 3)

  let worstOverconfident: { name: string; confidence: number; mastery: number; gap: number } | null = null
  let worstUnderconfident: { name: string; confidence: number; mastery: number; gap: number } | null = null

  for (const t of calibrated) {
    const gap = t.confidence - t.mastery
    if (gap > 0.25 && (!worstOverconfident || gap > worstOverconfident.gap)) {
      worstOverconfident = { name: t.name, confidence: t.confidence, mastery: t.mastery, gap }
    }
    if (gap < -0.25 && (!worstUnderconfident || Math.abs(gap) > Math.abs(worstUnderconfident.gap))) {
      worstUnderconfident = { name: t.name, confidence: t.confidence, mastery: t.mastery, gap }
    }
  }

  // Show overconfident first (more actionable), then underconfident
  const alert = worstOverconfident || worstUnderconfident
  if (!alert) return null

  const isOverconfident = alert.gap > 0
  void dismissCount // used to trigger re-render

  return (
    <div className={`flex items-start gap-3 p-3 mb-4 rounded-xl ${
      isOverconfident
        ? 'bg-amber-500/10 border border-amber-500/20'
        : 'bg-emerald-500/10 border border-emerald-500/20'
    }`}>
      {isOverconfident
        ? <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
        : <TrendingUp className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
      }
      <div className="flex-1 min-w-0">
        <p className="text-sm text-[var(--text-body)]">
          {isOverconfident
            ? t('calibration.overconfident', { name: alert.name, confidence: Math.round(alert.confidence * 100), mastery: Math.round(alert.mastery * 100) })
            : t('calibration.underconfident', { name: alert.name, mastery: Math.round(alert.mastery * 100), confidence: Math.round(alert.confidence * 100) })
          }
        </p>
      </div>
      <button onClick={dismiss} className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-body)] shrink-0">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
