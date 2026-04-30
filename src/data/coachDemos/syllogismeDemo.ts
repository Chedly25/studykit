/**
 * Syllogisme demo script — drives the FeatureDemoPlayer through a full
 * exercise (picker → scenario → editor → submit → grading → results).
 *
 * Reuses the Phase 3 example data (`SYLLOGISME_EXAMPLE`) so the demo's
 * journey produces the artifact users can re-open as a static example.
 */

import type { GenericDemoStep } from '../../components/legal/demo/types'
import type {
  SyllogismeDemoState,
  SyllogismeDemoField,
} from '../../components/legal/demo/SyllogismeDemoBody'
import { COACH_EXAMPLES } from '../coachExamples'

// ─── Extract submission sections from the Phase 3 markdown ──────────

const example = COACH_EXAMPLES.syllogisme!

function extractSection(md: string, heading: string): string {
  const re = new RegExp(`## ${heading}\\s*\\n+([\\s\\S]*?)(?=\\n## |$)`)
  return md.match(re)?.[1].trim() ?? ''
}

const MAJEURE_TEXT = extractSection(example.submission, 'Majeure')
const MINEURE_TEXT = extractSection(example.submission, 'Mineure')
const CONCLUSION_TEXT = extractSection(example.submission, 'Conclusion')

// Plain-text scenario card (without markdown asterisks). Manually authored to
// match the Phase 3 example context but render cleanly in the demo body.
const SCENARIO_TEXT =
  `Sophie, en se rendant à son travail au volant de sa voiture, percute par mégarde un piéton, Lucas (32 ans), qui traversait alors que le feu de circulation lui était défavorable. Lucas se blesse au genou et l'assigne en responsabilité civile.\n\nQuestion : Sophie peut-elle être tenue d'indemniser Lucas, et sur quel fondement ?`

// ─── Initial / final states ─────────────────────────────────────────

export const SYLLOGISME_DEMO_INITIAL: SyllogismeDemoState = {
  view: 'picker',
  picker: { themeLabel: '', difficultyLabel: '' },
  scenario: { contextMd: SCENARIO_TEXT },
  submission: { majeure: '', mineure: '', conclusion: '' },
  focus: undefined,
  submitPressed: false,
  overallVisible: false,
  revealedAxesCount: 0,
  grading: {
    overallScore: example.overallScore,
    overallMax: example.overallMax,
    overallComment: example.overallComment ?? '',
    axes: example.axes.map(a => ({ name: a.name, score: a.score, max: a.max, comment: a.comment })),
  },
}

export const SYLLOGISME_DEMO_FINAL: SyllogismeDemoState = {
  ...SYLLOGISME_DEMO_INITIAL,
  view: 'results',
  picker: { themeLabel: 'Responsabilité civile', difficultyLabel: 'Intermédiaire' },
  submission: {
    majeure: MAJEURE_TEXT,
    mineure: MINEURE_TEXT,
    conclusion: CONCLUSION_TEXT,
  },
  overallVisible: true,
  revealedAxesCount: SYLLOGISME_DEMO_INITIAL.grading.axes.length,
}

// ─── Steps ──────────────────────────────────────────────────────────

type Step = GenericDemoStep<SyllogismeDemoState, SyllogismeDemoField>

