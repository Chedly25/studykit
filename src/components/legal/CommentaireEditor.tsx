/**
 * Commentaire d'arrêt editor — real decision viewer + introduction textarea + 6 plan fields.
 */
import { useState } from 'react'
import { Send, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import type { CommentaireTask } from '../../ai/coaching/types'
import type { CommentaireDraft } from '../../hooks/useCommentaireCoach'
import { CoachTimer } from './CoachTimer'
import { TIMER_DEFAULTS } from './coachTimerDefaults'

interface Props {
  task: CommentaireTask
  draft: CommentaireDraft
  onChange: (partial: Partial<CommentaireDraft>) => void
  onSubmit: () => void
  onCancel?: () => void
  busy?: boolean
  error?: string | null
}

const INTRO_HINT =
  'Accroche juridique, présentation de l\'arrêt (juridiction, date, parties, faits), intérêt du sujet, problématique et annonce de plan — en un seul bloc.'

const PLAN_HINT_I =
  'Intitulé nominal évoquant une dimension de la solution (ex. "L\'affirmation de...").'
const PLAN_HINT_SUB =
  'Ancre dans l\'arrêt : motifs, visa, portée. Pas d\'étiquettes neutres comme "L\'article X".'
const PLAN_HINT_II =
  'Intitulé en opposition, progression ou conséquence par rapport à I.'

export function CommentaireEditor({ task, draft, onChange, onSubmit, onCancel, busy, error }: Props) {
  const canSubmit = !busy && (
    draft.introduction.trim() ||
    draft.I.title.trim() || draft.I.IA.trim() || draft.I.IB.trim() ||
    draft.II.title.trim() || draft.II.IIA.trim() || draft.II.IIB.trim()
  )

  return (
    <div className="max-w-4xl mx-auto w-full flex flex-col gap-4 p-4">
      <DecisionViewer task={task} />

      {/* Optional timer — commentaire is ~30-45 min for intro + plan */}
      <CoachTimer sessionKey={`commentaire-${task.generatedAt}`} defaultSeconds={TIMER_DEFAULTS.fiche} />

      {/* Introduction */}
      <div className="glass-card p-4 space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <label className="text-sm font-semibold text-[var(--text-heading)]">Introduction</label>
          <span className="text-xs text-[var(--text-muted)] text-right max-w-md">{INTRO_HINT}</span>
        </div>
        <textarea
          value={draft.introduction}
          onChange={e => onChange({ introduction: e.target.value })}
          disabled={busy}
          rows={10}
          placeholder="Accroche juridique, présentation de l'arrêt, intérêt, problématique, annonce de plan…"
          className="w-full bg-[var(--bg-input)] border border-[var(--border-card)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-text)] focus:outline-none resize-y disabled:opacity-60"
        />
      </div>

      {/* I */}
      <div className="glass-card p-4 space-y-3 border-l-4 border-[var(--accent-text)]">
        <PlanField
          label="I. Titre"
          hint={PLAN_HINT_I}
          value={draft.I.title}
          onChange={v => onChange({ I: { ...draft.I, title: v } })}
          disabled={busy}
        />
        <div className="pl-4 space-y-3 border-l border-[var(--border-card)]">
          <PlanField
            label="A."
            hint={PLAN_HINT_SUB}
            value={draft.I.IA}
            onChange={v => onChange({ I: { ...draft.I, IA: v } })}
            disabled={busy}
          />
          <PlanField
            label="B."
            hint={PLAN_HINT_SUB}
            value={draft.I.IB}
            onChange={v => onChange({ I: { ...draft.I, IB: v } })}
            disabled={busy}
          />
        </div>
      </div>

      {/* II */}
      <div className="glass-card p-4 space-y-3 border-l-4 border-[var(--accent-text)]">
        <PlanField
          label="II. Titre"
          hint={PLAN_HINT_II}
          value={draft.II.title}
          onChange={v => onChange({ II: { ...draft.II, title: v } })}
          disabled={busy}
        />
        <div className="pl-4 space-y-3 border-l border-[var(--border-card)]">
          <PlanField
            label="A."
            hint={PLAN_HINT_SUB}
            value={draft.II.IIA}
            onChange={v => onChange({ II: { ...draft.II, IIA: v } })}
            disabled={busy}
          />
          <PlanField
            label="B."
            hint={PLAN_HINT_SUB}
            value={draft.II.IIB}
            onChange={v => onChange({ II: { ...draft.II, IIB: v } })}
            disabled={busy}
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

function DecisionViewer({ task }: { task: CommentaireTask }) {
  const [expanded, setExpanded] = useState(false)
  const d = task.decision
  const text = d.text || '(Texte de la décision indisponible.)'
  const isLong = text.length > 1200

  return (
    <div className="glass-card overflow-hidden">
      <div className="p-4 space-y-2 border-b border-[var(--border-card)]">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-[var(--accent-bg)] text-[var(--accent-text)] font-semibold">
            {d.chamber}
          </span>
          {d.breadcrumb && (
            <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
              {d.breadcrumb}
            </span>
          )}
          {d.reference && (
            <span className="text-[10px] text-[var(--text-muted)] font-mono">{d.reference}</span>
          )}
        </div>
      </div>
      <div className={`p-4 text-sm text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap ${isLong && !expanded ? 'max-h-64 overflow-hidden relative' : 'max-h-[60vh] overflow-y-auto'}`}>
        {text}
        {isLong && !expanded && (
          <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[var(--bg-card)] to-transparent pointer-events-none" />
        )}
      </div>
      {isLong && (
        <button
          onClick={() => setExpanded(e => !e)}
          className="w-full flex items-center justify-center gap-1 px-4 py-2 text-xs text-[var(--text-muted)] hover:bg-[var(--bg-hover)] border-t border-[var(--border-card)]"
        >
          {expanded ? <><ChevronUp className="w-3 h-3" /> Réduire</> : <><ChevronDown className="w-3 h-3" /> Voir tout</>}
        </button>
      )}
    </div>
  )
}

interface PlanFieldProps {
  label: string
  hint: string
  value: string
  onChange: (v: string) => void
  disabled?: boolean
}

function PlanField({ label, hint, value, onChange, disabled }: PlanFieldProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label className="text-sm font-semibold text-[var(--text-heading)]">{label}</label>
        <span className="text-xs text-[var(--text-muted)] text-right max-w-md">{hint}</span>
      </div>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        placeholder={`Rédigez ${label.toLowerCase()}…`}
        className="w-full bg-[var(--bg-input)] border border-[var(--border-card)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-text)] focus:outline-none disabled:opacity-60"
      />
    </div>
  )
}
