/**
 * Prompts for the CRFPA Plan Détaillé Coach.
 * Two builders:
 *  - buildPlanQuestionPrompt: generate a dissertation topic + hidden model plan
 *  - buildPlanGradingPrompt: grade the student's 7-field plan on 6 axes × /5
 *
 * Both return `{ system, user }` strings in French, producing strict JSON.
 * Validated against 3 test questions (civil / social / public) before coding.
 */

import type {
  SyllogismeArticleRef,
  PlanTask,
  PlanSubmission,
} from '../coaching/types'

// ─── Themes ──────────────────────────────────────────────────────

export interface PlanTheme {
  id: string
  label: string
  domain: 'civil' | 'social' | 'penal' | 'administratif' | 'constitutionnel' | 'europeen'
  searchSeeds: string[]
}

export const PLAN_THEMES: PlanTheme[] = [
  {
    id: 'force-obligatoire',
    label: 'La force obligatoire du contrat',
    domain: 'civil',
    searchSeeds: ['force obligatoire contrat 1103 1193', 'révision pour imprévision 1195'],
  },
  {
    id: 'responsabilite-du-fait-autrui',
    label: 'La responsabilité du fait d\'autrui',
    domain: 'civil',
    searchSeeds: ['responsabilité du fait d\'autrui 1242', 'commettant préposé responsabilité'],
  },
  {
    id: 'vie-privee-salarie',
    label: 'La vie privée du salarié',
    domain: 'social',
    searchSeeds: ['vie personnelle salarié 9 code civil', 'Cass soc Nikon 2001 vie privée'],
  },
  {
    id: 'liberte-expression-salarie',
    label: 'La liberté d\'expression du salarié dans l\'entreprise',
    domain: 'social',
    searchSeeds: ['liberté expression salarié L1121-1', 'proportionnalité restriction liberté travail'],
  },
  {
    id: 'juge-admin-loi',
    label: 'Le juge administratif et la loi',
    domain: 'administratif',
    searchSeeds: ['contrôle conventionnalité Nicolo juge administratif', 'QPC conseil d\'état'],
  },
  {
    id: 'service-public',
    label: 'La notion de service public',
    domain: 'administratif',
    searchSeeds: ['service public arrêt Blanco', 'mission intérêt général personne publique'],
  },
  {
    id: 'principe-legalite-penale',
    label: 'Le principe de légalité criminelle',
    domain: 'penal',
    searchSeeds: ['principe légalité pénale 111-3 code pénal', 'interprétation stricte loi pénale'],
  },
  {
    id: 'responsabilite-penale-personnes-morales',
    label: 'La responsabilité pénale des personnes morales',
    domain: 'penal',
    searchSeeds: ['responsabilité pénale personne morale 121-2', 'organe représentant personne morale'],
  },
  {
    id: 'controle-constitutionnalite',
    label: 'Le contrôle de constitutionnalité en France',
    domain: 'constitutionnel',
    searchSeeds: ['contrôle constitutionnalité Conseil constitutionnel 61', 'QPC 61-1'],
  },
  {
    id: 'primaute-droit-ue',
    label: 'La primauté du droit de l\'Union européenne',
    domain: 'europeen',
    searchSeeds: ['primauté droit UE Costa Enel', 'applicabilité directe règlement directive'],
  },
]

// ─── Question generation prompt ──────────────────────────────────

export interface PlanQuestionConfig {
  themeId: string
  themeLabel: string                    // for echoing in the prompt
  articles: SyllogismeArticleRef[]
  avoidQuestions?: string[]             // first ~80 chars of past questions
}

function formatArticlesBlock(articles: SyllogismeArticleRef[]): string {
  if (articles.length === 0) {
    return '(aucun article fourni — appuie-toi sur la jurisprudence universellement reconnue du domaine)'
  }
  return articles
    .map((a, i) => {
      const loc = a.breadcrumb ? ` (${a.breadcrumb})` : ''
      return `${i + 1}. Art. ${a.articleNum} — ${a.codeName}${loc}\n   ${a.text}`
    })
    .join('\n\n')
}

