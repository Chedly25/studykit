/**
 * Plan détaillé demo script — drives the FeatureDemoPlayer through a full
 * plan exercise. Reuses Phase 3 example data (theme: imprévision; plan in
 * two parts on the 2016 reform).
 */

import type { GenericDemoStep } from '../../components/legal/demo/types'
import type {
  PlanDemoState,
  PlanDemoField,
} from '../../components/legal/demo/PlanDemoBody'
import { COACH_EXAMPLES } from '../coachExamples'

const example = COACH_EXAMPLES.plan!

// Plan example texts — kept in sync with Phase 3 plan example. Hardcoded
// rather than parsed from markdown because the plan markdown structure
// (problématique + I/II with bold/italic markers) is brittle to regex.
const PROBLEMATIQUE =
  'Dans quelle mesure la consécration légale de l\'imprévision par la réforme de 2016 rompt-elle avec la tradition française d\'intangibilité du contrat ?'

const I_TITLE = 'Une rupture circonscrite avec le principe d\'intangibilité du contrat'
const I_A =
  'Le rejet historique de l\'imprévision : la jurisprudence Canal de Craponne et le primat de l\'autonomie de la volonté'
const I_B =
  'Les contournements jurisprudentiels et conventionnels avant 2016 : bonne foi, théorie des risques, clauses de hardship'

const II_TITLE = 'Une consécration légale au régime équilibré (art. 1195 du Code civil)'
const II_A =
  'Le mécanisme : un changement imprévisible rendant l\'exécution excessivement onéreuse, ouvrant droit à renégociation puis à révision judiciaire'
const II_B =
  'Les limites du dispositif : caractère supplétif, exigences strictes, et résistance d\'un certain ordre public économique'

const SCENARIO_TEXT =
  `« La théorie de l'imprévision en droit des contrats français. »

Une dissertation classique, repensée par la réforme de 2016. Tu disposes du texte (art. 1195 C. civ.), de la jurisprudence Canal de Craponne, et de la doctrine sur les clauses de hardship.`

