/**
 * Prompts for the CRFPA Syllogisme Coach.
 * Two builders:
 *  - buildSyllogismeScenarioPrompt: generate a mini-scenario + hidden model syllogisme
 *  - buildSyllogismeGradingPrompt: grade the student's 3 parts against the model
 *
 * Both return `{ system, user }` strings, in French, producing strict JSON.
 * Validated against 3 test scenarios before the rest of the pipeline was built.
 */

import type {
  SyllogismeArticleRef,
  SyllogismeDifficulty,
  SyllogismeTask,
  SyllogismeSubmission,
} from '../coaching/types'

// ─── Themes ──────────────────────────────────────────────────────

export interface SyllogismeTheme {
  id: string
  label: string
  domain: 'civil' | 'social' | 'penal' | 'administratif' | 'commercial'
  searchSeeds: string[]  // passed to searchLegalCodes
}

export const SYLLOGISME_THEMES: SyllogismeTheme[] = [
  {
    id: 'responsabilite-contractuelle',
    label: 'Responsabilité contractuelle',
    domain: 'civil',
    searchSeeds: ['responsabilité contractuelle inexécution 1231-1', 'dommages intérêts contrat'],
  },
  {
    id: 'responsabilite-delictuelle',
    label: 'Responsabilité délictuelle',
    domain: 'civil',
    searchSeeds: ['responsabilité délictuelle faute 1240', 'réparation préjudice causé à autrui'],
  },
  {
    id: 'formation-contrat',
    label: 'Formation du contrat',
    domain: 'civil',
    searchSeeds: ['conditions validité contrat 1128', 'consentement capacité objet licite'],
  },
  {
    id: 'vices-consentement',
    label: 'Vices du consentement',
    domain: 'civil',
    searchSeeds: ['vices du consentement erreur dol violence 1130'],
  },
  {
    id: 'licenciement-economique',
    label: 'Licenciement pour motif économique',
    domain: 'social',
    searchSeeds: ['licenciement motif économique L1233-3', 'réorganisation compétitivité'],
  },
  {
    id: 'licenciement-personnel',
    label: 'Licenciement pour motif personnel',
    domain: 'social',
    searchSeeds: ['cause réelle sérieuse L1232-1', 'licenciement faute grave'],
  },
  {
    id: 'garde-a-vue',
    label: 'Garde à vue',
    domain: 'penal',
    searchSeeds: ['garde à vue droits 62-2 code procédure pénale', 'notification des droits'],
  },
  {
    id: 'vol-aggrave',
    label: 'Vol et circonstances aggravantes',
    domain: 'penal',
    searchSeeds: ['vol soustraction frauduleuse 311-1', 'vol aggravé 311-4 réunion'],
  },
  {
    id: 'violences-volontaires',
    label: 'Violences volontaires',
    domain: 'penal',
    searchSeeds: ['violences volontaires 222-11 222-13', 'incapacité totale de travail ITT'],
  },
  {
    id: 'responsabilite-administrative',
    label: 'Responsabilité administrative',
    domain: 'administratif',
    searchSeeds: ['responsabilité administrative faute service', 'arrêt Blanco'],
  },
  {
    id: 'bail-habitation',
    label: 'Bail d\'habitation',
    domain: 'civil',
    searchSeeds: ['bail habitation trouble jouissance', 'logement décent obligations bailleur'],
  },
  {
    id: 'refere',
    label: 'Procédure de référé',
    domain: 'civil',
    searchSeeds: ['référé provision urgence contestation sérieuse 835', 'référé article 809'],
  },
]

// ─── Scenario generation prompt ──────────────────────────────────

export interface SyllogismeScenarioConfig {
  theme: string
  difficulty: SyllogismeDifficulty
  articles: SyllogismeArticleRef[]   // pre-fetched via searchLegalCodes
  avoidScenarios?: string[]          // first ~80 chars of past scenarios
}

