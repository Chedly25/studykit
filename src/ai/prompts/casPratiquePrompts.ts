/**
 * Prompt templates for CRFPA cas pratique / consultation juridique.
 * Used for: droit des obligations, spécialité (7 choices), procédure (3 choices).
 */

import type { CasPratiqueGroundingEntry, CasPratiqueTask, CasPratiqueSubmission } from '../coaching/types'

export type CasPratiqueSpecialty =
  | 'obligations'
  | 'civil' | 'penal' | 'affaires' | 'social' | 'administratif' | 'fiscal' | 'immobilier'
  | 'procedure-civile' | 'procedure-penale' | 'procedure-administrative'

export interface CasPratiquePromptConfig {
  specialty: CasPratiqueSpecialty
  topics?: string[]
  avoidThemes?: string[]
  duration: number // minutes
  /**
   * Pool of real articles + jurisprudence retrieved from Vectorize that the
   * generated scenario and modelAnswer are authorized to cite. Empty pool
   * means zero citation guarantees — callers should assemble it first.
   */
  groundingPool: CasPratiqueGroundingEntry[]
  /**
   * Optional: feedback from a previous verification failure, used during the
   * single regenerate retry. Tells the model what inventions to avoid.
   */
  previousFailures?: string[]
}

const SPECIALTY_DETAILS: Record<CasPratiqueSpecialty, { label: string; domains: string; guidance: string }> = {
  obligations: {
    label: 'Droit des obligations',
    domains: 'formation et exécution des contrats, responsabilité civile délictuelle et contractuelle, quasi-contrats, enrichissement injustifié, régime général des obligations',
    guidance: 'Le scénario doit mêler des problématiques contractuelles et extracontractuelles. Inclure au moins un problème de formation du contrat, un de responsabilité, et un de régime des obligations.',
  },
  civil: {
    label: 'Droit civil',
    domains: 'droit des personnes, droit de la famille, droit des biens, droit des successions, régimes matrimoniaux',
    guidance: 'Le scénario met en jeu une situation familiale ou patrimoniale complexe avec plusieurs enjeux juridiques imbriqués.',
  },
  penal: {
    label: 'Droit pénal',
    domains: 'éléments constitutifs de l\'infraction, classification des infractions, culpabilité, complicité et coaction, causes d\'irresponsabilité, peines, récidive',
    guidance: 'Le scénario présente une situation factuelle complexe avec plusieurs infractions potentielles, des questions de qualification et de responsabilité pénale.',
  },
  affaires: {
    label: 'Droit des affaires',
    domains: 'droit des sociétés, procédures collectives, instruments de paiement et de crédit, droit de la concurrence, fonds de commerce, baux commerciaux',
    guidance: 'Le scénario met en scène une entreprise en difficulté ou un conflit entre associés, avec des problématiques croisées.',
  },
  social: {
    label: 'Droit social',
    domains: 'contrat de travail (formation, exécution, rupture), licenciement, discrimination, harcèlement, représentation du personnel, négociation collective',
    guidance: 'Le scénario concerne une relation de travail avec plusieurs problématiques : modification du contrat, licenciement contesté, discrimination, etc.',
  },
  administratif: {
    label: 'Droit administratif',
    domains: 'responsabilité administrative, contrats administratifs, police administrative, urbanisme, domaine public, actes administratifs unilatéraux',
    guidance: 'Le scénario met en jeu l\'administration et un administré, avec des questions de légalité, de responsabilité et de procédure.',
  },
  fiscal: {
    label: 'Droit fiscal',
    domains: 'impôt sur le revenu, impôt sur les sociétés, TVA, droits d\'enregistrement, contrôle fiscal, contentieux fiscal, fiscalité des entreprises',
    guidance: 'Le scénario présente une situation fiscale complexe avec des questions de qualification, d\'assiette et de procédure fiscale.',
  },
  immobilier: {
    label: 'Droit immobilier',
    domains: 'vente immobilière, construction (VEFA, responsabilité des constructeurs), copropriété, baux d\'habitation, baux commerciaux, urbanisme',
    guidance: 'Le scénario porte sur une opération immobilière avec des vices, des désordres ou des conflits entre parties.',
  },
  'procedure-civile': {
    label: 'Procédure civile',
    domains: 'compétence (matérielle et territoriale), action en justice (intérêt, qualité), instance, jugement, voies de recours, exécution, mesures conservatoires, référés',
    guidance: 'Le scénario soulève des questions de compétence, de recevabilité et de procédure dans le cadre d\'un litige civil.',
  },
  'procedure-penale': {
    label: 'Procédure pénale',
    domains: 'enquête (préliminaire et flagrance), garde à vue, instruction, contrôle judiciaire, détention provisoire, jugement, voies de recours, droits de la victime',
    guidance: 'Le scénario suit le déroulement d\'une affaire pénale et soulève des questions sur la régularité de la procédure.',
  },
  'procedure-administrative': {
    label: 'Procédure administrative',
    domains: 'recours pour excès de pouvoir, recours de plein contentieux, référés (liberté, suspension, mesures utiles), exécution des décisions, contentieux contractuel',
    guidance: 'Le scénario met en jeu un administré contestant une décision administrative, avec des questions de recevabilité et de fond.',
  },
}

