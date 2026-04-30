/**
 * Demo body for the Syllogisme coach.
 * State-driven UI that mirrors the real coach's four views (picker, scenario
 * loading, editor with three TypewriterFields, grading loading, results).
 * Driven entirely by props passed from the demo runner — no real API calls,
 * no real state stores.
 */
import { Loader2, PenSquare, ArrowRight, Sparkles } from 'lucide-react'
import { TypewriterField } from './TypewriterField'

export type SyllogismeDemoView =
  | 'picker'
  | 'scenario-loading'
  | 'editor'
  | 'grading-loading'
  | 'results'

export type SyllogismeDemoField = 'majeure' | 'mineure' | 'conclusion'

export interface SyllogismeDemoAxis {
  name: string
  score: number
  max: number
  comment: string
}

export interface SyllogismeDemoState {
  view: SyllogismeDemoView
  picker: {
    themeLabel: string
    difficultyLabel: string
  }
  scenario: {
    contextMd: string // shown as raw text — short enough to not need full markdown
  }
  submission: {
    majeure: string
    mineure: string
    conclusion: string
  }
  focus?: SyllogismeDemoField
  /** Whether the submit button is hovered/pressed — small visual flourish. */
  submitPressed?: boolean
  /** Whether the overall score banner is visible (results view). */
  overallVisible: boolean
  /** How many axes are revealed so far (0-3). */
  revealedAxesCount: number
  grading: {
    overallScore: number
    overallMax: number
    overallComment: string
    axes: SyllogismeDemoAxis[]
  }
}

interface Props {
  state: SyllogismeDemoState
}

export function SyllogismeDemoBody({ state }: Props) {
  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      {state.view === 'picker' && <PickerView state={state} />}
      {state.view === 'scenario-loading' && <LoadingView label="Génération du scénario" />}
      {state.view === 'editor' && <EditorView state={state} />}
      {state.view === 'grading-loading' && <LoadingView label="Correction en cours" />}
      {state.view === 'results' && <ResultsView state={state} />}
    </div>
  )
}

// ─── Picker view ─────────────────────────────────────────────────────

function PickerView({ state }: { state: SyllogismeDemoState }) {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-[var(--accent-bg)] flex items-center justify-center">
          <PenSquare className="w-5 h-5 text-[var(--accent-text)]" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-[var(--text-heading)]">
            Choisis un thème et un niveau
          </h2>
          <p className="text-sm text-[var(--text-muted)]">
            Le scénario sera généré à partir d'articles réels du droit français.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Thème
          </label>
          <div className="px-3 py-2.5 rounded-lg border border-[var(--border-card)] bg-[var(--bg-input)] text-sm text-[var(--text-body)]">
            {state.picker.themeLabel || <span className="italic text-[var(--text-faint)]">…</span>}
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Difficulté
          </label>
          <div className="px-3 py-2.5 rounded-lg border border-[var(--border-card)] bg-[var(--bg-input)] text-sm text-[var(--text-body)]">
            {state.picker.difficultyLabel || <span className="italic text-[var(--text-faint)]">…</span>}
          </div>
        </div>
      </div>

      <button
        type="button"
        disabled
        className="w-full px-4 py-2.5 rounded-xl bg-[var(--accent-bg)] text-[var(--accent-text)] text-sm font-semibold flex items-center justify-center gap-2 opacity-95 cursor-default"
      >
        Générer un scénario
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  )
}

// ─── Loading view ────────────────────────────────────────────────────

function LoadingView({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 animate-fade-in">
      <Loader2 className="w-8 h-8 text-[var(--accent-text)] animate-spin mb-4" />
      <div className="text-sm font-medium text-[var(--text-heading)]">{label}…</div>
      <div className="text-xs text-[var(--text-muted)] mt-1">Quelques secondes.</div>
    </div>
  )
}

// ─── Editor view ─────────────────────────────────────────────────────

function EditorView({ state }: { state: SyllogismeDemoState }) {
  const submitDisabled =
    !state.submission.majeure || !state.submission.mineure || !state.submission.conclusion
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Scenario card */}
      <div className="p-4 rounded-xl border border-[var(--border-card)] bg-[var(--bg-card)]">
        <div className="text-xs uppercase tracking-wider font-semibold text-[var(--text-muted)] mb-2">
          Scénario
        </div>
        <div className="text-sm text-[var(--text-body)] leading-relaxed whitespace-pre-line">
          {state.scenario.contextMd}
        </div>
      </div>

      {/* Three submission fields */}
      <TypewriterField
        label="Majeure"
        hint="La règle de droit applicable."
        value={state.submission.majeure}
        focused={state.focus === 'majeure'}
        minHeightClass="min-h-32"
      />
      <TypewriterField
        label="Mineure"
        hint="L'application aux faits du cas."
        value={state.submission.mineure}
        focused={state.focus === 'mineure'}
        minHeightClass="min-h-32"
      />
      <TypewriterField
        label="Conclusion"
        hint="La solution juridique."
        value={state.submission.conclusion}
        focused={state.focus === 'conclusion'}
        minHeightClass="min-h-24"
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

// ─── Results view ────────────────────────────────────────────────────

function ResultsView({ state }: { state: SyllogismeDemoState }) {
  const pct = state.grading.overallMax > 0
    ? Math.round((state.grading.overallScore / state.grading.overallMax) * 100)
    : 0

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Overall score banner */}
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

      {/* Axes — revealed progressively */}
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