const DIFFICULTY_HINTS: Record<SyllogismeDifficulty, string> = {
  beginner: 'beginner : 1 article, qualification claire, 3 éléments à identifier.',
  intermediate: 'intermediate : 1 à 2 articles, un faux-ami factuel à écarter, 3-4 éléments.',
  advanced: 'advanced : qualification ambiguë, faits discutables, 4-5 éléments.',
}

function formatArticlesBlock(articles: SyllogismeArticleRef[]): string {
  if (articles.length === 0) {
    return '(aucun article fourni — choisis le thème le plus proche de ta connaissance du droit français)'
  }
  return articles
    .map((a, i) => {
      const loc = a.breadcrumb ? ` (${a.breadcrumb})` : ''
      return `${i + 1}. Art. ${a.articleNum} — ${a.codeName}${loc}\n   ${a.text}`
    })
    .join('\n\n')
}

export function buildSyllogismeScenarioPrompt(
  config: SyllogismeScenarioConfig,
): { system: string; user: string } {
  const system = `Tu es un membre de la commission d'examen du CRFPA. Tu conçois des cas pratiques courts destinés à entraîner un candidat au raisonnement juridique par syllogisme (majeure / mineure / conclusion).

Règles absolues :
1. Rédaction en français juridique soutenu. Aucun emoji, aucune formule familière, aucune marque typographique décorative.
2. Tu t'ancres EXCLUSIVEMENT dans les articles fournis dans le prompt utilisateur. Tu n'inventes AUCUNE référence. Si aucun article fourni ne s'adapte parfaitement, tu choisis celui qui s'en rapproche le plus et tu construis autour.
3. Le scénario doit être réaliste, cohérent avec la pratique française, et traitable en 15 minutes par un candidat.
4. Tu produis TOUJOURS une réponse modèle structurée en syllogisme. Cette réponse servira à corriger l'étudiant : elle doit être aussi rigoureuse que si elle devait être notée. Elle ne sera jamais montrée à l'étudiant avant sa correction.
5. Tu renvoies UNIQUEMENT du JSON valide. Pas de texte avant ou après, pas de balise Markdown.`

  const avoidClause = config.avoidScenarios && config.avoidScenarios.length > 0
    ? `\nÉvite les scénarios suivants, déjà utilisés récemment :\n${config.avoidScenarios.map(s => `- ${s}`).join('\n')}\n`
    : ''

  const user = `Conçois un cas pratique au format syllogisme.

Thème : ${config.theme}
Niveau : ${DIFFICULTY_HINTS[config.difficulty]}

Articles de référence (choisis celui qui s'adapte le mieux) :
${formatArticlesBlock(config.articles)}
${avoidClause}
Contraintes :
- scenario : 1 à 2 phrases de faits. Personnages nommés, une date. PAS de question dans le scénario.
- question : une phrase interrogative, portant sur une qualification ou un régime juridique.
- modelSyllogisme.majeure.article : référence exacte (ex. "Art. 1231-1 C. civ.").
- modelSyllogisme.majeure.rule : 1 phrase énonçant la règle.
- modelSyllogisme.majeure.elements : 3 à 5 éléments constitutifs.
- modelSyllogisme.mineure.factMappings : pour CHAQUE élément, le fait précis du scénario qui le satisfait.
- modelSyllogisme.conclusion.answer : 1 phrase.
- modelSyllogisme.conclusion.justification : 1 à 2 phrases reliant mineure et majeure.

Réponds en JSON strict (pas de texte hors JSON) :

{
  "scenario": "...",
  "question": "...",
  "modelSyllogisme": {
    "majeure": {
      "article": "Art. ... C. ...",
      "rule": "...",
      "elements": ["...", "..."]
    },
    "mineure": {
      "factMappings": [
        { "element": "...", "fact": "..." }
      ]
    },
    "conclusion": {
      "answer": "...",
      "justification": "..."
    }
  }
}`

  return { system, user }
}

