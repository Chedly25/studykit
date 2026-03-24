/**
 * Prompt templates for the CRFPA Note de Synthèse agentic pipeline.
 *
 * 5 agents:
 * 1. Theme Architect — picks theme, designs dossier blueprint
 * 2. Document Generator — generates one legal document per call (parallel)
 * 3. Coherence Reviewer — validates and fixes cross-references
 * 4. Model Synthesis Writer — writes the ideal 4-page synthesis
 * 5. Grading Rubric Builder — creates evaluation criteria
 */

// ─── Types ─────────────────────────────────────────────────────

export interface DossierDocumentSpec {
  docNumber: number
  type: 'legislation' | 'jurisprudence-cass' | 'jurisprudence-ce' | 'jurisprudence-cedh' | 'doctrine' | 'presse' | 'rapport' | 'circulaire'
  title: string
  role: string
  feedsPlanSection: string  // "IA" | "IB" | "IIA" | "IIB"
  approximateLength: string
  crossReferences?: string[]  // e.g., ["Cite the law from Doc 1"]
}

export interface DossierBlueprint {
  theme: string
  problematique: string
  planSuggere: {
    I: string
    IA: string
    IB: string
    II: string
    IIA: string
    IIB: string
  }
  documents: DossierDocumentSpec[]
  crossReferences: string[]
}

export interface DossierDocument {
  docNumber: number
  title: string
  type: string
  content: string
}

export interface SynthesisRubric {
  criteria: Array<{ criterion: string; points: number; details?: string }>
  totalPoints: number
  documentCoverageMap: Record<number, string>
}

// ─── Agent 1: Theme Architect ──────────────────────────────────

export function buildThemeArchitectPrompt(config: {
  topics?: string[]
  avoidThemes?: string[]
}): { system: string; user: string } {
  const avoidHint = config.avoidThemes && config.avoidThemes.length > 0
    ? `\n\nÉvite les thèmes suivants, déjà utilisés récemment : ${config.avoidThemes.join(', ')}.`
    : ''

  const topicHint = config.topics && config.topics.length > 0
    ? `\n\nLes domaines étudiés par le candidat incluent : ${config.topics.join(', ')}. Tu peux choisir un thème qui touche ces domaines.`
    : ''

  const system = `Tu es le président de la Commission nationale de l'examen d'accès au CRFPA, chargé de concevoir le sujet de l'épreuve de note de synthèse.

Tu dois concevoir un DOSSIER DOCUMENTAIRE complet autour d'un thème juridique d'actualité. Le dossier sera composé de 15 à 18 documents de types variés (législation, jurisprudence, doctrine, presse, rapports) totalisant environ 25 à 30 pages.

## CONTRAINTES

- Le thème doit porter sur les aspects juridiques d'un problème social, politique, économique ou culturel du monde actuel
- Le dossier doit permettre de construire un plan en deux parties et deux sous-parties (I/A, I/B, II/A, II/B)
- Chaque sous-partie du plan doit être alimentée par au moins 3-4 documents
- Les documents doivent présenter différentes perspectives sur le sujet (pour/contre, évolution, limites)
- Le dossier doit inclure un mélange équilibré de types de documents :
  - 2-3 textes législatifs (lois, codes, règlements, directives UE)
  - 3-4 décisions de jurisprudence (Cass., CE, CEDH, CC)
  - 3-4 articles de doctrine (revues juridiques)
  - 2-3 articles de presse juridique
  - 1-2 rapports officiels, circulaires ou avis

## CE QUE TU DOIS PRODUIRE

Un blueprint JSON avec cette structure exacte :
{
  "theme": "Le thème en une phrase",
  "problematique": "La problématique juridique complète",
  "planSuggere": {
    "I": "Titre de la première partie",
    "IA": "Titre de la sous-partie I/A",
    "IB": "Titre de la sous-partie I/B",
    "II": "Titre de la deuxième partie",
    "IIA": "Titre de la sous-partie II/A",
    "IIB": "Titre de la sous-partie II/B"
  },
  "documents": [
    {
      "docNumber": 1,
      "type": "legislation",
      "title": "Titre officiel du document avec références précises",
      "role": "Rôle de ce document dans le dossier (quelle information il apporte)",
      "feedsPlanSection": "IA",
      "approximateLength": "1 page",
      "crossReferences": ["Citer l'article X de la loi du Doc 3"]
    }
  ],
  "crossReferences": [
    "Doc 5 (doctrine) doit analyser l'arrêt du Doc 2",
    "Doc 8 (presse) doit mentionner le rapport du Doc 12"
  ]
}

Retourne UNIQUEMENT le JSON, sans texte autour.`

  const user = `Conçois un dossier de note de synthèse CRFPA.${topicHint}${avoidHint}

Le thème doit être d'actualité juridique (exemples de thèmes passés : la restitution des biens culturels, le statut juridique de l'animal, la GPA, la régulation des plateformes numériques, le droit à l'oubli, les algorithmes de décision publique).

Retourne le blueprint JSON complet.`

  return { system, user }
}

