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

// ─── Commentaire d'arrêt Coach ───────────────────────────────────

export type CommentaireAxis =
  | 'accroche'
  | 'interet'
  | 'problematique'
  | 'plan'
  | 'articulation'

export interface CommentaireTask {
  decision: FicheDecision           // reuses the same decision shape
  generatedAt: string
}

export interface CommentaireSubmission {
  introduction: string              // accroche + présentation + intérêt + problématique + annonce
  I: { title: string; IA: string; IB: string }
  II: { title: string; IIA: string; IIB: string }
  submittedAt: string
}

export interface CommentaireAxisScore {
  axis: CommentaireAxis
  label: string
  score: number                     // 0-5
  feedback: string
}

export interface CommentaireGrading {
  axes: CommentaireAxisScore[]      // 5 entries
  overall: {
    score: number                   // 0-25
    topMistake: string
    strength: string
  }
  gradedAt: string
}

// ─── Note de synthèse Coach ──────────────────────────────────────

export interface NoteSyntheseDossierDocument {
  docNumber: number
  type: string                     // 'legislation' | 'jurisprudence-cass' | etc.
  title: string
  sourceUrl: string
  content: string                  // curated excerpt (600-1200 words)
}

export interface NoteSyntheseRubricCriterion {
  criterion: string
  points: number
  details?: string
}

export interface NoteSyntheseTask {
  dossierTitle: string
  problematique: string
  planSuggere: { I: string; IA: string; IB: string; II: string; IIA: string; IIB: string }
  documents: NoteSyntheseDossierDocument[]
  modelSynthesis: string
  rubric: {
    criteria: NoteSyntheseRubricCriterion[]
    totalPoints: number
    documentCoverageMap: Record<string, string>
  }
  generatedAt: string
  practiceExamSessionId: string
}

export interface NoteSyntheseSubmission {
  text: string
  submittedAt: string
}

export type NoteSyntheseAxis =
  | 'documents'
  | 'plan'
  | 'problematique'
  | 'qualite'
  | 'neutralite'
  | 'longueur'
  | 'redaction'
  | 'equilibre'

export interface NoteSyntheseAxisScore {
  axis: NoteSyntheseAxis
  label: string
  score: number
  max: number
  feedback: string
}

export interface NoteSyntheseGrading {
  axes: NoteSyntheseAxisScore[]     // 8 entries
  overall: {
    score: number                   // 0-20
    topMistake: string
    strength: string
  }
  documentsCited: number[]
  documentsMissed: number[]
  gradedAt: string
}

// ─── Grand Oral Coach (voice simulator) ──────────────────────────

import type { GrandOralSujet, ResolvedRef, GrandOralSujetType } from '../prompts/grandOralPrompts'

/**
 * Task for one Grand Oral session. Produced by grounding a seed sujet through RAG:
 * refs are resolved from Vectorize (or inline preResolved text), then Claude
 * composes the expected plan + key points + subsidiary questions.
 */
export interface GrandOralTask {
  sujet: GrandOralSujet
  resolvedRefs: ResolvedRef[]
  problematique: string
  expectedPlan: { I: string; IA: string; IB: string; II: string; IIA: string; IIB: string }
  keyPoints: Array<{ point: string; refIndex: number }>
  subsidiaryQuestions: Array<{ question: string; refIndex: number }>
  generatedAt: string
}

/**
 * Student's completed session. Transcript is the concatenated student+jury
 * turns from the WebRTC session. Metrics help grade forme/posture/réactivité.
 */
export interface GrandOralSubmission {
  fullTranscript: string        // chronological student+jury turns
  exposeTranscript: string      // student's opening 15 min only
  durationSec: number
  exposeDurationSec: number
  interruptionCount: number     // how many times jury interrupted student
  avgLatencySec: number         // avg student response delay after jury question
  juryQuestions: string[]       // questions the jury asked during Q&A
  submittedAt: string
}

export type GrandOralAxis = 'fondJuridique' | 'forme' | 'reactivite' | 'posture'

export interface GrandOralAxisScore {
  score: number        // 0-20
  feedback: string
}

export interface GrandOralGrading {
  axes: Record<GrandOralAxis, GrandOralAxisScore>
  overall: {
    score: number                       // moyenne 4 axes, 0-20, to 0.5
    admis: boolean                      // score >= 10
    topMistake: string
    topStrength: string
    inventedReferences: string[]        // refs cited but absent from resolvedRefs
  }
  gradedAt: string
}

/** Args emitted by the realtime agent when calling get_next_jury_question. */
export interface JuryQuestionToolArgs {
  exposeTranscript: string
  qaSoFar: string
  alreadyAsked: string[]
  difficulty: 'facile' | 'moyen' | 'difficile'
}

/** Result returned to the realtime agent. */
export interface JuryQuestionToolResult {
  question: string
  targetGap: string
  refIndex: number | null
  followUpHint: string
}
