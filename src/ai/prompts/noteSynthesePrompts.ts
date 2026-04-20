/**
 * Grading prompt for the Note de synthèse coaching surface.
 * Ported from syntheseGrading.ts and adapted for synchronous coachingCallJson usage.
 */
import type { NoteSyntheseTask, NoteSyntheseSubmission } from '../coaching/types'

export interface NoteSyntheseGradingConfig {
  task: NoteSyntheseTask
  submission: NoteSyntheseSubmission
}

export function buildNoteSyntheseGradingPrompt(config: NoteSyntheseGradingConfig): {
  system: string
  user: string
} {
  const { task, submission } = config

  const system = `Tu es un correcteur agrégé de l'épreuve de note de synthèse CRFPA. Tu corriges la copie d'un candidat avec rigueur et bienveillance.

Ton rôle est PÉDAGOGIQUE : tu expliques POURQUOI chaque aspect est maîtrisé ou insuffisant au regard de la méthodologie de la note de synthèse. Tu ne rédiges JAMAIS à la place du candidat : tu pointes les faiblesses et donnes UNE suggestion méthodologique concrète par axe.

Règles absolues :
1. Français juridique soutenu. Aucun emoji.
2. Tu te fondes sur le dossier documentaire fourni et la synthèse modèle.
3. Chaque axe est noté selon son barème propre. Total global sur 20.
4. Le feedback de chaque axe comporte 2 à 4 phrases : ce qui va, ce qui manque, et une suggestion concrète.
5. Si une section est vide ou absente, tu la notes 0.
6. Une note de synthèse est une RESTITUTION NEUTRE du dossier. Le candidat montre qu'il a LU et COMPRIS tous les documents, pas qu'il sait raisonner en droit.
7. Vérifie systématiquement quels documents sont cités avec "(Doc. N)" et lesquels manquent.
8. Tu renvoies UNIQUEMENT du JSON valide.`

  const docList = task.documents
    .map(d => `Doc ${d.docNumber}: ${d.title} (${d.type})`)
    .join('\n')

  const modelExcerpt = task.modelSynthesis.slice(0, 2000)

  const user = `## BARÈME (fixe, 20 points)

- Citation de tous les documents (4 pts) — chaque document doit être cité au moins une fois avec "(Doc. N)"
- Plan structuré (I/A, I/B, II/A, II/B) (3 pts) — plan binaire, équilibré, cohérent
- Problématique pertinente (2 pts) — découle du dossier, juridique, interrogative
- Qualité de la synthèse (4 pts) — restitution neutre et fidèle, pas de dissertation
- Neutralité (2 pts) — absence d'avis personnel, pas de "il convient de" / "force est de constater"
- Respect de la limite de 4 pages (1 pt) — environ 2400 mots
- Qualité rédactionnelle (2 pts) — français juridique correct, transitions
- Équilibre entre les parties (2 pts) — I et II de longueur comparable

## DOCUMENTS DU DOSSIER (${task.documents.length} documents)
${docList}

## SYNTHÈSE MODÈLE (pour référence)
${modelExcerpt}

## COPIE DU CANDIDAT
${submission.text}

## CONSIGNE
Corrige selon le barème. Retourne UNIQUEMENT le JSON :
{
  "axes": [
    { "axis": "documents", "label": "Citation de tous les documents", "score": 0, "max": 4, "feedback": "..." },
    { "axis": "plan", "label": "Plan structuré", "score": 0, "max": 3, "feedback": "..." },
    { "axis": "problematique", "label": "Problématique pertinente", "score": 0, "max": 2, "feedback": "..." },
    { "axis": "qualite", "label": "Qualité de la synthèse", "score": 0, "max": 4, "feedback": "..." },
    { "axis": "neutralite", "label": "Neutralité", "score": 0, "max": 2, "feedback": "..." },
    { "axis": "longueur", "label": "Respect de la limite", "score": 0, "max": 1, "feedback": "..." },
    { "axis": "redaction", "label": "Qualité rédactionnelle", "score": 0, "max": 2, "feedback": "..." },
    { "axis": "equilibre", "label": "Équilibre entre les parties", "score": 0, "max": 2, "feedback": "..." }
  ],
  "overall": { "score": 0, "topMistake": "...", "strength": "..." },
  "documentsCited": [1, 3, 5],
  "documentsMissed": [2, 4, 6]
}`

  return { system, user }
}
