/**
 * Fiche d'arrêt demo script — drives the FeatureDemoPlayer through a full
 * fiche on the Boot Shop case. Reuses Phase 3 example data so the demo's
 * journey lands on the same artifact users can re-open as a static example.
 */

import type { GenericDemoStep } from '../../components/legal/demo/types'
import type {
  FicheDemoState,
  FicheDemoField,
} from '../../components/legal/demo/FicheDemoBody'
import { COACH_EXAMPLES } from '../coachExamples'

const example = COACH_EXAMPLES.fiche!

function extractSection(md: string, heading: string): string {
  const re = new RegExp(`## ${heading}\\s*\\n+([\\s\\S]*?)(?=\\n## |$)`)
  return md.match(re)?.[1].trim() ?? ''
}

const FAITS_TEXT = extractSection(example.submission, 'Faits')
const PROCEDURE_TEXT = extractSection(example.submission, 'Procédure')
const MOYENS_TEXT = extractSection(example.submission, 'Moyens du pourvoi')
const QUESTION_TEXT = extractSection(example.submission, 'Question de droit')
const SOLUTION_TEXT = extractSection(example.submission, 'Solution et portée')

const SCENARIO_TEXT =
  `Cass. ass. plén., 6 octobre 2006, n° 05-13.255 — « Boot Shop »

Tu as devant toi cet arrêt fondateur sur l'opposabilité du manquement contractuel aux tiers. Lis-le avec attention : faits, procédure, moyens, problème de droit, solution. Puis structure-le en cinq sections.`