export function buildPlanQuestionPrompt(
  config: PlanQuestionConfig,
): { system: string; user: string } {
  const system = `Tu es un membre de la commission d'examen du CRFPA. Tu conçois des sujets de dissertation juridique pour entraîner un candidat à la construction d'un plan détaillé problématisé en deux parties.

Règles absolues :
1. Rédaction en français juridique soutenu. Aucun emoji, aucune formule familière, aucune marque typographique décorative.
2. Tu t'ancres EXCLUSIVEMENT dans les articles fournis. Tu n'inventes AUCUNE référence. Si aucun article fourni ne s'adapte parfaitement, tu t'appuies sur ceux qui s'en rapprochent le plus et tu peux mentionner une jurisprudence emblématique si elle est universellement connue (Blanco, Nicolo, arrêt Canal de Craponne, etc.).
3. Le sujet doit être un sujet de DISSERTATION, non un cas pratique. Forme typique : une notion juridique à discuter, une tension à problématiser, une évolution à analyser.
4. Tu produis TOUJOURS un plan modèle problématisé (binaire, équilibré, non-chevauchant, ancré textuellement). Ce plan sert à corriger la copie : il doit être rigoureux comme un examen blanc. Il ne sera jamais montré au candidat avant sa correction.
5. Tu identifies 2 à 3 pièges méthodologiques typiques d'un candidat qui ne maîtrise pas ce sujet (« commonPitfalls »).
6. Tu renvoies UNIQUEMENT du JSON valide.`

  const avoidClause = config.avoidQuestions && config.avoidQuestions.length > 0
    ? `\nÉvite les sujets suivants, déjà utilisés récemment :\n${config.avoidQuestions.map(q => `- ${q}`).join('\n')}\n`
    : ''

  const user = `Conçois un sujet de dissertation juridique.

Thème : ${config.themeLabel}

Articles et références pertinents :
${formatArticlesBlock(config.articles)}
${avoidClause}
Contraintes :
- question : une phrase, sujet de dissertation (ex. "La force obligatoire du contrat"). Pas de question rhétorique, pas de scénario.
- themeLabel : libellé humain (ex. "Droit des contrats", "Droit social", "Droit public").
- modelPlan.problematique : 1 à 2 phrases posant la tension juridique centrale (doit contenir une véritable OPPOSITION ou ÉVOLUTION, non une description).
- modelPlan.I.title / II.title : intitulés nominaux, courts, problématisés.
- modelPlan.I.IA/IB et II.IIA/IIB : sous-parties équilibrées, sans chevauchement avec l'autre partie.
- modelPlan.transitions.I_to_II : 1 phrase reliant I et II (obligatoire). intro_to_I : 1 phrase (facultatif).
- modelPlan.anchors.IA/IB/IIA/IIB : pour chaque sous-partie, l'article ou l'arrêt qui constitue son ancrage textuel.
- commonPitfalls : 2 à 3 erreurs méthodologiques typiques sur ce sujet.

Réponds en JSON strict (aucun texte hors JSON) :

{
  "question": "...",
  "themeLabel": "...",
  "modelPlan": {
    "problematique": "...",
    "I": { "title": "...", "IA": "...", "IB": "..." },
    "II": { "title": "...", "IIA": "...", "IIB": "..." },
    "transitions": { "intro_to_I": "...", "I_to_II": "..." },
    "anchors": { "IA": "...", "IB": "...", "IIA": "...", "IIB": "..." }
  },
  "commonPitfalls": ["...", "..."]
}`

  return { system, user }
}

// ─── Grading prompt ──────────────────────────────────────────────

export interface PlanGradingConfig {
  task: PlanTask
  submission: PlanSubmission
}

function formatModelForGrader(task: PlanTask): string {
  const m = task.modelPlan
  const introLine = m.transitions.intro_to_I
    ? `Transition intro → I : ${m.transitions.intro_to_I}\n`
    : ''
  return `Problématique : ${m.problematique}

I. ${m.I.title}
   A. ${m.I.IA}
   B. ${m.I.IB}
II. ${m.II.title}
   A. ${m.II.IIA}
   B. ${m.II.IIB}

${introLine}Transition I → II : ${m.transitions.I_to_II}

Ancrages attendus :
- IA → ${m.anchors.IA}
- IB → ${m.anchors.IB}
- IIA → ${m.anchors.IIA}
- IIB → ${m.anchors.IIB}

Pièges typiques à détecter :
${task.commonPitfalls.map(p => `- ${p}`).join('\n')}`
}