export function buildCasPratiqueGenerationPrompt(config: CasPratiquePromptConfig): { system: string; user: string } {
  const spec = SPECIALTY_DETAILS[config.specialty]

  const avoidHint = config.avoidThemes?.length
    ? `\n\nÉvite les thèmes suivants, déjà utilisés récemment : ${config.avoidThemes.join(', ')}.`
    : ''

  const topicHint = config.topics?.length
    ? `\n\nLes sujets étudiés par le candidat incluent : ${config.topics.join(', ')}.`
    : ''

  const isProcedure = config.specialty.startsWith('procedure-')
  const cadreReglementaire = isProcedure
    ? `## CADRE RÉGLEMENTAIRE (Arrêté 17 octobre 2016, art. 5, 4°)

« Une épreuve, d'une durée de deux heures, au choix du candidat, dans l'une des matières suivantes :
- procédure civile ;
- procédure pénale ;
- procédure administrative contentieuse. »

La matière choisie ici est : ${spec.label}. Coefficient 1.`
    : config.specialty === 'obligations'
    ? `## CADRE RÉGLEMENTAIRE (Arrêté 17 octobre 2016, art. 5, 2°)

« Une épreuve en droit des obligations, d'une durée de trois heures. La note est affectée d'un coefficient 2. »

Cette épreuve teste la maîtrise du droit des obligations (contrats, responsabilité civile, régime général, preuves).`
    : `## CADRE RÉGLEMENTAIRE (Arrêté 17 octobre 2016, art. 5, 3°)

« Une épreuve destinée à vérifier l'aptitude à résoudre un ou plusieurs cas pratiques ou à rédiger une ou plusieurs consultations, d'une durée de trois heures, au choix du candidat, exprimé lors du dépôt de son dossier d'inscription, dans l'une des matières suivantes :
- droit civil ;
- droit des affaires ;
- droit social ;
- droit pénal ;
- droit administratif ;
- droit international et européen ;
- droit fiscal. »

La matière choisie ici est : ${spec.label}. Coefficient 2.`

  const poolBlock = config.groundingPool.length > 0
    ? config.groundingPool
        .map((e, i) => `[${i}] ${e.codeName}, Art. ${e.articleNum}${e.breadcrumb ? ` (${e.breadcrumb})` : ''}\n${e.text}`)
        .join('\n\n')
    : '(pool vide — la génération ne devrait pas être appelée sans pool)'

  const failuresBlock = config.previousFailures?.length
    ? `\n\n## CORRECTIONS À APPORTER PAR RAPPORT À LA GÉNÉRATION PRÉCÉDENTE
La génération précédente a échoué à la vérification pour ces raisons :
${config.previousFailures.map(f => `- ${f}`).join('\n')}
Corrige impérativement ces points.`
    : ''

  const system = `Tu es un professeur de droit agrégé, membre de la Commission nationale de l'examen d'accès au CRFPA, chargé de concevoir le sujet de l'épreuve de ${spec.label}.

Tu dois produire un SUJET DE CAS PRATIQUE / CONSULTATION JURIDIQUE complet et réaliste au niveau CRFPA.

${cadreReglementaire}

## FORMAT DE L'ÉPREUVE
- Durée : ${config.duration} minutes
- L'épreuve consiste en une consultation juridique
- Le candidat doit répondre comme un avocat consultant son client
- Méthode attendue : syllogisme juridique (majeure : règle de droit → mineure : application aux faits → conclusion)

## CE QUI FAIT UN BON CAS PRATIQUE CRFPA

1. **Scénario réaliste et dense** : Des faits précis avec des dates, des montants, des noms de parties. Pas un cas d'école simplifié.
2. **3 à 5 problèmes juridiques imbriqués** : Les problèmes doivent être CACHÉS dans les faits — le candidat doit les identifier lui-même. Certains sont évidents, d'autres subtils.
3. **Qualification ambiguë** : Au moins un problème où la qualification juridique n'est pas évidente et peut être discutée.
4. **Articulation des problèmes** : Les problèmes sont liés entre eux (la résolution de l'un influence l'autre).
5. **Niveau CRFPA** : Plus complexe qu'un cas de L3, moins théorique qu'un cas d'agrégation. Le candidat doit maîtriser la jurisprudence récente et les textes en vigueur.

## DOMAINES COUVERTS
${spec.domains}

## GUIDANCE SPÉCIFIQUE
${spec.guidance}

## SOURCES AUTORISÉES (POOL DE RÉFÉRENCES)

Tu disposes des extraits SUIVANTS comme SEULE source d'autorité citable. Tu ne dois JAMAIS citer d'article, d'arrêt, d'ECLI, de pourvoi ou de principe qui ne figure pas dans ce pool. Si un problème juridique naturel nécessiterait une référence absente, adapte le scénario pour qu'il utilise uniquement le pool fourni, ou retire ce problème.

---
${poolBlock}
---

Règles de citation ABSOLUES :
- Toute mention d'un article du type « article 1231-1 du code civil » doit correspondre exactement à un élément du pool (numéro ET code).
- Toute mention d'une jurisprudence (Cass. XXX, Cons. const., CE, CEDH, etc.) doit correspondre à un élément du pool. Pas de « la Cour a jugé le 12 mars 2019... » si rien dans le pool ne correspond.
- Tu peux paraphraser la portée d'un article/arrêt du pool, mais la paraphrase doit rester fidèle au texte fourni.
- Tu peux citer un principe général (ex : « principe de loyauté contractuelle ») sans référence précise, à condition de ne pas l'attacher à un numéro/date inventés.${failuresBlock}

## CE QUE TU DOIS PRODUIRE

Retourne un JSON avec cette structure EXACTE :
{
  "scenario": "Le texte complet du cas pratique en Markdown (1-2 pages de faits détaillés avec dates, noms, montants). Commence par 'M./Mme [Nom] vous consulte en qualité d'avocat...' ou une mise en situation équivalente. Termine par les questions posées au candidat.",
  "modelAnswer": "La consultation modèle complète suivant le syllogisme juridique. Pour CHAQUE problème : qualification, majeure (textes + jurisprudence), mineure (application aux faits), conclusion. Rédigée à la première personne comme un avocat.",
  "legalIssues": [
    "Intitulé concis du problème 1 (une phrase, sans préfixe 'Problème N:')",
    "Intitulé concis du problème 2",
    "..."
  ]
}

Règles strictes :
- Le tableau "legalIssues" contient UN intitulé par problème juridique caché dans le scénario, dans l'ordre où un candidat rigoureux les aborderait. Ces intitulés seront réutilisés par la correction pour identifier les problèmes traités par le candidat — ils doivent donc être NETS et UNIVOQUES.
- Entre 3 et 5 problèmes juridiques, pas moins.
- Retourne UNIQUEMENT le JSON, aucun texte hors JSON, aucune fence Markdown.`

  const user = `Conçois un cas pratique / consultation en ${spec.label} au niveau CRFPA.${topicHint}${avoidHint}

Le scénario doit être suffisamment complexe pour occuper ${config.duration} minutes de travail. Retourne le JSON complet.`

  return { system, user }
}

