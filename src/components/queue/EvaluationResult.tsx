/**
 * Displays AI evaluation result with accept/override buttons.
 * Supports Enter to accept, 1-4 to override quality.
 */
import { useTranslation } from 'react-i18next'
import { CheckCircle2, AlertCircle, XCircle } from 'lucide-react'
import { MathText } from '../MathText'
import { useKeyboardShortcut } from '../../lib/keyboard'

interface Props {
  quality: number
  feedback: string
  onAccept: () => void
  onOverride: (quality: number) => void
}

const QUALITY_CONFIG: Record<number, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  1: { label: '1/5', color: 'text-[var(--color-error)] bg-[var(--color-error-bg)]', icon: XCircle },
  2: { label: '2/5', color: 'text-[var(--color-warning)] bg-[var(--color-warning-bg)]', icon: AlertCircle },
  3: { label: '3/5', color: 'text-[var(--color-warning)] bg-[var(--color-warning-bg)]', icon: AlertCircle },
  4: { label: '4/5', color: 'text-[var(--color-info)] bg-[var(--color-info-bg)]', icon: CheckCircle2 },
  5: { label: '5/5', color: 'text-[var(--color-success)] bg-[var(--color-success-bg)]', icon: CheckCircle2 },
}

const OVERRIDE_BUTTONS = [
  { quality: 1, label: '1', color: 'bg-[var(--color-error-bg)] text-[var(--color-error)] hover:bg-[var(--color-error-bg)]' },
  { quality: 3, label: '3', color: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)] hover:bg-[var(--color-warning-bg)]' },
  { quality: 4, label: '4', color: 'bg-[var(--color-info-bg)] text-[var(--color-info)] hover:bg-[var(--color-info-bg)]' },
  { quality: 5, label: '5', color: 'bg-[var(--color-success-bg)] text-[var(--color-success)] hover:bg-[var(--color-success-bg)]' },
]

export function EvaluationResult({ quality, feedback, onAccept, onOverride }: Props) {
  const { t } = useTranslation()
  const config = QUALITY_CONFIG[quality] ?? QUALITY_CONFIG[3]
  const Icon = config.icon

  useKeyboardShortcut('enter', onAccept, {
    label: 'Accept evaluation',
    scope: 'Evaluation',
  })
  useKeyboardShortcut('1', () => onOverride(1), {
    label: 'Override: Again',
    scope: 'Evaluation',
  })
  useKeyboardShortcut('2', () => onOverride(3), {
    label: 'Override: Hard',
    scope: 'Evaluation',
  })
  useKeyboardShortcut('3', () => onOverride(4), {
    label: 'Override: Good',
    scope: 'Evaluation',
  })
  useKeyboardShortcut('4', () => onOverride(5), {
    label: 'Override: Easy',
    scope: 'Evaluation',
  })

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