function fieldOrEmpty(s: string): string {
  return s.trim() ? s : '(vide)'
}

export function buildPlanGradingPrompt(
  config: PlanGradingConfig,
): { system: string; user: string } {
  const system = `Tu es un membre de la commission d'examen du CRFPA. Tu corriges un plan de dissertation juridique rédigé par un candidat.

Ton rôle est PÉDAGOGIQUE, pas seulement évaluatif. Tu expliques POURQUOI chaque axe est maîtrisé ou insuffisant, en te référant aux critères méthodologiques du plan détaillé. Tu n'écris JAMAIS à la place du candidat : tu pointes les faiblesses, tu ne réécris pas la partie.

Règles absolues :
1. Français juridique soutenu. Aucun emoji, aucune formule familière.
2. Tu te fondes sur le plan modèle fourni, mais tu acceptes tout plan alternatif rigoureux. Le candidat peut proposer une autre articulation binaire légitime dès lors qu'elle est problématisée, équilibrée et non-chevauchante.
3. Chaque axe est noté sur 5. Total global sur 30.
4. Le feedback de chaque axe comporte 2 à 4 phrases : ce qui va, ce qui manque, et UNE suggestion méthodologique concrète.
5. Si le plan est incomplet (intitulés vides ou rédigés en langue étrangère), les axes correspondants sont notés 0 avec une note invitant à reprendre.
6. Tu renvoies UNIQUEMENT du JSON valide.`

  const { task, submission } = config
  const user = `Corrige le plan de dissertation d'un candidat CRFPA.

SUJET : ${task.question}
THÈME : ${task.themeLabel}

PLAN MODÈLE (référentiel interne — ne pas recopier au candidat) :
${formatModelForGrader(task)}

PLAN DU CANDIDAT :
Problématique : ${fieldOrEmpty(submission.problematique)}

I. ${fieldOrEmpty(submission.I.title)}
   A. ${fieldOrEmpty(submission.I.IA)}
   B. ${fieldOrEmpty(submission.I.IB)}
II. ${fieldOrEmpty(submission.II.title)}
   A. ${fieldOrEmpty(submission.II.IIA)}
   B. ${fieldOrEmpty(submission.II.IIB)}

GRILLE (6 axes, chacun noté sur 5) :
1. problematique : capte-t-elle une véritable tension juridique ? claire et non descriptive ?
2. opposition : le I et le II reflètent-ils une véritable opposition, progression ou évolution (et non deux blocs descriptifs) ?
3. equilibre : les quatre sous-parties (IA, IB, IIA, IIB) sont-elles d'ampleur comparable ?
4. chevauchement : existe-t-il des recoupements entre IA/IIA ou entre IB/IIB ?
5. couverture : le plan couvre-t-il l'ensemble du sujet ? Chaque sous-partie a-t-elle un ancrage textuel ou jurisprudentiel implicite dans son intitulé ?
6. transitions : la logique entre les parties est-elle perceptible à la seule lecture des titres ?

Pour CHAQUE axe : score 0-5, label français court (ex. "Problématique"), feedback de 2 à 4 phrases.

Global : score = somme des 6 axes (sur 30), topMistake (1 phrase), strength (1 phrase).

Réponds en JSON strict (aucun texte hors JSON) :

{
  "axes": [
    { "axis": "problematique", "label": "Problématique", "score": 0, "feedback": "..." },
    { "axis": "opposition", "label": "Opposition I vs II", "score": 0, "feedback": "..." },
    { "axis": "equilibre", "label": "Équilibre des parties", "score": 0, "feedback": "..." },
    { "axis": "chevauchement", "label": "Non-chevauchement", "score": 0, "feedback": "..." },
    { "axis": "couverture", "label": "Couverture et ancrage", "score": 0, "feedback": "..." },
    { "axis": "transitions", "label": "Transitions", "score": 0, "feedback": "..." }
  ],
  "overall": { "score": 0, "topMistake": "...", "strength": "..." }
}`

  return { system, user }
}
