/**
 * Read-only field that renders typed text with a blinking caret at the end
 * when focused. Looks like a real textarea but is purely presentational —
 * the demo runner is what actually fills `value` over time.
 */
import type { ReactNode } from 'react'

interface TypewriterFieldProps {
  /** Label shown above the field. */
  label: string
  /** Optional helper hint shown below the label. */
  hint?: string
  /** The current text — accumulates over time as the demo types. */
  value: string
  /** When true, a blinking caret is shown at the end of the value. */
  focused: boolean
  /** Optional minimum height for the field (Tailwind class, e.g. `min-h-32`). */
  minHeightClass?: string
  /** Optional right-side adornment (e.g. word count). */
  rightAdornment?: ReactNode
}

export function TypewriterField({
  label,
  hint,
  value,
  focused,
  minHeightClass = 'min-h-24',
  rightAdornment,
}: TypewriterFieldProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            {label}
          </span>
          {hint && (
            <span className="ml-2 text-xs text-[var(--text-faint)]">{hint}</span>
          )}
        </div>
        {rightAdornment}
      </div>
      <div
        className={`${minHeightClass} px-3 py-2.5 rounded-lg border bg-[var(--bg-input)] whitespace-pre-wrap text-sm text-[var(--text-body)] leading-relaxed transition-colors ${
          focused
            ? 'border-[var(--accent-text)] ring-1 ring-[var(--accent-text)]/20'
            : 'border-[var(--border-card)]'
        }`}
      >
        {value}
        {focused && (
          <span
            aria-hidden="true"
            className="inline-block w-[1.5px] h-[1em] -mb-0.5 ml-[1px] bg-[var(--text-body)] animate-pulse"
          />
        )}
        {!focused && !value && (
          <span className="text-[var(--text-faint)] italic">…</span>
        )}
      </div>
    </div>
  )
}
