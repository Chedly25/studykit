/**
 * Displays AI evaluation result with accept/override buttons.
 * Supports Enter to accept, 1-4 to override quality.
 */
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, AlertCircle, XCircle } from 'lucide-react'
import { MathText } from '../MathText'

interface Props {
  quality: number
  feedback: string
  onAccept: () => void
  onOverride: (quality: number) => void
}

const QUALITY_CONFIG: Record<number, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  1: { label: '1/5', color: 'text-red-500 bg-red-500/10', icon: XCircle },
  2: { label: '2/5', color: 'text-orange-500 bg-orange-500/10', icon: AlertCircle },
  3: { label: '3/5', color: 'text-yellow-500 bg-yellow-500/10', icon: AlertCircle },
  4: { label: '4/5', color: 'text-blue-500 bg-blue-500/10', icon: CheckCircle2 },
  5: { label: '5/5', color: 'text-emerald-500 bg-emerald-500/10', icon: CheckCircle2 },
}

const OVERRIDE_BUTTONS = [
  { quality: 1, label: '1', color: 'bg-red-500/15 text-red-600 hover:bg-red-500/25' },
  { quality: 3, label: '3', color: 'bg-orange-500/15 text-orange-600 hover:bg-orange-500/25' },
  { quality: 4, label: '4', color: 'bg-blue-500/15 text-blue-600 hover:bg-blue-500/25' },
  { quality: 5, label: '5', color: 'bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/25' },
]

export function EvaluationResult({ quality, feedback, onAccept, onOverride }: Props) {
  const { t } = useTranslation()
  const config = QUALITY_CONFIG[quality] ?? QUALITY_CONFIG[3]
  const Icon = config.icon

  // Keyboard: Enter=accept, 1-4=override
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'Enter') {
        e.preventDefault()
        onAccept()
        return
      }
      const keyMap: Record<string, number> = { '1': 1, '2': 3, '3': 4, '4': 5 }
      const q = keyMap[e.key]
      if (q) {
        e.preventDefault()
        onOverride(q)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onAccept, onOverride])

  return (
    <div className="space-y-3 animate-fade-in">
      {/* Score badge + feedback */}
      <div className="flex items-start gap-3">
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm font-bold shrink-0 ${config.color}`}>
          <Icon className="w-4 h-4" />
          {config.label}
        </div>
        <p className="text-sm text-[var(--text-body)] leading-relaxed">
          <MathText>{feedback}</MathText>
        </p>
      </div>

      {/* Accept + override */}
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={onAccept}
          className="btn-primary text-sm px-4 py-2 flex items-center gap-1.5"
        >
          {t('queue.acceptScore')}
          <span className="text-[10px] opacity-60 ml-1">Enter</span>
        </button>
        <span className="text-xs text-[var(--text-faint)]">{t('queue.overrideLabel')}</span>
        {OVERRIDE_BUTTONS.map((btn, i) => (
          <button
            key={btn.quality}
            onClick={() => onOverride(btn.quality)}
            className={`w-8 h-8 rounded-lg text-xs font-bold transition-colors ${btn.color}`}
            title={`Override to ${btn.quality}/5`}
          >
            <span className="text-[9px] opacity-40">{i + 1}</span> {btn.label}
          </button>
        ))}
      </div>

      <p className="text-[10px] text-[var(--text-faint)]">
        {t('queue.enterToAccept')}
      </p>
    </div>
  )
}
