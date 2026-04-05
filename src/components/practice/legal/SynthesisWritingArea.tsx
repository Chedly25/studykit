/**
 * Writing area for the note de synthèse — large textarea with word count and timer.
 */
import { useRef, useEffect, useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Clock, Save, Check } from 'lucide-react'

interface SynthesisWritingAreaProps {
  value: string
  onChange: (value: string) => void
  readOnly?: boolean
  timeRemaining?: number | null
  isSaving?: boolean
  lastSaved?: Date | null
  targetWordCount?: number
}

export function SynthesisWritingArea({
  value,
  onChange,
  readOnly,
  timeRemaining,
  isSaving,
  lastSaved,
  targetWordCount = 2400,
}: SynthesisWritingAreaProps) {
  const { t } = useTranslation()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const wordCount = value.trim() ? value.trim().split(/\s+/).length : 0
  const progress = Math.min(100, Math.round((wordCount / targetWordCount) * 100))

  // Timer display
  const timerDisplay = timeRemaining != null && timeRemaining > 0 ? (() => {
    const h = Math.floor(timeRemaining / 3600)
    const m = Math.floor((timeRemaining % 3600) / 60)
    const s = timeRemaining % 60
    const isLow = timeRemaining < 600
    return (
      <div className={`flex items-center gap-1.5 text-sm font-mono font-medium ${
        isLow ? 'text-red-500 animate-pulse' : 'text-[var(--text-body)]'
      }`}>
        <Clock className="w-4 h-4" />
        <span>{h}:{String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}</span>
      </div>
    )
  })() : null

  // Word count color
  const wordCountColor = wordCount > targetWordCount * 1.1
    ? 'text-red-500'
    : wordCount > targetWordCount * 0.8
    ? 'text-green-600'
    : 'text-[var(--text-muted)]'

  return (
    <div className="flex flex-col h-full">
      {/* Header with timer + save status */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border-card)] shrink-0">
        {timerDisplay ?? <div />}
        <div className="flex items-center gap-3">
          {!readOnly && (
            <span className="text-xs text-[var(--text-faint)] flex items-center gap-1">
              {isSaving ? (
                <><Save className="w-3 h-3 animate-pulse" /> {t('documentExam.saving')}</>
              ) : lastSaved ? (
                <><Check className="w-3 h-3 text-green-500" /> {t('documentExam.saved')}</>
              ) : null}
            </span>
          )}
        </div>
      </div>

      {/* Textarea */}
      <div className="flex-1 overflow-auto">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={e => onChange(e.target.value)}
          disabled={readOnly}
          placeholder={readOnly ? '' : t('syntheseExam.placeholder')}
          className={`w-full h-full px-6 py-4 bg-transparent text-sm text-[var(--text-body)] resize-none outline-none leading-relaxed ${readOnly ? 'opacity-80 cursor-default' : ''}`}
          style={{ minHeight: '400px' }}
        />
      </div>

      {/* Footer with word count */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-[var(--border-card)] shrink-0">
        <div className="flex items-center gap-3">
          <span className={`text-xs font-medium ${wordCountColor}`}>
            {wordCount} / ~{targetWordCount} {t('documentExam.words')}
          </span>
          {/* Progress bar */}
          <div className="w-24 h-1.5 bg-[var(--bg-input)] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                wordCount > targetWordCount * 1.1 ? 'bg-red-500' :
                wordCount > targetWordCount * 0.8 ? 'bg-green-500' :
                'bg-[var(--accent-text)]'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        <span className="text-[10px] text-[var(--text-faint)]">
          ≈ {Math.max(1, Math.round(wordCount / 600))} {t('syntheseExam.pages')}
        </span>
      </div>
    </div>
  )
}