// ─── Agent 2: Document Generator ───────────────────────────────

export function buildDocumentGeneratorPrompt(
  blueprint: DossierBlueprint,
  docSpec: DossierDocumentSpec,
): { system: string; user: string } {
  const formatTemplates: Record<string, string> = {
    'legislation': `Format : texte de loi officiel
- En-tête avec le numéro de loi, la date de promulgation, le titre officiel
- Articles numérotés (Art. 1er, Art. 2, etc.) ou articles codifiés (Art. L. 311-3-1 du code...)
- Langue juridique officielle, impersonnelle
- Peut inclure des alinéas, des I/II/III
- Longueur : ${docSpec.approximateLength}`,

    'jurisprudence-cass': `Format : arrêt de la Cour de cassation
- En-tête : "Cour de cassation, [chambre], [date], n° [pourvoi]"
- Structure : Visa ("Vu l'article..."), Faits et procédure (résumé), Moyens du pourvoi, Motifs ("Mais attendu que..." ou nouveau style "la cour... énonce que..."), Dispositif (CASSE ET ANNULE / REJETTE)
- Langue judiciaire formelle
- Longueur : ${docSpec.approximateLength}`,

    'jurisprudence-ce': `Format : décision du Conseil d'État
- En-tête : "Conseil d'État, [formation], [date], n° [requête], [nom]"
- Structure en considérants : "Considérant que..." (ancien style) ou style direct (nouveau)
- Visas des textes applicables
- Dispositif : "DÉCIDE : Article 1er..."
- Longueur : ${docSpec.approximateLength}`,

    'jurisprudence-cedh': `Format : arrêt de la Cour européenne des droits de l'homme
- En-tête : "CEDH, [Grande Chambre/Section], [date], [Nom] c. [État], req. n° [numéro]"
- Paragraphes numérotés (§1, §2, §3...)
- Sections : EN FAIT (Circonstances de l'espèce), EN DROIT (Sur la violation alléguée de l'article X)
- "La Cour rappelle que...", "La Cour estime que...", "La Cour conclut que..."
- Longueur : ${docSpec.approximateLength}`,

    'doctrine': `Format : article de doctrine juridique
- En-tête : auteur (Pr. [Nom]), titre de l'article, revue (ex: D., RTD civ., JCP G, AJDA, RFDA), année, page
- Style académique avec analyses, références en notes de bas de page
- Peut citer de la jurisprudence et de la législation
- Structure : introduction, développement articulé, conclusion
- Longueur : ${docSpec.approximateLength}`,

    'presse': `Format : article de presse juridique
- En-tête : titre accrocheur, nom du journaliste, publication (Le Monde, Les Échos, Dalloz Actualité, Gazette du Palais), date
- Style journalistique accessible, citations d'experts
- Contexte factuel + enjeux juridiques vulgarisés
- Longueur : ${docSpec.approximateLength}`,

    'rapport': `Format : rapport officiel ou avis
- En-tête : institution (Défenseur des droits, CNCDH, Sénat, Assemblée nationale, CNIL), titre, date
- Synthèse des constats, recommandations numérotées
- Langue administrative
- Longueur : ${docSpec.approximateLength}`,

    'circulaire': `Format : circulaire ministérielle
- En-tête : Ministère, référence, date, objet
- "Le ministre... à Mesdames et Messieurs les..."
- Instructions administratives, interprétation des textes
- Longueur : ${docSpec.approximateLength}`,
  }

  const format = formatTemplates[docSpec.type] ?? formatTemplates['doctrine']

  const crossRefInstructions = docSpec.crossReferences && docSpec.crossReferences.length > 0
    ? `\n\nRÉFÉRENCES CROISÉES À INCLURE :\n${docSpec.crossReferences.map(r => `- ${r}`).join('\n')}`
    : ''

  const system = `Tu es un rédacteur juridique expert. Tu dois rédiger un document juridique FICTIF mais RÉALISTE pour un dossier de note de synthèse CRFPA.

Le document doit être suffisamment détaillé et substantiel pour qu'un candidat puisse en extraire des informations pertinentes pour sa synthèse. Il doit sembler authentique dans sa forme et son fond.

IMPORTANT : Le document est FICTIF — les noms de parties, numéros de décisions, dates et références sont inventés mais plausibles. Ne reproduis JAMAIS de vrais documents existants.`

  const user = `## THÈME DU DOSSIER
${blueprint.theme}

## PROBLÉMATIQUE
${blueprint.problematique}

## PLAN SUGGÉRÉ DE LA SYNTHÈSE
I. ${blueprint.planSuggere.I}
  A. ${blueprint.planSuggere.IA}
  B. ${blueprint.planSuggere.IB}
II. ${blueprint.planSuggere.II}
  A. ${blueprint.planSuggere.IIA}
  B. ${blueprint.planSuggere.IIB}

## TON DOCUMENT À RÉDIGER
- **Document n° ${docSpec.docNumber}**
- **Type** : ${docSpec.type}
- **Titre** : ${docSpec.title}
- **Rôle dans le dossier** : ${docSpec.role}
- **Alimente la sous-partie** : ${docSpec.feedsPlanSection}
- **Longueur cible** : ${docSpec.approximateLength}

## FORMAT ATTENDU
${format}${crossRefInstructions}

## CE QUE TU DOIS PRODUIRE

Rédige le document complet. Commence directement par l'en-tête du document (pas de "Voici le document" ou autre introduction). Le document doit être autonome et lisible.`

  return { system, user }
}