// ─── Grading prompt ──────────────────────────────────────────────

export interface CasPratiqueGradingConfig {
  task: CasPratiqueTask
  submission: CasPratiqueSubmission
}

function fieldOrEmpty(s: string): string {
  return s.trim() ? s : '(vide)'
}

export function buildCasPratiqueGradingPrompt(
  config: CasPratiqueGradingConfig,
): { system: string; user: string } {
  const system = `Tu es un membre de la commission d'examen du CRFPA. Tu corriges une consultation juridique rédigée par un candidat en réponse à un cas pratique.

Ton rôle est PÉDAGOGIQUE, pas seulement évaluatif. Tu expliques POURQUOI chaque critère est maîtrisé ou insuffisant au regard de la méthodologie du cas pratique CRFPA. Tu n'écris JAMAIS à la place du candidat : tu pointes les faiblesses et suggères la méthode.

Règles absolues :
1. Français juridique soutenu. Aucun emoji.
2. Tu te fondes sur le sujet, la liste des problèmes attendus et la consultation modèle fournis.
3. Total global sur 20, avec six critères aux barèmes fixes (4/5/4/3/2/2).
4. Le feedback de chaque critère comporte 2 à 4 phrases : ce qui va, ce qui manque, et UNE suggestion méthodologique concrète.
5. Si la copie est vide, tu notes 0 partout avec un feedback invitant à la reprendre.
6. identifiedIssues/missedIssues utilisent les INDEX (commençant à 0) des problèmes dans la liste fournie. Leur union doit couvrir tous les index, sans doublon.
7. Tu distingues identification et résolution : un problème peut figurer dans identifiedIssues même si le candidat l'a traité médiocrement (cela baisse alors les notes de syllogisme/règles/application, pas celle d'identification).
8. Zéro tolérance pour les références inventées (articles, arrêts fictifs) : pénalise sévèrement le critère "regles".
9. Tu renvoies UNIQUEMENT du JSON valide, aucun texte hors JSON, aucune fence Markdown.`

  const { task, submission } = config
  const issuesList = task.legalIssues
    .map((issue, i) => `${i}. ${issue}`)
    .join('\n')

  const poolBlock = task.groundingPool.length > 0
    ? task.groundingPool
        .map((e, i) => `[${i}] ${e.codeName}, Art. ${e.articleNum}${e.breadcrumb ? ` (${e.breadcrumb})` : ''}\n${e.text}`)
        .join('\n\n')
    : '(pool vide)'

  const user = `Corrige cette consultation juridique.

MATIÈRE : ${task.specialtyLabel}

SUJET (cas pratique posé au candidat) :
${task.scenario}

PROBLÈMES JURIDIQUES ATTENDUS (index à utiliser pour identifiedIssues/missedIssues) :
${issuesList}

POOL DE RÉFÉRENCES CONNUES (articles + jurisprudence effectivement disponibles — toute citation du candidat HORS de ce pool doit être considérée avec prudence pour le critère "regles") :
---
${poolBlock}
---

CONSULTATION MODÈLE (référence de niveau CRFPA) :
${task.modelAnswer}

COPIE DU CANDIDAT :
${fieldOrEmpty(submission.answer)}

GRILLE (6 critères, barèmes fixes, total /20) :
1. identification (/4) : combien des problèmes listés ci-dessus ont été identifiés (même brièvement traités) par le candidat ? Score proportionnel.
2. syllogisme (/5) : pour chaque problème traité, le candidat applique-t-il rigoureusement le syllogisme (règle → application → conclusion) ? Pas de conclusions assenées, pas de majeures implicites.
3. regles (/4) : exactitude des règles de droit (articles, jurisprudence, principes). Références inventées = pénalité sévère.
4. application (/3) : les faits du scénario sont-ils repris PRÉCISÉMENT (dates, montants, qualités des parties), ou le candidat répond-il de manière générique qui s'appliquerait à n'importe quel cas ?
5. redaction (/2) : style consultation (« il convient de », « sur le fondement de », « au visa de »), clarté, structure (ordre logique, transitions entre qualifications).
6. conseil (/2) : la copie se termine-t-elle par un conseil pratique concret destiné au client (agir/ne pas agir, délai, risque chiffré, option stratégique) ?

Pour CHAQUE critère : score entier entre 0 et son max, label français court, feedback 2-4 phrases.
Global : score = somme des 6 critères (sur 20), topMistake (1 phrase), strength (1 phrase), identifiedIssues (indices traités), missedIssues (indices non traités).

Réponds en JSON strict :

{
  "axes": [
    { "axis": "identification", "label": "Identification des problèmes", "score": 0, "max": 4, "feedback": "..." },
    { "axis": "syllogisme", "label": "Qualité du syllogisme", "score": 0, "max": 5, "feedback": "..." },
    { "axis": "regles", "label": "Exactitude des règles", "score": 0, "max": 4, "feedback": "..." },
    { "axis": "application", "label": "Application aux faits", "score": 0, "max": 3, "feedback": "..." },
    { "axis": "redaction", "label": "Rédaction", "score": 0, "max": 2, "feedback": "..." },
    { "axis": "conseil", "label": "Conseil pratique", "score": 0, "max": 2, "feedback": "..." }
  ],
  "overall": { "score": 0, "topMistake": "...", "strength": "...", "identifiedIssues": [], "missedIssues": [] }
}`

  return { system, user }
}

