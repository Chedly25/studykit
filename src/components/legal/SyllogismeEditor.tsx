/**
 * Three-panel editor for the student's syllogisme attempt.
 * Shows scenario + question at the top, then 3 textareas with methodological hints.
 */
import { Send, Loader2 } from 'lucide-react'
import type { SyllogismeTask } from '../../ai/coaching/types'
import type { SubmissionDraft } from '../../hooks/useSyllogismeCoach'
import { SyllogismeExample } from './SyllogismeExample'
import { CoachTimer } from './CoachTimer'
import { TIMER_DEFAULTS } from './coachTimerDefaults'

interface Props {
  task: SyllogismeTask
  draft: SubmissionDraft
  onChange: (partial: Partial<SubmissionDraft>) => void
  onSubmit: () => void
  onCancel?: () => void
  busy?: boolean
  error?: string | null
}

const HINTS = {
  majeure:
    'Cite l\'article pertinent et décompose la règle en ses éléments constitutifs (conditions cumulatives).',
  mineure:
    'Pour chaque élément de la majeure, rattache le fait précis du scénario qui le satisfait ou qui pose problème.',
  conclusion:
    'Une phrase affirmative reliant mineure et majeure ; ajoute une brève justification.',
} as const

export function SyllogismeEditor({ task, draft, onChange, onSubmit, onCancel, busy, error }: Props) {
  const canSubmit = !busy && (draft.majeure.trim() || draft.mineure.trim() || draft.conclusion.trim())

  return (
    <div className="max-w-4xl mx-auto w-full flex flex-col gap-4 p-4">
      {/* Scenario + question card */}
      <div className="glass-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-[var(--accent-bg)] text-[var(--accent-text)] font-semibold">
            {task.theme}
          </span>
          <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
            Niveau {task.difficulty}
          </span>
        </div>
        <p className="text-sm text-[var(--text-primary)] leading-relaxed">{task.scenario}</p>
        <p className="text-sm text-[var(--text-heading)] font-medium pt-2 border-t border-[var(--border-card)]">
          {task.question}
        </p>
      </div>

      {/* Optional timer — exam-realism */}
      <CoachTimer sessionKey={`syllogisme-${task.generatedAt}`} defaultSeconds={TIMER_DEFAULTS.syllogisme} />

      {/* Worked example — collapsible pedagogical aid */}
      <SyllogismeExample />

      {/* Three sections */}
      <Section
        label="Majeure"
        hint={HINTS.majeure}
        value={draft.majeure}
        onChange={v => onChange({ majeure: v })}
        disabled={busy}
      />
      <Section
        label="Mineure"
        hint={HINTS.mineure}
        value={draft.mineure}
        onChange={v => onChange({ mineure: v })}
        disabled={busy}
      />
      <Section
        label="Conclusion"
        hint={HINTS.conclusion}
        value={draft.conclusion}
        onChange={v => onChange({ conclusion: v })}
        disabled={busy}
      />

      {/* Error banner */}
      {error && (
        <div className="glass-card p-3 text-sm text-rose-600 dark:text-rose-400 border border-rose-500/30">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 justify-end">
        {busy && onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-2 rounded-lg text-sm text-[var(--text-muted)] hover:bg-[var(--bg-hover)]"
          >
            Annuler
          </button>
        )}
        <button
          type="button"
          onClick={onSubmit}
          disabled={!canSubmit}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent-bg)] text-[var(--accent-text)] text-sm font-medium disabled:opacity-40 hover:opacity-90 transition-opacity"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {busy ? 'Correction en cours…' : 'Soumettre pour correction'}
        </button>
      </div>
    </div>
  )
}

interface SectionProps {
  label: string
  hint: string
  value: string
  onChange: (v: string) => void
  disabled?: boolean
}

function Section({ label, hint, value, onChange, disabled }: SectionProps) {
  return (
    <div className="glass-card p-4 space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <label className="text-sm font-semibold text-[var(--text-heading)]">{label}</label>
        <span className="text-xs text-[var(--text-muted)] text-right max-w-md">{hint}</span>
      </div>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        rows={5}
        placeholder={`Rédigez la ${label.toLowerCase()}…`}
        className="w-full bg-[var(--bg-input)] border border-[var(--border-card)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-text)] focus:outline-none resize-y disabled:opacity-60"
      />
    </div>
  )
}