// ─── Agent 3: Coherence Reviewer ───────────────────────────────

export function buildCoherenceReviewerPrompt(
  blueprint: DossierBlueprint,
  documents: DossierDocument[],
): { system: string; user: string } {
  const system = `Tu es le rapporteur de la Commission nationale de l'examen d'accès au CRFPA. Tu vérifies la cohérence du dossier documentaire de note de synthèse avant sa publication.

Tu dois vérifier :
1. Les références croisées entre documents (un arrêt qui cite une loi doit utiliser le bon numéro d'article)
2. La cohérence des faits (dates, noms des parties, numéros de décisions)
3. La couverture du plan (chaque sous-partie I/A, I/B, II/A, II/B est alimentée par suffisamment de documents)
4. La diversité des types de documents
5. La longueur totale (~25-30 pages)

Si tu trouves des incohérences, tu RÉÉCRIS les passages problématiques. Tu retournes le dossier corrigé.`

  const docsText = documents.map(d =>
    `--- DOCUMENT ${d.docNumber} ---\nType: ${d.type}\nTitre: ${d.title}\n\n${d.content}`
  ).join('\n\n==========\n\n')

  const user = `## BLUEPRINT
${JSON.stringify(blueprint, null, 2)}

## DOSSIER COMPLET
${docsText}

## INSTRUCTIONS
Vérifie la cohérence du dossier. Si tout est correct, retourne le dossier tel quel. Si des corrections sont nécessaires, retourne le dossier corrigé.

Retourne un tableau JSON des documents corrigés :
[
  { "docNumber": 1, "title": "...", "type": "...", "content": "..." },
  ...
]

Retourne UNIQUEMENT le JSON, sans texte autour.`

  return { system, user }
}