export const SYLLOGISME_DEMO_STEPS: Step[] = [
  // Intro
  { kind: 'narrate', text: 'Voyons comment se déroule un exercice de syllogisme, en moins d\'une minute.', ms: 3000 },

  // Picker — fill in theme + difficulty visibly
  { kind: 'narrate', text: 'D\'abord, tu choisis un thème et un niveau.', ms: 1800 },
  { kind: 'set', update: s => ({ ...s, picker: { ...s.picker, themeLabel: 'Responsabilité civile' } }), dwellMs: 700 },
  { kind: 'set', update: s => ({ ...s, picker: { ...s.picker, difficultyLabel: 'Intermédiaire' } }), dwellMs: 1200 },

  // Loading scenario
  { kind: 'narrate', text: 'L\'IA prépare un scénario à partir d\'articles réels.', ms: 2200 },
  { kind: 'set', update: s => ({ ...s, view: 'scenario-loading' }), dwellMs: 1800 },

  // Editor with scenario
  { kind: 'narrate', text: 'Voici ton scénario. À toi de raisonner en trois temps.', ms: 2500 },
  { kind: 'set', update: s => ({ ...s, view: 'editor' }), dwellMs: 1500 },

  // Majeure
  { kind: 'narrate', text: 'Étape 1 — la majeure : la règle de droit applicable.', ms: 2500 },
  { kind: 'set', update: s => ({ ...s, focus: 'majeure' }) },
  { kind: 'type', field: 'majeure', text: MAJEURE_TEXT, charsPerSec: 80 },

  // Mineure
  { kind: 'narrate', text: 'Étape 2 — la mineure : l\'application aux faits.', ms: 2200 },
  { kind: 'set', update: s => ({ ...s, focus: 'mineure' }) },
  { kind: 'type', field: 'mineure', text: MINEURE_TEXT, charsPerSec: 80 },

  // Conclusion
  { kind: 'narrate', text: 'Étape 3 — la conclusion : la solution juridique.', ms: 2200 },
  { kind: 'set', update: s => ({ ...s, focus: 'conclusion' }) },
  { kind: 'type', field: 'conclusion', text: CONCLUSION_TEXT, charsPerSec: 80 },

  // Submit
  { kind: 'set', update: s => ({ ...s, focus: undefined }), dwellMs: 600 },
  { kind: 'narrate', text: 'Tu soumets ta copie.', ms: 1500 },
  { kind: 'set', update: s => ({ ...s, submitPressed: true }), dwellMs: 220 },
  { kind: 'set', update: s => ({ ...s, submitPressed: false, view: 'grading-loading' }), dwellMs: 2000 },

  // Results
  { kind: 'narrate', text: 'L\'IA évalue chaque axe de ton raisonnement.', ms: 2500 },
  { kind: 'set', update: s => ({ ...s, view: 'results', overallVisible: true }), dwellMs: 1800 },
  { kind: 'narrate', text: 'Pour chaque axe, un score et une explication concrète.', ms: 2500 },
  { kind: 'set', update: s => ({ ...s, revealedAxesCount: 1 }), dwellMs: 1100 },
  { kind: 'set', update: s => ({ ...s, revealedAxesCount: 2 }), dwellMs: 1100 },
  { kind: 'set', update: s => ({ ...s, revealedAxesCount: 3 }), dwellMs: 1500 },

  // Final invitation
  { kind: 'narrate', text: 'Tu peux maintenant lancer ton premier syllogisme — toi-même.', ms: 4000 },
]

// Approximate total duration — used by the player progress bar.
// Sum of `ms` and `dwellMs` from set/wait/narrate steps + estimated typing time
// (chars / charsPerSec) for type steps.
export const SYLLOGISME_DEMO_DURATION_MS =
  // narrate / set / wait
  3000 + 1800 + 700 + 1200
  + 2200 + 1800
  + 2500 + 1500
  + 2500 // narrate majeure
  + 2200 // narrate mineure
  + 2200 // narrate conclusion
  + 600 + 1500 + 220 + 2000 // submit
  + 2500 + 1800 + 2500 + 1100 + 1100 + 1500 // results
  + 4000 // final
  // typing
  + Math.round((MAJEURE_TEXT.length / 80) * 1000)
  + Math.round((MINEURE_TEXT.length / 80) * 1000)
  + Math.round((CONCLUSION_TEXT.length / 80) * 1000)

// ─── applyType — coach-specific: how a single character lands in state ──

export function applySyllogismeType(
  state: SyllogismeDemoState,
  field: SyllogismeDemoField,
  char: string,
): SyllogismeDemoState {
  return {
    ...state,
    submission: { ...state.submission, [field]: state.submission[field] + char },
  }
}
