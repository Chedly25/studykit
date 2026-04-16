/**
 * Data shapes for the CRFPA coaching features (Phase 2+).
 * JSON payloads stored in the `coachingSessions` IndexedDB table
 * use these types via JSON.stringify/parse.
 */

// ─── Syllogisme Coach ─────────────────────────────────────────────

export type SyllogismeDifficulty = 'beginner' | 'intermediate' | 'advanced'

export interface SyllogismeArticleRef {
  articleNum: string      // "1231-1", "L1233-3", "311-4"
  codeName: string        // "Code civil", "Code du travail"
  breadcrumb?: string
  text: string
}

export interface SyllogismeModel {
  majeure: {
    article: string              // "Art. 1231-1 C. civ."
    rule: string                 // 1-sentence statement of the rule
    elements: string[]           // 3-5 constituent elements
  }
  mineure: {
    factMappings: Array<{
      element: string            // matches one of majeure.elements
      fact: string               // concrete fact from the scenario
    }>
  }
  conclusion: {
    answer: string               // 1 sentence
    justification: string        // 1-2 sentences linking mineure + majeure
  }
}

export interface SyllogismeTask {
  theme: string                  // e.g. "Responsabilité contractuelle"
  difficulty: SyllogismeDifficulty
  scenario: string               // 1-2 sentences of facts
  question: string               // the legal question
  sourceArticles: SyllogismeArticleRef[]
  modelSyllogisme: SyllogismeModel   // HIDDEN from student until graded
  generatedAt: string
}

export interface SyllogismeSubmission {
  majeure: string
  mineure: string
  conclusion: string
  submittedAt: string
}

export interface SyllogismeGrading {
  majeure: {
    score: number                // 0-10
    articleCorrect: boolean
    elementsIdentified: Array<{ element: string; found: boolean }>
    feedback: string
  }
  mineure: {
    score: number                // 0-10
    mappings: Array<{ element: string; mapped: boolean; note?: string }>
    feedback: string
  }
  conclusion: {
    score: number                // 0-10
    explicit: boolean
    justified: boolean
    nuanced: boolean
    feedback: string
  }
  overall: {
    score: number                // 0-30
    topMistake: string
    strength: string
  }
  gradedAt: string
}

// ─── Plan Détaillé Coach ──────────────────────────────────────────

export type PlanAxis =
  | 'problematique'
  | 'opposition'
  | 'equilibre'
  | 'chevauchement'
  | 'couverture'
  | 'transitions'

export interface PlanModel {
  problematique: string
  I: { title: string; IA: string; IB: string }
  II: { title: string; IIA: string; IIB: string }
  transitions: { intro_to_I?: string; I_to_II: string }
  anchors: { IA: string; IB: string; IIA: string; IIB: string }
}

export interface PlanTask {
  question: string                // "La force obligatoire du contrat"
  themeLabel: string              // "Droit des contrats"
  sourceArticles: SyllogismeArticleRef[]   // reused type
  modelPlan: PlanModel            // HIDDEN from student until graded
  commonPitfalls: string[]        // 2-3 methodological traps
  generatedAt: string
}

export interface PlanSubmission {
  problematique: string
  I: { title: string; IA: string; IB: string }
  II: { title: string; IIA: string; IIB: string }
  submittedAt: string
}

export interface PlanAxisScore {
  axis: PlanAxis
  label: string           // human-readable, e.g. "Problématique"
  score: number           // 0-5
  feedback: string        // 2-4 sentences, methodological
}

export interface PlanGrading {
  axes: PlanAxisScore[]   // 6 entries, one per PlanAxis
  overall: {
    score: number         // 0-30, sum of 6 axes
    topMistake: string
    strength: string
  }
  gradedAt: string
}

// ─── Fiche d'arrêt Trainer ────────────────────────────────────────

export type FicheAxis =
  | 'faits'
  | 'procedure'
  | 'moyens'
  | 'questionDeDroit'
  | 'solutionEtPortee'

export interface FicheDecision {
  id: string              // Vectorize ID
  chamber: string         // "Chambre sociale", derived from codeName
  reference: string       // ECLI or pourvoi number
  breadcrumb?: string     // often contains the date
  text: string            // decision text (from Vectorize metadata)
}

export interface FicheTask {
  decision: FicheDecision
  generatedAt: string
}

export interface FicheSubmission {
  faits: string
  procedure: string
  moyens: string
  questionDeDroit: string
  solutionEtPortee: string
  submittedAt: string
}

export interface FicheAxisScore {
  axis: FicheAxis
  label: string
  score: number         // 0-5
  feedback: string
}

export interface FicheGrading {
  axes: FicheAxisScore[]  // 5 entries, one per FicheAxis
  overall: {
    score: number         // 0-25
    topMistake: string
    strength: string
  }
  gradedAt: string
}