// ─── Verification prompt ─────────────────────────────────────────

export interface CasPratiqueVerificationConfig {
  groundingPool: CasPratiqueGroundingEntry[]
  modelAnswer: string
  scenario: string
}

export interface CasPratiqueVerificationIssue {
  /** The citation flagged (e.g., "Article 1131 Code civil", "Cass. soc. 12 mars 2019 n°17-28.083") */
  citation: string
  /** What the modelAnswer claims the reference says or does */
  claim: string
  /** Why this is a problem (absent from pool, contradicts pool text, etc.) */
  reason: string
  /** Severity — 'invented' = not in pool; 'misrepresented' = in pool but content claim is wrong */
  severity: 'invented' | 'misrepresented'
}

export interface CasPratiqueVerificationResult {
  passed: boolean
  issues: CasPratiqueVerificationIssue[]
}

export function buildCasPratiqueVerificationPrompt(
  config: CasPratiqueVerificationConfig,
): { system: string; user: string } {
  const system = `Tu es un vérificateur juridique rigoureux. Ta seule tâche est de détecter les RÉFÉRENCES JURIDIQUES fabriquées ou dénaturées dans un texte.

Règles :
1. Tu ne juges PAS la qualité pédagogique, le style ou la pertinence — uniquement l'exactitude des citations.
2. Le "pool autorisé" est la liste finie des articles et décisions de jurisprudence qui peuvent être cités. Tout ce qui n'y figure pas et qui est présenté comme une source juridique précise (numéro d'article, ECLI, pourvoi, date précise d'arrêt) est FABRIQUÉ.
3. Une paraphrase large d'un principe général (ex : « le principe d'autonomie de la volonté ») sans rattachement à un article/arrêt précis n'est PAS une fabrication.
4. Une référence qui figure dans le pool mais dont le contenu affirmé dans le texte CONTREDIT le texte du pool est DÉNATURÉE.
5. Tu renvoies UNIQUEMENT du JSON strict. Aucun texte hors JSON. Aucune fence Markdown. Aucun emoji.
6. Si aucune fabrication ni dénaturation n'est détectée, passed=true et issues=[].
7. Si le texte contient des hallucinations, passed=false. Liste-les toutes.`

  const poolBlock = config.groundingPool
    .map((e, i) => `[${i}] ${e.codeName}, Art. ${e.articleNum}${e.breadcrumb ? ` (${e.breadcrumb})` : ''}\n${e.text}`)
    .join('\n\n')

  const user = `Vérifie les références juridiques citées dans la CONSULTATION MODÈLE ci-dessous.

POOL AUTORISÉ :
---
${poolBlock}
---

SCÉNARIO (pour contexte, pas à vérifier) :
${config.scenario}

CONSULTATION MODÈLE (à vérifier) :
${config.modelAnswer}

Passe en revue CHAQUE citation explicite (numéro d'article, ECLI, pourvoi, date d'arrêt, principe attribué à un arrêt précis) dans la consultation modèle. Pour chacune :
- Si la référence est dans le pool ET le contenu affirmé correspond au texte du pool → OK.
- Si la référence n'est PAS dans le pool → severity: "invented".
- Si la référence est dans le pool mais le texte dit le contraire de ce qu'elle dit vraiment → severity: "misrepresented".

Retourne ce JSON strict :

{
  "passed": true,
  "issues": []
}

ou, en cas de problème :

{
  "passed": false,
  "issues": [
    {
      "citation": "Art. 1131 Code civil",
      "claim": "dispose que le contrat est nul à défaut de cause (fondement invoqué en l'espèce)",
      "reason": "Article 1131 n'est pas présent dans le pool et l'article 1131 actuel du code civil ne porte pas sur la cause (abrogée par l'ordonnance du 10 février 2016).",
      "severity": "invented"
    }
  ]
}`

  return { system, user }
}