export const FICHE_DEMO_INITIAL: FicheDemoState = {
  view: 'picker',
  picker: { chamberLabel: '', decisionLabel: '' },
  scenario: { contextMd: SCENARIO_TEXT },
  submission: {
    faits: '',
    procedure: '',
    moyens: '',
    questionDeDroit: '',
    solutionEtPortee: '',
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

export const FICHE_DEMO_FINAL: FicheDemoState = {
  ...FICHE_DEMO_INITIAL,
  view: 'results',
  picker: { chamberLabel: 'Assemblée plénière', decisionLabel: '6 octobre 2006 — Boot Shop' },
  submission: {
    faits: FAITS_TEXT,
    procedure: PROCEDURE_TEXT,
    moyens: MOYENS_TEXT,
    questionDeDroit: QUESTION_TEXT,
    solutionEtPortee: SOLUTION_TEXT,
  },
  overallVisible: true,
  revealedAxesCount: FICHE_DEMO_INITIAL.grading.axes.length,
}

type Step = GenericDemoStep<FicheDemoState, FicheDemoField>

export const FICHE_DEMO_STEPS: Step[] = [
  { kind: 'narrate', text: 'Voyons comment construire une fiche d\'arrêt, en moins d\'une minute.', ms: 3000 },

  // Picker
  { kind: 'narrate', text: 'D\'abord, tu choisis une chambre et une décision réelle.', ms: 1800 },
  { kind: 'set', update: s => ({ ...s, picker: { ...s.picker, chamberLabel: 'Assemblée plénière' } }), dwellMs: 700 },
  { kind: 'set', update: s => ({ ...s, picker: { ...s.picker, decisionLabel: '6 octobre 2006 — Boot Shop' } }), dwellMs: 1200 },

  // Loading
  { kind: 'narrate', text: 'L\'IA prépare la décision et son contexte.', ms: 2200 },
  { kind: 'set', update: s => ({ ...s, view: 'scenario-loading' }), dwellMs: 1800 },

  // Editor
  { kind: 'narrate', text: 'Voici l\'arrêt. Tu construis ta fiche en cinq sections.', ms: 2500 },
  { kind: 'set', update: s => ({ ...s, view: 'editor' }), dwellMs: 1500 },

  // Faits
  { kind: 'narrate', text: 'Étape 1 — les faits matériels, présentés chronologiquement.', ms: 2200 },
  { kind: 'set', update: s => ({ ...s, focus: 'faits' }) },
  { kind: 'type', field: 'faits', text: FAITS_TEXT, charsPerSec: 90 },

  // Procédure
  { kind: 'narrate', text: 'Étape 2 — la procédure, sans faits mêlés.', ms: 2000 },
  { kind: 'set', update: s => ({ ...s, focus: 'procedure' }) },
  { kind: 'type', field: 'procedure', text: PROCEDURE_TEXT, charsPerSec: 90 },

  // Moyens
  { kind: 'narrate', text: 'Étape 3 — les moyens du pourvoi, reformulés.', ms: 2000 },
  { kind: 'set', update: s => ({ ...s, focus: 'moyens' }) },
  { kind: 'type', field: 'moyens', text: MOYENS_TEXT, charsPerSec: 90 },

  // Question
  { kind: 'narrate', text: 'Étape 4 — la question de droit, abstraite et interrogative.', ms: 2000 },
  { kind: 'set', update: s => ({ ...s, focus: 'questionDeDroit' }) },
  { kind: 'type', field: 'questionDeDroit', text: QUESTION_TEXT, charsPerSec: 90 },

  // Solution
  { kind: 'narrate', text: 'Étape 5 — la solution exacte et la portée jurisprudentielle.', ms: 2200 },
  { kind: 'set', update: s => ({ ...s, focus: 'solutionEtPortee' }) },
  { kind: 'type', field: 'solutionEtPortee', text: SOLUTION_TEXT, charsPerSec: 90 },

  // Submit
  { kind: 'set', update: s => ({ ...s, focus: undefined }), dwellMs: 600 },
  { kind: 'narrate', text: 'Tu soumets ta fiche.', ms: 1500 },
  { kind: 'set', update: s => ({ ...s, submitPressed: true }), dwellMs: 220 },
  { kind: 'set', update: s => ({ ...s, submitPressed: false, view: 'grading-loading' }), dwellMs: 2000 },

  // Results
  { kind: 'narrate', text: 'L\'IA évalue cinq critères de la méthodologie de la fiche.', ms: 2500 },
  { kind: 'set', update: s => ({ ...s, view: 'results', overallVisible: true }), dwellMs: 1800 },
  { kind: 'narrate', text: 'Pour chaque critère, un score sur 5 et un commentaire ciblé.', ms: 2500 },
  { kind: 'set', update: s => ({ ...s, revealedAxesCount: 1 }), dwellMs: 900 },
  { kind: 'set', update: s => ({ ...s, revealedAxesCount: 2 }), dwellMs: 900 },
  { kind: 'set', update: s => ({ ...s, revealedAxesCount: 3 }), dwellMs: 900 },
  { kind: 'set', update: s => ({ ...s, revealedAxesCount: 4 }), dwellMs: 900 },
  { kind: 'set', update: s => ({ ...s, revealedAxesCount: 5 }), dwellMs: 1500 },

  { kind: 'narrate', text: 'À toi maintenant : choisis une chambre et lance ta première fiche.', ms: 4000 },
]

export const FICHE_DEMO_DURATION_MS =
  3000 + 1800 + 700 + 1200
  + 2200 + 1800
  + 2500 + 1500
  + 2200 + 2000 + 2000 + 2000 + 2200 // section narrates
  + 600 + 1500 + 220 + 2000 // submit
  + 2500 + 1800 + 2500 + 900 + 900 + 900 + 900 + 1500 // results
  + 4000 // final
  + Math.round((FAITS_TEXT.length / 90) * 1000)
  + Math.round((PROCEDURE_TEXT.length / 90) * 1000)
  + Math.round((MOYENS_TEXT.length / 90) * 1000)
  + Math.round((QUESTION_TEXT.length / 90) * 1000)
  + Math.round((SOLUTION_TEXT.length / 90) * 1000)

export function applyFicheType(
  state: FicheDemoState,
  field: FicheDemoField,
  char: string,
): FicheDemoState {
  return {
    ...state,
    submission: { ...state.submission, [field]: state.submission[field] + char },
  }
}
