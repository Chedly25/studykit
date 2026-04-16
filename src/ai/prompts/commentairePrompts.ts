/**
 * Prompts for the CRFPA Commentaire d'arrêt coach.
 * Student writes only the introduction + plan détaillé (I/IA/IB/II/IIA/IIB).
 * Developed paragraphs are writing-practice, not methodology — out of scope.
 */

import type { CommentaireTask, CommentaireSubmission } from '../coaching/types'

export interface CommentaireGradingConfig {
  task: CommentaireTask
  submission: CommentaireSubmission
}

function fieldOrEmpty(s: string): string {
  return s.trim() ? s : '(vide)'
}

export function buildCommentaireGradingPrompt(
  config: CommentaireGradingConfig,
): { system: string; user: string } {
  const system = `Tu es un membre de la commission d'examen du CRFPA. Tu corriges le début d'un commentaire d'arrêt rédigé par un candidat (introduction + plan détaillé).

Ton rôle est PÉDAGOGIQUE, pas seulement évaluatif. Tu expliques POURQUOI chaque partie est maîtrisée ou insuffisante au regard de la méthodologie du commentaire d'arrêt. Tu n'écris JAMAIS à la place du candidat : tu pointes les faiblesses.

Règles absolues :
1. Français juridique soutenu. Aucun emoji.
2. Tu te fondes sur la décision fournie in extenso.
3. Chaque critère est noté sur 5. Total global sur 25.
4. Le feedback de chaque partie comporte 2 à 4 phrases : ce qui va, ce qui manque, et UNE suggestion méthodologique concrète.
5. Si une section est vide, tu la notes 0 avec une note invitant à la reprendre.
6. Un plan de commentaire DIFFÈRE d'un plan de dissertation : ses intitulés doivent évoquer la solution, la portée, les motifs de l'arrêt, non rester abstraits.
7. Tu renvoies UNIQUEMENT du JSON valide.`

  const { task, submission } = config
  const d = task.decision
  const dateLine = d.breadcrumb ? `Date / référence : ${d.breadcrumb}` : ''
  const user = `Corrige l'introduction et le plan d'un commentaire d'arrêt.

ARRÊT :
Chambre : ${d.chamber}
${dateLine}
Référence : ${d.reference}

Texte intégral :
${d.text}

COPIE DU CANDIDAT :
--- Introduction (accroche + présentation + intérêt + problématique + annonce) ---
${fieldOrEmpty(submission.introduction)}

Plan :
I. ${fieldOrEmpty(submission.I.title)}
   A. ${fieldOrEmpty(submission.I.IA)}
   B. ${fieldOrEmpty(submission.I.IB)}
II. ${fieldOrEmpty(submission.II.title)}
   A. ${fieldOrEmpty(submission.II.IIA)}
   B. ${fieldOrEmpty(submission.II.IIB)}

GRILLE (5 axes, chacun noté sur 5) :
1. accroche : présentation concise de l'arrêt (juridiction, date, parties, faits essentiels), accroche juridique pertinente (citation, formule doctrinale, question d'actualité juridique).
2. interet : enjeu identifié — arrêt d'innovation, de confirmation, de revirement ? articulation avec la jurisprudence antérieure et les textes en vigueur (réformes récentes notamment) ?
3. problematique : capte la tension DE CET ARRÊT, formulation juridique et interrogative, non une question abstraite générale.
4. plan : binaire, équilibré, non-chevauchant, ANCRÉ DANS L'ARRÊT — les intitulés évoquent la solution/portée/motifs, pas des étiquettes neutres.
5. articulation : annonce de plan claire en fin d'intro, logique I→II perceptible à la lecture des titres.

Pour CHAQUE axe : score 0-5, label français court, feedback 2-4 phrases.
Global : score = somme des 5 axes (sur 25), topMistake (1 phrase), strength (1 phrase).

Réponds en JSON strict (aucun texte hors JSON) :

{
  "axes": [
    { "axis": "accroche", "label": "Accroche et présentation", "score": 0, "feedback": "..." },
    { "axis": "interet", "label": "Intérêt et enjeu", "score": 0, "feedback": "..." },
    { "axis": "problematique", "label": "Problématique", "score": 0, "feedback": "..." },
    { "axis": "plan", "label": "Plan ancré dans l'arrêt", "score": 0, "feedback": "..." },
    { "axis": "articulation", "label": "Articulation et annonce", "score": 0, "feedback": "..." }
  ],
  "overall": { "score": 0, "topMistake": "...", "strength": "..." }
}`

  return { system, user }
}