// ─── Specialty search seeds (for grounding pool assembly) ────────

/**
 * Seed queries used by the coach to assemble the grounding pool before generation.
 * Each specialty should have 3-5 seeds covering its canonical sub-topics so that the
 * Vectorize retrieval surfaces a rich mix of code articles + jurisprudence.
 * Keep seeds SHORT and semantic (BGE-M3 / e5-large work well with phrase queries).
 */
export const SPECIALTY_SEARCH_SEEDS: Record<CasPratiqueSpecialty, string[]> = {
  obligations: [
    'formation du contrat vice du consentement',
    'responsabilité contractuelle dommages-intérêts',
    'responsabilité délictuelle article 1240',
    'régime général des obligations preuve',
    'résolution du contrat inexécution',
  ],
  civil: [
    'autorité parentale intérêt de l\'enfant',
    'régimes matrimoniaux communauté',
    'succession partage réserve héréditaire',
    'droit des biens propriété voisinage',
  ],
  penal: [
    'élément moral intentionnel infraction',
    'complicité coaction responsabilité pénale',
    'causes d\'irresponsabilité légitime défense',
    'qualification tentative vol abus de confiance',
  ],
  affaires: [
    'droit des sociétés abus de majorité',
    'procédure collective redressement liquidation',
    'fonds de commerce cession',
    'concurrence déloyale rupture brutale',
  ],
  social: [
    'licenciement cause réelle et sérieuse',
    'harcèlement moral obligation de sécurité',
    'modification du contrat de travail',
    'représentants du personnel négociation collective',
  ],
  administratif: [
    'responsabilité administrative faute service',
    'contrats administratifs marchés publics',
    'recours pour excès de pouvoir acte administratif',
    'police administrative ordre public',
  ],
  fiscal: [
    'contrôle fiscal procédure redressement',
    'TVA territorialité déduction',
    'impôt sur les sociétés régime mère-fille',
    'contentieux fiscal recours',
  ],
  immobilier: [
    'vente immobilière vices cachés',
    'construction responsabilité décennale VEFA',
    'copropriété assemblée générale',
    'baux commerciaux loi Pinel',
  ],
  'procedure-civile': [
    'compétence juridiction tribunal judiciaire',
    'action en justice intérêt qualité',
    'voies de recours appel pourvoi cassation',
    'référé mesures conservatoires',
  ],
  'procedure-penale': [
    'garde à vue droits du mis en cause',
    'instruction détention provisoire',
    'nullité de procédure',
    'voies de recours chambre de l\'instruction',
  ],
  'procedure-administrative': [
    'recours pour excès de pouvoir délai',
    'référé liberté suspension',
    'plein contentieux contestation',
    'exécution des décisions administratives',
  ],
}

export const SPECIALTY_OPTIONS: Array<{ value: CasPratiqueSpecialty; label: string; category: 'obligations' | 'specialite' | 'procedure' }> = [
  { value: 'obligations', label: 'Droit des obligations', category: 'obligations' },
  { value: 'civil', label: 'Droit civil', category: 'specialite' },
  { value: 'penal', label: 'Droit pénal', category: 'specialite' },
  { value: 'affaires', label: 'Droit des affaires', category: 'specialite' },
  { value: 'social', label: 'Droit social', category: 'specialite' },
  { value: 'administratif', label: 'Droit administratif', category: 'specialite' },
  { value: 'fiscal', label: 'Droit fiscal', category: 'specialite' },
  { value: 'immobilier', label: 'Droit immobilier', category: 'specialite' },
  { value: 'procedure-civile', label: 'Procédure civile', category: 'procedure' },
  { value: 'procedure-penale', label: 'Procédure pénale', category: 'procedure' },
  { value: 'procedure-administrative', label: 'Procédure administrative', category: 'procedure' },
]
