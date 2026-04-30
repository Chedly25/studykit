/**
 * Demo body for the Plan détaillé coach.
 * Mirrors the real coach's five views: picker, scenario loading, editor with
 * seven nested TypewriterFields (problématique + I/A/B + II/A/B), grading
 * loading, and results.
 */
import { Loader2, ListTree, ArrowRight, Sparkles } from 'lucide-react'
import { TypewriterField } from './TypewriterField'

export type PlanDemoView =
  | 'picker'
  | 'scenario-loading'
  | 'editor'
  | 'grading-loading'
  | 'results'

export type PlanDemoField =
  | 'problematique'
  | 'iTitle'
  | 'iA'
  | 'iB'
  | 'iiTitle'
  | 'iiA'
  | 'iiB'

export interface PlanDemoAxis {
  name: string
  score: number
  max: number
  comment: string
}

export interface PlanDemoState {
  view: PlanDemoView
  picker: { themeLabel: string; questionLabel: string }
  scenario: { contextMd: string }
  submission: {
    problematique: string
    iTitle: string
    iA: string
    iB: string
    iiTitle: string
    iiA: string
    iiB: string
  }
  focus?: PlanDemoField
  submitPressed?: boolean
  overallVisible: boolean
  revealedAxesCount: number
  grading: {
    overallScore: number
    overallMax: number
    overallComment: string
    axes: PlanDemoAxis[]
  }
}

interface Props {
  state: PlanDemoState
}

export function PlanDemoBody({ state }: Props) {
  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      {state.view === 'picker' && <PickerView state={state} />}
      {state.view === 'scenario-loading' && <LoadingView label="Préparation du sujet" />}
      {state.view === 'editor' && <EditorView state={state} />}
      {state.view === 'grading-loading' && <LoadingView label="Correction en cours" />}
      {state.view === 'results' && <ResultsView state={state} />}
    </div>
  )
}

function PickerView({ state }: { state: PlanDemoState }) {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-[var(--accent-bg)] flex items-center justify-center">
          <ListTree className="w-5 h-5 text-[var(--accent-text)]" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-[var(--text-heading)]">
            Choisis un thème de dissertation
          </h2>
          <p className="text-sm text-[var(--text-muted)]">
            L'IA générera un sujet, à toi de structurer le plan.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <FauxField label="Thème" value={state.picker.themeLabel} />
        <FauxField label="Sujet" value={state.picker.questionLabel} multiline />
      </div>

      <button
        type="button"
        disabled
        className="w-full px-4 py-2.5 rounded-xl bg-[var(--accent-bg)] text-[var(--accent-text)] text-sm font-semibold flex items-center justify-center gap-2 opacity-95 cursor-default"
      >
        Générer un sujet
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  )
}

function FauxField({ label, value, multiline }: { label: string; value: string; multiline?: boolean }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
        {label}
      </label>
      <div
        className={`px-3 py-2.5 rounded-lg border border-[var(--border-card)] bg-[var(--bg-input)] text-sm text-[var(--text-body)] ${
          multiline ? 'min-h-16 leading-relaxed' : ''
        }`}
      >
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

function EditorView({ state }: { state: PlanDemoState }) {
  const submitDisabled = Object.values(state.submission).some(v => !v)
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="p-4 rounded-xl border border-[var(--border-card)] bg-[var(--bg-card)]">
        <div className="text-xs uppercase tracking-wider font-semibold text-[var(--text-muted)] mb-2">
          Sujet
        </div>
        <div className="text-sm text-[var(--text-body)] leading-relaxed whitespace-pre-line">
          {state.scenario.contextMd}
        </div>
      </div>

      <TypewriterField
        label="Problématique"
        hint="Une vraie tension juridique, formulée en interrogation."
        value={state.submission.problematique}
        focused={state.focus === 'problematique'}
        minHeightClass="min-h-20"
      />

      {/* I */}
      <div className="space-y-3">
        <TypewriterField
          label="I."
          hint="Premier mouvement."
          value={state.submission.iTitle}
          focused={state.focus === 'iTitle'}
          minHeightClass="min-h-12"
        />
        <div className="pl-6 border-l-2 border-[var(--border-card)] space-y-3">
          <TypewriterField
            label="A."
            value={state.submission.iA}
            focused={state.focus === 'iA'}
            minHeightClass="min-h-12"
          />
          <TypewriterField
            label="B."
            value={state.submission.iB}
            focused={state.focus === 'iB'}
            minHeightClass="min-h-12"
          />
        </div>
      </div>

      {/* II */}
      <div className="space-y-3">
        <TypewriterField
          label="II."
          hint="Mouvement opposé ou prolongement."
          value={state.submission.iiTitle}
          focused={state.focus === 'iiTitle'}
          minHeightClass="min-h-12"
        />
        <div className="pl-6 border-l-2 border-[var(--border-card)] space-y-3">
          <TypewriterField
            label="A."
            value={state.submission.iiA}
            focused={state.focus === 'iiA'}
            minHeightClass="min-h-12"
          />
          <TypewriterField
            label="B."
            value={state.submission.iiB}
            focused={state.focus === 'iiB'}
            minHeightClass="min-h-12"
          />
        </div>
      </div>

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

function ResultsView({ state }: { state: PlanDemoState }) {
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