// ─── Agent 4: Model Synthesis Writer ───────────────────────────

export function buildModelSynthesisPrompt(
  blueprint: DossierBlueprint,
  documents: DossierDocument[],
): { system: string; user: string } {
  const system = `Tu es un correcteur agrégé en droit, expert de l'épreuve de note de synthèse CRFPA. Tu dois rédiger la NOTE DE SYNTHÈSE MODÈLE à partir du dossier documentaire.

## MÉTHODOLOGIE STRICTE

1. **Introduction** (10-15 lignes) :
   - Phrase d'accroche liée au thème
   - Présentation du sujet et des enjeux
   - Problématique
   - Annonce du plan (I/II)

2. **Développement** en I/A, I/B, transition, II/A, II/B :
   - Chaque sous-partie développe une idée claire
   - CHAQUE document doit être cité au moins une fois avec "(Doc. N)"
   - Reformuler, ne jamais paraphraser
   - Ton neutre et objectif — aucun avis personnel
   - Transitions entre les sous-parties

3. **Pas de conclusion**

4. **Longueur : exactement 4 pages** (~2400 mots)

5. **Tous les documents doivent être cités** — c'est un critère fondamental`

  const docsText = documents.map(d =>
    `[Document ${d.docNumber} — ${d.type} — ${d.title}]\n${d.content}`
  ).join('\n\n---\n\n')

  const user = `## PLAN SUGGÉRÉ
I. ${blueprint.planSuggere.I}
  A. ${blueprint.planSuggere.IA}
  B. ${blueprint.planSuggere.IB}
II. ${blueprint.planSuggere.II}
  A. ${blueprint.planSuggere.IIA}
  B. ${blueprint.planSuggere.IIB}

## DOSSIER DOCUMENTAIRE
${docsText}

## CONSIGNE
Rédige la note de synthèse modèle. Cite chaque document avec la notation "(Doc. N)". Respecte la limite de ~2400 mots. Commence directement par l'introduction.`

  return { system, user }
}

// ─── Agent 5: Grading Rubric Builder ───────────────────────────

export function buildGradingRubricPrompt(
  blueprint: DossierBlueprint,
  documents: DossierDocument[],
  modelSynthesis: string,
): { system: string; user: string } {
  const system = `Tu es membre de la Commission nationale d'harmonisation des corrections du CRFPA. Tu dois créer la grille de correction pour l'épreuve de note de synthèse.`

  const user = `## THÈME
${blueprint.theme}

## PLAN ATTENDU
I. ${blueprint.planSuggere.I}
  A. ${blueprint.planSuggere.IA}
  B. ${blueprint.planSuggere.IB}
II. ${blueprint.planSuggere.II}
  A. ${blueprint.planSuggere.IIA}
  B. ${blueprint.planSuggere.IIB}

## DOCUMENTS DU DOSSIER
${documents.map(d => `Doc ${d.docNumber}: ${d.title} (${d.type}) → alimente ${blueprint.documents.find(bd => bd.docNumber === d.docNumber)?.feedsPlanSection ?? '?'}`).join('\n')}

## SYNTHÈSE MODÈLE (extrait)
${modelSynthesis.slice(0, 2000)}...

## CONSIGNE
Crée la grille de correction. Retourne UNIQUEMENT le JSON :
{
  "criteria": [
    { "criterion": "Nom du critère", "points": 3, "details": "Précisions pour le correcteur" }
  ],
  "totalPoints": 20,
  "documentCoverageMap": { "1": "IA", "2": "IIA", "3": "IB" }
}

Les critères doivent couvrir :
- Citation de tous les documents (barème détaillé)
- Qualité du plan et des titres
- Problématique
- Qualité de la synthèse (reformulation, pas paraphrase)
- Neutralité (absence d'avis personnel)
- Respect de la limite de 4 pages
- Qualité rédactionnelle
- Équilibre entre les parties

Total : 20 points.`

  return { system, user }
}