// ─── Grading prompt ──────────────────────────────────────────────

export interface SyllogismeGradingConfig {
  task: SyllogismeTask
  submission: SyllogismeSubmission
}

function formatModelForGrader(task: SyllogismeTask): string {
  const m = task.modelSyllogisme
  const elementsJoined = m.majeure.elements.map(e => `- ${e}`).join('\n')
  const mappings = m.mineure.factMappings.map(fm => `- ${fm.element} ← ${fm.fact}`).join('\n')
  return `Majeure :
- Article : ${m.majeure.article}
- Règle : ${m.majeure.rule}
- Éléments attendus :
${elementsJoined}

Mineure — mapping attendu :
${mappings}

Conclusion :
- Réponse : ${m.conclusion.answer}
- Justification : ${m.conclusion.justification}`
}

export function buildSyllogismeGradingPrompt(
  config: SyllogismeGradingConfig,
): { system: string; user: string } {
  const system = `Tu es un membre de la commission d'examen du CRFPA. Tu corriges un exercice de syllogisme juridique rédigé par un candidat.

Ton rôle est PÉDAGOGIQUE, pas seulement évaluatif. Tu expliques POURQUOI chaque partie est incomplète ou fautive, en te référant aux critères méthodologiques du syllogisme. Tu n'écris JAMAIS à la place de l'étudiant : tu pointes les manques, tu ne donnes pas la réponse.

Règles absolues :
1. Français juridique soutenu. Aucun emoji, aucune formule familière.
2. Tu te fondes sur le modèle de correction fourni, mais tu acceptes toute reformulation correcte de l'étudiant. L'étudiant peut employer d'autres mots, citer l'article sous une forme voisine, organiser autrement — ce qui compte, c'est que le RAISONNEMENT soit juste et complet.
3. Chaque critère est noté sur 10. Total global sur 30.
4. Le feedback de chaque partie comporte 2 à 4 phrases : ce qui va, ce qui manque, et UNE suggestion méthodologique concrète.
5. Si une section est vide ou rédigée dans une autre langue que le français, tu la notes 0 et indiques qu'elle doit être reprise.
6. Tu renvoies UNIQUEMENT du JSON valide.`

  const { task, submission } = config
  const user = `Corrige la copie d'un étudiant CRFPA.

SCÉNARIO : ${task.scenario}
QUESTION : ${task.question}

MODÈLE DE CORRECTION (référentiel interne — ne pas recopier à l'étudiant) :
${formatModelForGrader(task)}

COPIE DE L'ÉTUDIANT :
--- Majeure ---
${submission.majeure || '(vide)'}
--- Mineure ---
${submission.mineure || '(vide)'}
--- Conclusion ---
${submission.conclusion || '(vide)'}

Grille :
- MAJEURE /10 : articleCorrect (bool), elementsIdentified (pour CHAQUE élément attendu : trouvé ou non), feedback.
- MINEURE /10 : mappings (pour CHAQUE élément attendu : mappé ou non + note si non), feedback.
- CONCLUSION /10 : explicit, justified, nuanced (bools), feedback.
- GLOBAL /30 : somme des trois + topMistake (1 phrase) + strength (1 phrase).

Réponds en JSON strict (pas de texte hors JSON) :

{
  "majeure": {
    "score": 0,
    "articleCorrect": false,
    "elementsIdentified": [{ "element": "...", "found": false }],
    "feedback": "..."
  },
  "mineure": {
    "score": 0,
    "mappings": [{ "element": "...", "mapped": false, "note": "..." }],
    "feedback": "..."
  },
  "conclusion": {
    "score": 0,
    "explicit": false,
    "justified": false,
    "nuanced": false,
    "feedback": "..."
  },
  "overall": {
    "score": 0,
    "topMistake": "...",
    "strength": "..."
  }
}`

  return { system, user }
}
