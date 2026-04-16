/**
 * Prompts for the CRFPA Fiche d'arrêt Trainer.
 * Only ONE builder is needed: the grading prompt. The decision is real
 * (pulled from the Judilibre corpus in Vectorize), no generation LLM call.
 *
 * Validated against a realistic test decision + weak/strong submissions
 * before coding.
 */

import type { FicheTask, FicheSubmission } from '../coaching/types'

// ─── Chamber options ──────────────────────────────────────────────

export interface FicheChamber {
  id: string
  label: string
  codeName: string   // Vectorize metadata filter value
}

export const FICHE_CHAMBERS: FicheChamber[] = [
  { id: 'civ1', label: 'Chambre civile 1', codeName: 'Jurisprudence — Chambre civile 1' },
  { id: 'civ2', label: 'Chambre civile 2', codeName: 'Jurisprudence — Chambre civile 2' },
  { id: 'civ3', label: 'Chambre civile 3', codeName: 'Jurisprudence — Chambre civile 3' },
  { id: 'soc', label: 'Chambre sociale', codeName: 'Jurisprudence — Chambre sociale' },
  { id: 'com', label: 'Chambre commerciale', codeName: 'Jurisprudence — Chambre commerciale' },
  { id: 'crim', label: 'Chambre criminelle', codeName: 'Jurisprudence — Chambre criminelle' },
  { id: 'plen', label: 'Assemblée plénière', codeName: 'Jurisprudence — Assemblée plénière' },
]

// ─── Grading prompt ──────────────────────────────────────────────

export interface FicheGradingConfig {
  task: FicheTask
  submission: FicheSubmission
}

function fieldOrEmpty(s: string): string {
  return s.trim() ? s : '(vide)'
}

export function buildFicheArretGradingPrompt(
  config: FicheGradingConfig,
): { system: string; user: string } {
  const system = `Tu es un membre de la commission d'examen du CRFPA. Tu corriges la fiche d'arrêt rédigée par un candidat sur une décision de la Cour de cassation.

Ton rôle est PÉDAGOGIQUE, pas seulement évaluatif. Tu expliques POURQUOI chaque partie est maîtrisée ou insuffisante au regard des exigences méthodologiques de la fiche d'arrêt. Tu n'écris JAMAIS à la place du candidat : tu pointes les défauts, tu ne réécris pas.

Règles absolues :
1. Français juridique soutenu. Aucun emoji, aucune formule familière.
2. La décision de référence t'est fournie in extenso. Tu te fondes sur son contenu pour évaluer la fiche.
3. Chaque critère est noté sur 5. Total global sur 25.
4. Le feedback de chaque partie comporte 2 à 4 phrases : ce qui va, ce qui manque, et UNE suggestion méthodologique concrète.
5. Si une section est vide, tu la notes 0 avec une note invitant à la reprendre.
6. Tu renvoies UNIQUEMENT du JSON valide.`

  const { task, submission } = config
  const d = task.decision
  const dateLine = d.breadcrumb ? `Date / référence : ${d.breadcrumb}` : ''
  const user = `Corrige la fiche d'arrêt d'un candidat CRFPA.

ARRÊT DE RÉFÉRENCE :
Chambre : ${d.chamber}
${dateLine}
Référence : ${d.reference}

Texte intégral :
${d.text}

FICHE DU CANDIDAT :
--- Faits ---
${fieldOrEmpty(submission.faits)}
--- Procédure ---
${fieldOrEmpty(submission.procedure)}
--- Moyens du pourvoi ---
${fieldOrEmpty(submission.moyens)}
--- Question de droit ---
${fieldOrEmpty(submission.questionDeDroit)}
--- Solution et portée ---
${fieldOrEmpty(submission.solutionEtPortee)}

GRILLE (5 critères, chacun noté sur 5) :
1. faits : seuls les faits matériels sont retenus (pas la procédure, pas le droit), présentés chronologiquement, reformulés et non recopiés.
2. procedure : le parcours procédural (1ère instance → appel → cassation) est clair, concis, sans faits mêlés.
3. moyens : les moyens du pourvoi sont reformulés clairement, non recopiés littéralement, avec indication de la partie qui les soulève.
4. questionDeDroit : la question est abstraite, formulée de façon interrogative, dépouillée des circonstances particulières, vise la règle de droit.
5. solutionEtPortee : la solution résume le dispositif (cassation/rejet + fondement) ET identifie la portée (arrêt de principe, confirmation, innovation, revirement).

Pour CHAQUE critère : score 0-5, label français court, feedback 2-4 phrases.
Global : score = somme des 5 critères (sur 25), topMistake (1 phrase), strength (1 phrase).

Réponds en JSON strict (aucun texte hors JSON) :

{
  "axes": [
    { "axis": "faits", "label": "Faits", "score": 0, "feedback": "..." },
    { "axis": "procedure", "label": "Procédure", "score": 0, "feedback": "..." },
    { "axis": "moyens", "label": "Moyens du pourvoi", "score": 0, "feedback": "..." },
    { "axis": "questionDeDroit", "label": "Question de droit", "score": 0, "feedback": "..." },
    { "axis": "solutionEtPortee", "label": "Solution et portée", "score": 0, "feedback": "..." }
  ],
  "overall": { "score": 0, "topMistake": "...", "strength": "..." }
}`

  return { system, user }
}