export const PLAN_DEMO_INITIAL: PlanDemoState = {
  view: 'picker',
  picker: { themeLabel: '', questionLabel: '' },
  scenario: { contextMd: SCENARIO_TEXT },
  submission: {
    problematique: '',
    iTitle: '',
    iA: '',
    iB: '',
    iiTitle: '',
    iiA: '',
    iiB: '',
  },
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

export const PLAN_DEMO_FINAL: PlanDemoState = {
  ...PLAN_DEMO_INITIAL,
  view: 'results',
  picker: {
    themeLabel: 'Droit des contrats',
    questionLabel: '« La théorie de l\'imprévision en droit des contrats français. »',
  },
  submission: {
    problematique: PROBLEMATIQUE,
    iTitle: I_TITLE,
    iA: I_A,
    iB: I_B,
    iiTitle: II_TITLE,
    iiA: II_A,
    iiB: II_B,
  },
  overallVisible: true,
  revealedAxesCount: PLAN_DEMO_INITIAL.grading.axes.length,
}

type Step = GenericDemoStep<PlanDemoState, PlanDemoField>

export const PLAN_DEMO_STEPS: Step[] = [
  { kind: 'narrate', text: 'Voyons comment construire un plan détaillé, en moins d\'une minute.', ms: 3000 },

  // Picker
  { kind: 'narrate', text: 'D\'abord, tu choisis un thème.', ms: 1800 },
  { kind: 'set', update: s => ({ ...s, picker: { ...s.picker, themeLabel: 'Droit des contrats' } }), dwellMs: 800 },

  // Loading
  { kind: 'narrate', text: 'L\'IA tire un sujet réaliste, tombable au CRFPA.', ms: 2200 },
  { kind: 'set', update: s => ({ ...s, view: 'scenario-loading' }), dwellMs: 1800 },

  // Editor with sujet
  { kind: 'narrate', text: 'Le sujet apparaît. À toi de structurer.', ms: 2300 },
  { kind: 'set',
    update: s => ({
      ...s,
      view: 'editor',
      picker: { ...s.picker, questionLabel: '« La théorie de l\'imprévision en droit des contrats français. »' },
    }),
    dwellMs: 1500 },

  // Problématique
  { kind: 'narrate', text: 'Première étape — la problématique. Une vraie tension, formulée en question.', ms: 2800 },
  { kind: 'set', update: s => ({ ...s, focus: 'problematique' }) },
  { kind: 'type', field: 'problematique', text: PROBLEMATIQUE, charsPerSec: 80 },

  // I title
  { kind: 'narrate', text: 'I — le premier mouvement.', ms: 1800 },
  { kind: 'set', update: s => ({ ...s, focus: 'iTitle' }) },
  { kind: 'type', field: 'iTitle', text: I_TITLE, charsPerSec: 80 },

  // I.A
  { kind: 'narrate', text: 'I.A — première sous-partie, ancrée dans la jurisprudence.', ms: 2200 },
  { kind: 'set', update: s => ({ ...s, focus: 'iA' }) },
  { kind: 'type', field: 'iA', text: I_A, charsPerSec: 85 },

  // I.B
  { kind: 'narrate', text: 'I.B — seconde sous-partie, en complément.', ms: 1800 },
  { kind: 'set', update: s => ({ ...s, focus: 'iB' }) },
  { kind: 'type', field: 'iB', text: I_B, charsPerSec: 85 },

  // II title
  { kind: 'narrate', text: 'II — le mouvement opposé ou le prolongement.', ms: 2200 },
  { kind: 'set', update: s => ({ ...s, focus: 'iiTitle' }) },
  { kind: 'type', field: 'iiTitle', text: II_TITLE, charsPerSec: 80 },

  // II.A
  { kind: 'narrate', text: 'II.A — première sous-partie du second axe.', ms: 1800 },
  { kind: 'set', update: s => ({ ...s, focus: 'iiA' }) },
  { kind: 'type', field: 'iiA', text: II_A, charsPerSec: 85 },

  // II.B
  { kind: 'narrate', text: 'II.B — la nuance, les limites.', ms: 1800 },
  { kind: 'set', update: s => ({ ...s, focus: 'iiB' }) },
  { kind: 'type', field: 'iiB', text: II_B, charsPerSec: 85 },

  // Submit
  { kind: 'set', update: s => ({ ...s, focus: undefined }), dwellMs: 600 },
  { kind: 'narrate', text: 'Tu soumets ton plan.', ms: 1500 },
  { kind: 'set', update: s => ({ ...s, submitPressed: true }), dwellMs: 220 },
  { kind: 'set', update: s => ({ ...s, submitPressed: false, view: 'grading-loading' }), dwellMs: 2000 },

  // Results
  { kind: 'narrate', text: 'L\'IA évalue six axes : problématique, opposition, équilibre, chevauchement, ancrage, transitions.', ms: 3500 },
  { kind: 'set', update: s => ({ ...s, view: 'results', overallVisible: true }), dwellMs: 1800 },
  { kind: 'narrate', text: 'Pour chaque axe, un score sur 5 et un commentaire ciblé.', ms: 2500 },
  { kind: 'set', update: s => ({ ...s, revealedAxesCount: 1 }), dwellMs: 700 },
  { kind: 'set', update: s => ({ ...s, revealedAxesCount: 2 }), dwellMs: 700 },
  { kind: 'set', update: s => ({ ...s, revealedAxesCount: 3 }), dwellMs: 700 },
  { kind: 'set', update: s => ({ ...s, revealedAxesCount: 4 }), dwellMs: 700 },
  { kind: 'set', update: s => ({ ...s, revealedAxesCount: 5 }), dwellMs: 700 },
  { kind: 'set', update: s => ({ ...s, revealedAxesCount: 6 }), dwellMs: 1500 },

  { kind: 'narrate', text: 'Lance ton premier plan détaillé.', ms: 4000 },
]

export const PLAN_DEMO_DURATION_MS =
  3000 + 1800 + 800
  + 2200 + 1800
  + 2300 + 1500
  + 2800 + 1800 + 2200 + 1800 + 2200 + 1800 + 1800 // narrates between sections
  + 600 + 1500 + 220 + 2000 // submit
  + 3500 + 1800 + 2500 + 700 * 5 + 1500 // results
  + 4000 // final
  + Math.round((PROBLEMATIQUE.length / 80) * 1000)
  + Math.round((I_TITLE.length / 80) * 1000)
  + Math.round((I_A.length / 85) * 1000)
  + Math.round((I_B.length / 85) * 1000)
  + Math.round((II_TITLE.length / 80) * 1000)
  + Math.round((II_A.length / 85) * 1000)
  + Math.round((II_B.length / 85) * 1000)

export function applyPlanType(
  state: PlanDemoState,
  field: PlanDemoField,
  char: string,
): PlanDemoState {
  return {
    ...state,
    submission: { ...state.submission, [field]: state.submission[field] + char },
  }
}
