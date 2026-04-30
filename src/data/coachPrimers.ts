/**
 * Method primers for each CRFPA coach.
 * Surfaced via the "Méthode" button in each coach page header — answers
 * "what is this exercise, why does it matter, what is the jury looking for?"
 * Written in coach-voice (concrete, French, jury-aware), not encyclopedia-voice.
 */

export type CoachKind =
  | 'syllogisme'
  | 'plan'
  | 'fiche'
  | 'commentaire'
  | 'cas-pratique'
  | 'note-synthese'
  | 'grand-oral'

export interface CoachPrimer {
  title: string
  /** Tight one-liner for headers and previews. */
  hook: string
  /** What the exercise is — 1-2 sentences, definitional. */
  what: string
  /** Why it matters in CRFPA — 1-2 sentences, jury-aware. */
  why: string
  /** What the grader looks for — concrete axes, not generic platitudes. */
  axes: string[]
  /** Indicative duration for one session. */
  duration: string
}

export const COACH_PRIMERS: Record<CoachKind, CoachPrimer> = {
  syllogisme: {
    title: 'Syllogisme',
    hook: 'Le raisonnement juridique en trois temps.',
    what:
      'Majeure (la règle de droit applicable), mineure (sa confrontation aux faits), conclusion (la qualification ou la solution). C\'est la mécanique du raisonnement légal en France.',
    why:
      'L\'écrit du CRFPA évalue avant tout ta capacité à appliquer la règle de droit avec rigueur. Un syllogisme propre vaut plus que dix lignes de commentaire flou.',
    axes: [
      'Identification de la règle de droit (article, jurisprudence)',
      'Qualification précise des faits (sans paraphrase)',
      'Articulation logique majeure → mineure → conclusion',
      'Style juridique : vocabulaire, concision, neutralité',
    ],
    duration: '~25 minutes',
  },
  plan: {
    title: 'Plan détaillé',
    hook: 'L\'épine dorsale d\'une dissertation.',
    what:
      'Une problématique juridique + un plan structuré en deux parties (I/II), chacune avec deux sous-parties (A/B), annoncées dans l\'introduction.',
    why:
      'Le jury décide souvent ta note dès la première page, par la qualité de la problématique et l\'équilibre du plan. Un bon plan annonce la solution en filigrane.',
    axes: [
      'Pertinence et originalité (mesurée) de la problématique',
      'Équilibre I/II — chaque partie traite un volet réel du sujet',
      'Logique des sous-parties A/B au sein de chaque partie',
      'Qualité de l\'annonce du plan dans l\'introduction',
      'Vocabulaire juridique précis dans les intitulés',
      'Cohérence d\'ensemble (pas de hors-sujet, pas de redites)',
    ],
    duration: '~30 minutes',
  },
  fiche: {
    title: 'Fiche d\'arrêt',
    hook: 'Lire une décision avec précision.',
    what:
      'La synthèse structurée d\'une décision de justice : faits, procédure, prétentions, problème de droit, solution, portée. Pas de commentaire — la décision lue exactement.',
    why:
      'Avant de commenter, il faut savoir lire. La fiche d\'arrêt prouve que tu as compris ce que la Cour a dit, et rien de plus.',
    axes: [
      'Identification des faits juridiquement pertinents (tri du factuel)',
      'Procédure : qui demande quoi, devant quelle juridiction',
      'Reformulation rigoureuse du problème de droit',
      'Solution exacte (sans glose ni interprétation)',
      'Portée : revirement, confirmation, arrêt isolé, principe',
    ],
    duration: '~30 minutes',
  },
  commentaire: {
    title: 'Commentaire d\'arrêt',
    hook: 'Lire et argumenter sur une décision.',
    what:
      'Analyse approfondie d\'une décision : introduction complète (accroche, faits, procédure, problème, solution, annonce) puis plan critique en deux parties.',
    why:
      'L\'exercice qui combine lecture précise et raisonnement original. Le commentaire montre que tu sais lire ET argumenter, sans extrapoler.',
    axes: [
      'Qualité de l\'introduction (six étapes attendues, dans l\'ordre)',
      'Pertinence de la problématique posée',
      'Plan critique — pas un résumé déguisé',
      'Citations précises de la décision et des textes',
      'Vocabulaire et style juridique soutenu',
    ],
    duration: '~45 minutes',
  },
  'cas-pratique': {
    title: 'Cas pratique',
    hook: 'La consultation juridique du métier.',
    what:
      'Un client expose une situation. Tu la traites suivant le plan classique : qualification des faits → règle de droit applicable → application aux faits → solution argumentée. Format dominant de l\'écrit CRFPA.',
    why:
      'L\'exercice le plus proche du métier d\'avocat. Le jury veut voir si tu sais identifier les vrais problèmes juridiques d\'un cas, pas seulement réciter le cours.',
    axes: [
      'Qualification juridique précise des faits du cas',
      'Identification de toutes les règles de droit pertinentes',
      'Application rigoureuse au cas (pas de généralités)',
      'Solution argumentée et hiérarchisée (principal/subsidiaire)',
      'Maîtrise de la complexité (plusieurs problèmes, plusieurs parties)',
      'Style et structure professionnels',
    ],
    duration: '~3 heures',
  },
  'note-synthese': {
    title: 'Note de synthèse',
    hook: 'Synthétiser un dossier en quatre pages.',
    what:
      'Quatre pages de synthèse à partir d\'un dossier de documents (jurisprudence, doctrine, presse, textes). Pas de commentaire personnel — uniquement les idées des documents, organisées.',
    why:
      'L\'épreuve qui teste ta capacité à dégager rapidement la structure d\'un sujet. Indispensable au métier : tu liras des dossiers tous les jours.',
    axes: [
      'Compréhension globale du dossier (rien d\'oublié, rien d\'inventé)',
      'Plan rigoureux (I/II, A/B) — visible dès la première lecture',
      'Synthèse fidèle (reformulation, sans interprétation personnelle)',
      'Citations et références correctes des documents',
      'Concision : quatre pages, pas une de plus',
    ],
    duration: '~3 heures',
  },
  'grand-oral': {
    title: 'Grand Oral',
    hook: 'Structurer sa pensée à voix haute.',
    what:
      'Quinze minutes d\'exposé sur un sujet tiré au sort (droit, libertés fondamentales, parfois actualité), suivies de trente minutes de questions du jury.',
    why:
      'L\'épreuve la plus redoutée. Elle teste ta capacité à structurer une pensée à l\'oral, à tenir face aux relances du jury, et à rester courtois sous pression.',
    axes: [
      'Structure claire de l\'exposé (problématique + plan annoncé)',
      'Maîtrise du fond — citations, dates, principes',
      'Diction, posture, gestion du temps (15 min strict)',
      'Réponses aux questions (sans bluff, sans céder)',
    ],
    duration: '15 min exposé + 30 min questions',
  },
}
