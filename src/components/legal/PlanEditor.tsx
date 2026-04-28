/**
 * Structured editor for the CRFPA dissertation plan.
 * Shows the question + theme at top, then 7 inputs (problématique + I/IA/IB + II/IIA/IIB).
 */
import { Send, Loader2 } from 'lucide-react'
import type { PlanTask } from '../../ai/coaching/types'
import type { PlanDraft } from '../../hooks/usePlanCoach'
import { CoachTimer } from './CoachTimer'
import { TIMER_DEFAULTS } from './coachTimerDefaults'

interface Props {
  task: PlanTask
  draft: PlanDraft
  onChange: (partial: Partial<PlanDraft>) => void
  onSubmit: () => void
  onCancel?: () => void
  busy?: boolean
  error?: string | null
}

const HINTS = {
  problematique:
    'Pose une tension ou une évolution juridique en 1-2 phrases. Évite la description.',
  I: 'Intitulé nominal, court, problématisé (ex. « Un principe consacré comme... »).',
  IA: 'Sous-partie ancrée dans un article ou un arrêt précis.',
  IB: 'Sous-partie complémentaire de I/A, sans chevauchement avec II.',
  II: 'Intitulé en opposition, progression ou évolution par rapport à I.',
  IIA: 'Sous-partie ancrée ; premier volet de la seconde partie.',
  IIB: 'Sous-partie complémentaire, clôt le plan.',
} as const

export function PlanEditor({ task, draft, onChange, onSubmit, onCancel, busy, error }: Props) {
  const canSubmit = !busy && (
    draft.problematique.trim() ||
    draft.I.title.trim() || draft.I.IA.trim() || draft.I.IB.trim() ||
    draft.II.title.trim() || draft.II.IIA.trim() || draft.II.IIB.trim()
  )

  return (
    <div className="max-w-4xl mx-auto w-full flex flex-col gap-4 p-4">
      {/* Question card */}
      <div className="glass-card p-4 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-[var(--accent-bg)] text-[var(--accent-text)] font-semibold">
            {task.themeLabel}
          </span>
          <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
            Dissertation
          </span>
        </div>
        <p className="text-base text-[var(--text-heading)] font-semibold leading-snug">
          {task.question}
        </p>
      </div>

      {/* Optional timer */}
      <CoachTimer sessionKey={`plan-${task.generatedAt}`} defaultSeconds={TIMER_DEFAULTS.plan} />

      {/* Problématique */}
      <Field
        label="Problématique"
        hint={HINTS.problematique}
        value={draft.problematique}
        onChange={v => onChange({ problematique: v })}
        disabled={busy}
        rows={3}
      />

      {/* I */}
      <div className="glass-card p-4 space-y-3 border-l-4 border-[var(--accent-text)]">
        <Field
          label="I. Titre"
          hint={HINTS.I}
          value={draft.I.title}
          onChange={v => onChange({ I: { ...draft.I, title: v } })}
          disabled={busy}
          rows={1}
          nested
        />
        <div className="pl-4 space-y-3 border-l border-[var(--border-card)]">
          <Field
            label="A."
            hint={HINTS.IA}
            value={draft.I.IA}
            onChange={v => onChange({ I: { ...draft.I, IA: v } })}
            disabled={busy}
            rows={1}
            nested
          />
          <Field
            label="B."
            hint={HINTS.IB}
            value={draft.I.IB}
            onChange={v => onChange({ I: { ...draft.I, IB: v } })}
            disabled={busy}
            rows={1}
            nested
          />
        </div>
      </div>

      {/* II */}
      <div className="glass-card p-4 space-y-3 border-l-4 border-[var(--accent-text)]">
        <Field
          label="II. Titre"
          hint={HINTS.II}
          value={draft.II.title}
          onChange={v => onChange({ II: { ...draft.II, title: v } })}
          disabled={busy}
          rows={1}
          nested
        />
        <div className="pl-4 space-y-3 border-l border-[var(--border-card)]">
          <Field
            label="A."
            hint={HINTS.IIA}
            value={draft.II.IIA}
            onChange={v => onChange({ II: { ...draft.II, IIA: v } })}
            disabled={busy}
            rows={1}
            nested
          />
          <Field
            label="B."
            hint={HINTS.IIB}
            value={draft.II.IIB}
            onChange={v => onChange({ II: { ...draft.II, IIB: v } })}
            disabled={busy}
            rows={1}
            nested
          />
        </div>
      </div>

      {error && (
        <div className="glass-card p-3 text-sm text-[var(--color-error)] border border-[var(--color-error-border)]">
          {error}
        </div>
      )}

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

interface FieldProps {
  label: string
  hint: string
  value: string
  onChange: (v: string) => void
  disabled?: boolean
  rows?: number
  nested?: boolean
}

function Field({ label, hint, value, onChange, disabled, rows = 1, nested }: FieldProps) {
  const Wrapper = nested ? 'div' : 'div'
  return (
    <Wrapper className={nested ? 'space-y-1.5' : 'glass-card p-4 space-y-2'}>
      <div className="flex items-baseline justify-between gap-2">
        <label className="text-sm font-semibold text-[var(--text-heading)]">{label}</label>
        <span className="text-xs text-[var(--text-muted)] text-right max-w-md">{hint}</span>
      </div>
      {rows <= 1 ? (
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          disabled={disabled}
          placeholder={`Rédigez ${label.toLowerCase()}…`}
          className="w-full bg-[var(--bg-input)] border border-[var(--border-card)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-text)] focus:outline-none disabled:opacity-60"
        />
      ) : (
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          disabled={disabled}
          rows={rows}
          placeholder={`Rédigez ${label.toLowerCase()}…`}
          className="w-full bg-[var(--bg-input)] border border-[var(--border-card)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-text)] focus:outline-none resize-y disabled:opacity-60"
        />
      )}
    </Wrapper>
  )
}
