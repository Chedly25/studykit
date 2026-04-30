/**
 * Demo body for the Fiche d'arrêt coach.
 * State-driven UI mirroring the real coach's five views (picker, scenario
 * loading, editor with five TypewriterFields, grading loading, results).
 */
import { Loader2, FileText, ArrowRight, Sparkles } from 'lucide-react'
import { TypewriterField } from './TypewriterField'

export type FicheDemoView =
  | 'picker'
  | 'scenario-loading'
  | 'editor'
  | 'grading-loading'
  | 'results'

export type FicheDemoField =
  | 'faits'
  | 'procedure'
  | 'moyens'
  | 'questionDeDroit'
  | 'solutionEtPortee'

export interface FicheDemoAxis {
  name: string
  score: number
  max: number
  comment: string
}

export interface FicheDemoState {
  view: FicheDemoView
  picker: { chamberLabel: string; decisionLabel: string }
  scenario: { contextMd: string }
  submission: {
    faits: string
    procedure: string
    moyens: string
    questionDeDroit: string
    solutionEtPortee: string
  }
  focus?: FicheDemoField
  submitPressed?: boolean
  overallVisible: boolean
  revealedAxesCount: number
  grading: {
    overallScore: number
    overallMax: number
    overallComment: string
    axes: FicheDemoAxis[]
  }
}

interface Props {
  state: FicheDemoState
}

export function FicheDemoBody({ state }: Props) {
  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      {state.view === 'picker' && <PickerView state={state} />}
      {state.view === 'scenario-loading' && <LoadingView label="Préparation de la décision" />}
      {state.view === 'editor' && <EditorView state={state} />}
      {state.view === 'grading-loading' && <LoadingView label="Correction en cours" />}
      {state.view === 'results' && <ResultsView state={state} />}
    </div>
  )
}

function PickerView({ state }: { state: FicheDemoState }) {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-[var(--accent-bg)] flex items-center justify-center">
          <FileText className="w-5 h-5 text-[var(--accent-text)]" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-[var(--text-heading)]">
            Choisis une chambre et une décision
          </h2>
          <p className="text-sm text-[var(--text-muted)]">
            Tu travailleras sur une décision réelle de la Cour de cassation.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <FauxField label="Chambre" value={state.picker.chamberLabel} />
        <FauxField label="Décision" value={state.picker.decisionLabel} />
      </div>

      <button
        type="button"
        disabled
        className="w-full px-4 py-2.5 rounded-xl bg-[var(--accent-bg)] text-[var(--accent-text)] text-sm font-semibold flex items-center justify-center gap-2 opacity-95 cursor-default"
      >
        Préparer la décision
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  )
}

function FauxField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
        {label}
      </label>
      <div className="px-3 py-2.5 rounded-lg border border-[var(--border-card)] bg-[var(--bg-input)] text-sm text-[var(--text-body)]">
        {value || <span className="italic text-[var(--text-faint)]">…</span>}
      </div>
    </div>
  )
}

function LoadingView({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 animate-fade-in">
      <Loader2 className="w-8 h-8 text-[var(--accent-text)] animate-spin mb-4" />
      <div className="text-sm font-medium text-[var(--text-heading)]">{label}…</div>
      <div className="text-xs text-[var(--text-muted)] mt-1">Quelques secondes.</div>
    </div>
  )
}

function EditorView({ state }: { state: FicheDemoState }) {
  const submitDisabled = Object.values(state.submission).some(v => !v)
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="p-4 rounded-xl border border-[var(--border-card)] bg-[var(--bg-card)]">
        <div className="text-xs uppercase tracking-wider font-semibold text-[var(--text-muted)] mb-2">
          La décision à ficher
        </div>
        <div className="text-sm text-[var(--text-body)] leading-relaxed whitespace-pre-line">
          {state.scenario.contextMd}
        </div>
      </div>

      <TypewriterField
        label="Faits"
        hint="Faits matériels, présentés chronologiquement."
        value={state.submission.faits}
        focused={state.focus === 'faits'}
        minHeightClass="min-h-28"
      />
      <TypewriterField
        label="Procédure"
        hint="Le parcours procédural, sans faits mêlés."
        value={state.submission.procedure}
        focused={state.focus === 'procedure'}
        minHeightClass="min-h-24"
      />
      <TypewriterField
        label="Moyens du pourvoi"
        hint="Ce que la partie demandait, reformulé."
        value={state.submission.moyens}
        focused={state.focus === 'moyens'}
        minHeightClass="min-h-24"
      />
      <TypewriterField
        label="Question de droit"
        hint="Abstraite, interrogative, vise la règle."
        value={state.submission.questionDeDroit}
        focused={state.focus === 'questionDeDroit'}
        minHeightClass="min-h-20"
      />
      <TypewriterField
        label="Solution et portée"
        hint="Le dispositif + la portée jurisprudentielle."
        value={state.submission.solutionEtPortee}
        focused={state.focus === 'solutionEtPortee'}
        minHeightClass="min-h-28"
      />

      <button
        type="button"
        disabled={submitDisabled}
        className={`w-full px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
          submitDisabled
            ? 'bg-[var(--bg-input)] text-[var(--text-faint)] cursor-not-allowed'
            : 'bg-[var(--accent-bg)] text-[var(--accent-text)] cursor-default'
        } ${state.submitPressed ? 'scale-[0.98]' : ''}`}
      >
        Soumettre
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  )
}

function ResultsView({ state }: { state: FicheDemoState }) {
  const pct = state.grading.overallMax > 0
    ? Math.round((state.grading.overallScore / state.grading.overallMax) * 100)
    : 0

  return (
    <div className="space-y-6 animate-fade-in">
      {state.overallVisible && (
        <div className="p-5 rounded-xl border border-[var(--accent-text)]/40 bg-[var(--accent-bg)] animate-fade-in-up">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-4 h-4 text-[var(--accent-text)]" />
            <span className="text-xs uppercase tracking-wider font-semibold text-[var(--accent-text)]">
              Correction
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold tabular-nums text-[var(--accent-text)]">
              {state.grading.overallScore}
            </span>
            <span className="text-sm text-[var(--text-muted)]">/ {state.grading.overallMax}</span>
            <span className="text-xs text-[var(--text-faint)] ml-1">({pct} %)</span>
          </div>
          {state.grading.overallComment && (
            <p className="text-sm text-[var(--text-body)] mt-2 italic leading-relaxed">
              « {state.grading.overallComment} »
            </p>
          )}
        </div>
      )}

      <div className="space-y-3">
        {state.grading.axes.map((axis, i) => {
          if (i >= state.revealedAxesCount) return null
          const axisPct = axis.max > 0 ? Math.round((axis.score / axis.max) * 100) : 0
          return (
            <div
              key={axis.name}
              className="p-4 rounded-lg border border-[var(--border-card)] bg-[var(--bg-card)] animate-fade-in-up"
            >
              <div className="flex items-baseline justify-between gap-3 mb-1.5">
                <span className="text-sm font-semibold text-[var(--text-heading)]">{axis.name}</span>
                <span className="text-xs tabular-nums text-[var(--text-muted)] shrink-0">
                  {axis.score} / {axis.max}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-[var(--bg-input)] overflow-hidden mb-2">
                <div
                  className="h-full rounded-full bg-[var(--accent-text)] transition-[width] duration-700"
                  style={{ width: `${axisPct}%` }}
                />
              </div>
              <p className="text-xs text-[var(--text-body)] leading-relaxed">{axis.comment}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
