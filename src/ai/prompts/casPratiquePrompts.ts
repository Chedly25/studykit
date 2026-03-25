/**
 * Prompt templates for CRFPA cas pratique / consultation juridique.
 * Used for: droit des obligations, spécialité (7 choices), procédure (3 choices).
 */

export type CasPratiqueSpecialty =
  | 'obligations'
  | 'civil' | 'penal' | 'affaires' | 'social' | 'administratif' | 'fiscal' | 'immobilier'
  | 'procedure-civile' | 'procedure-penale' | 'procedure-administrative'

export interface CasPratiquePromptConfig {
  specialty: CasPratiqueSpecialty
  topics?: string[]
  avoidThemes?: string[]
  duration: number // minutes
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

  const system = `Tu es un professeur de droit agrégé, membre de la Commission nationale de l'examen d'accès au CRFPA, chargé de concevoir le sujet de l'épreuve de ${spec.label}.

Tu dois produire un SUJET DE CAS PRATIQUE / CONSULTATION JURIDIQUE complet et réaliste au niveau CRFPA.

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

## CE QUE TU DOIS PRODUIRE

Retourne un JSON avec cette structure :
{
  "scenario": "Le texte complet du cas pratique / de la consultation (1-2 pages de faits détaillés avec dates, noms, montants). Commence par 'M./Mme [Nom] vous consulte en qualité d'avocat...' ou une mise en situation similaire. Termine par les questions posées au candidat.",
  "modelAnswer": "La consultation modèle complète suivant le syllogisme juridique. Pour chaque problème : qualification, majeure (textes + jurisprudence), mineure (application aux faits), conclusion. Rédigée à la première personne comme un avocat.",
  "legalIssues": ["Problème 1: ...", "Problème 2: ...", "..."],
  "rubric": {
    "criteria": [
      { "criterion": "Identification des problèmes juridiques", "points": 4, "details": "1 pt par problème identifié" },
      { "criterion": "Qualité du syllogisme", "points": 5, "details": "Majeure/mineure/conclusion pour chaque problème" },
      { "criterion": "Exactitude des règles de droit", "points": 4, "details": "Textes et jurisprudence corrects" },
      { "criterion": "Application aux faits", "points": 3, "details": "Application précise, pas générique" },
      { "criterion": "Qualité de la rédaction", "points": 2, "details": "Style consultation, clarté, structure" },
      { "criterion": "Conclusion et conseil pratique", "points": 2, "details": "Conseil concret au client" }
    ],
    "totalPoints": 20
  }
}

Retourne UNIQUEMENT le JSON.`

  const user = `Conçois un cas pratique / consultation en ${spec.label} au niveau CRFPA.${topicHint}${avoidHint}

Le scénario doit être suffisamment complexe pour occuper ${config.duration} minutes de travail. Retourne le JSON complet.`

  return { system, user }
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
