/**
 * Prompt templates for the REAL-DOCUMENT Note de Synthèse pipeline.
 *
 * Unlike synthesePrompts.ts (which fabricates documents), this pipeline:
 * 1. Theme Architect → outputs search queries per document slot
 * 2. Document Curator → excerpts real fetched documents to dossier length
 * 3. Model Synthesis Writer → writes synthesis from real content
 * 4. Grading Rubric Builder → creates evaluation criteria
 */

// ─── Types ─────────────────────────────────────────────────────

export interface DocumentSlot {
  slotNumber: number
  type: 'legislation' | 'jurisprudence-cass' | 'jurisprudence-ce' | 'jurisprudence-cedh' | 'doctrine' | 'rapport' | 'presse'
  description: string
  feedsPlanSection: string  // "IA" | "IB" | "IIA" | "IIB"
  searchQueries: string[]   // targeted search queries
}

export interface RealDossierBlueprint {
  theme: string
  problematique: string
  planSuggere: {
    I: string; IA: string; IB: string
    II: string; IIA: string; IIB: string
  }
  documentSlots: DocumentSlot[]
}

export interface RealDossierDocument {
  docNumber: number
  type: string
  title: string
  sourceUrl: string
  content: string  // curated excerpt
}

// ─── Agent 1: Theme Architect (search-query version) ─────────

export function buildRealThemeArchitectPrompt(config: {
  topics?: string[]
  avoidThemes?: string[]
}): { system: string; user: string } {
  const avoidHint = config.avoidThemes?.length
    ? `\n\nÉvite les thèmes suivants, déjà utilisés récemment : ${config.avoidThemes.join(', ')}.`
    : ''
  const topicHint = config.topics?.length
    ? `\n\nLes domaines étudiés par le candidat incluent : ${config.topics.join(', ')}.`
    : ''

  const system = `Tu es le président de la Commission nationale de l'examen d'accès au CRFPA, chargé de concevoir le sujet de l'épreuve de note de synthèse.

Tu dois concevoir un DOSSIER DOCUMENTAIRE basé sur des SOURCES RÉELLES disponibles publiquement. Tu ne génères PAS les documents — tu spécifies des REQUÊTES DE RECHERCHE pour trouver de vrais textes juridiques.

## CONTRAINTES

- Le thème doit porter sur un sujet juridique d'actualité pour lequel des sources publiques abondantes existent
- Le dossier doit permettre un plan en I/A, I/B, II/A, II/B
- Chaque sous-partie alimentée par au moins 3 documents
- Mélange équilibré de types :
  - 2-3 jurisprudence Cour de cassation (cherchables sur Judilibre)
  - 1-2 textes législatifs (vie-publique.fr, résumés de lois)
  - 2-3 rapports officiels (Défenseur des droits, Sénat, vie-publique.fr)
  - 2-3 analyses juridiques / doctrine ouverte (Village Justice, blogs juridiques, HAL)
  - 1-2 articles de presse juridique
- Total : 12 à 15 documents
- IMPORTANT : choisis un thème où tu es CERTAIN que des sources publiques réelles existent en abondance

## CE QUE TU DOIS PRODUIRE

Un blueprint JSON :
{
  "theme": "Le thème en une phrase",
  "problematique": "La problématique juridique",
  "planSuggere": {
    "I": "Titre partie I",
    "IA": "Sous-partie I/A",
    "IB": "Sous-partie I/B",
    "II": "Titre partie II",
    "IIA": "Sous-partie II/A",
    "IIB": "Sous-partie II/B"
  },
  "documentSlots": [
    {
      "slotNumber": 1,
      "type": "jurisprudence-cass",
      "description": "Arrêt sur le renversement de la charge de la preuve en matière de licenciement du lanceur d'alerte",
      "feedsPlanSection": "IA",
      "searchQueries": ["lanceur alerte licenciement charge preuve", "protection lanceur alerte chambre sociale"]
    },
    {
      "slotNumber": 2,
      "type": "rapport",
      "description": "Rapport du Défenseur des droits sur la protection effective des lanceurs d'alerte",
      "feedsPlanSection": "IB",
      "searchQueries": ["défenseur droits lanceur alerte rapport 2023"]
    }
  ]
}

Pour les jurisprudence-cass, les searchQueries seront envoyées à l'API Judilibre (recherche plein texte dans les arrêts de la Cour de cassation).
Pour les autres types, les searchQueries seront envoyées à un moteur de recherche web.

Retourne UNIQUEMENT le JSON.`

  const user = `Conçois un dossier de note de synthèse CRFPA basé sur des sources réelles.${topicHint}${avoidHint}

Thèmes possibles (exemples) : lanceurs d'alerte, GPA, euthanasie, IA et droits fondamentaux, régulation des plateformes, droit à l'oubli, état d'urgence et libertés, violences conjugales, discrimination algorithmique, protection des données personnelles.

Choisis un thème pour lequel de nombreuses sources publiques réelles existent. Retourne le blueprint JSON.`

  return { system, user }
}

// ─── Agent 2: Document Curator ───────────────────────────────

export function buildDocumentCuratorPrompt(
  theme: string,
  problematique: string,
  slot: DocumentSlot,
  rawContent: string,
  sourceTitle: string,
  sourceUrl: string,
): { system: string; user: string } {
  const system = `Tu es un assistant juridique expert. Tu dois extraire un EXTRAIT pertinent d'un document juridique RÉEL pour un dossier de note de synthèse CRFPA.

RÈGLES IMPÉRATIVES :
- Conserve les références exactes (numéros d'articles, dates, noms, numéros de pourvoi, ECLI)
- Sois FIDÈLE au texte original — reformule pour la longueur mais n'invente RIEN
- Ne modifie JAMAIS les citations, dates, noms de parties ou références juridiques
- Longueur cible : 600 à 1200 mots (1-2 pages)
- Commence par un en-tête formel identifiant le document réel (type, date, source, référence)
- L'extrait doit être autonome et compréhensible seul`

  const user = `## THÈME DU DOSSIER
${theme}

## PROBLÉMATIQUE
${problematique}

## RÔLE DE CE DOCUMENT DANS LE DOSSIER
${slot.description}
Alimente la sous-partie : ${slot.feedsPlanSection}

## DOCUMENT SOURCE RÉEL
Type : ${slot.type}
Titre : ${sourceTitle}
Source : ${sourceUrl}

## CONTENU BRUT
${rawContent.slice(0, 20000)}

## CONSIGNE
Extrais un passage de 600 à 1200 mots pertinent pour le thème "${theme}". Conserve toutes les références juridiques exactes. Commence par l'en-tête formel du document.`

  return { system, user }
}

// ─── Agent 3: Model Synthesis Writer ─────────────────────────

export function buildRealModelSynthesisPrompt(
  blueprint: RealDossierBlueprint,
  documents: RealDossierDocument[],
): { system: string; user: string } {
  const system = `Tu es un correcteur agrégé en droit, expert de l'épreuve de note de synthèse CRFPA. Tu rédiges la NOTE DE SYNTHÈSE MODÈLE à partir d'un dossier de documents RÉELS.

## MÉTHODOLOGIE STRICTE — NOTE DE SYNTHÈSE (PAS une dissertation)

1. **Introduction** (10-15 lignes) :
   - Phrase d'accroche liée à l'actualité du thème
   - Présentation factuelle du sujet tel qu'il ressort du dossier
   - Problématique (doit découler du dossier, pas d'une réflexion personnelle)
   - Annonce du plan (I/II uniquement)

2. **Développement** en I/A, I/B, transition, II/A, II/B :
   - CHAQUE phrase doit restituer le contenu d'un document — cite avec "(Doc. N)"
   - RESTITUER objectivement ce que disent les documents
   - NE PAS éditorialiser, NE PAS construire de raisonnement juridique personnel
   - PHRASES INTERDITES : "il apparaît nécessaire", "il convient de souligner/noter/relever", "force est de constater", "il s'agit d'analyser/examiner", "on peut affirmer que", "il est intéressant de noter", "il nous semble"
   - PHRASES À UTILISER : "Le document X indique que...", "Selon le rapport (Doc. N)...", "L'arrêt (Doc. N) retient que...", "Il ressort du dossier que..."
   - Reformuler le contenu des documents, ne pas paraphraser
   - Transitions entre sous-parties

3. **Pas de conclusion**

4. **Longueur : 2400 mots minimum** (~4 pages)

5. **Tous les documents doivent être cités au moins une fois**

RAPPEL : une note de synthèse est une RESTITUTION NEUTRE du dossier. Le candidat montre qu'il a LU et COMPRIS tous les documents, pas qu'il sait raisonner en droit.`

  const docsText = documents.map(d =>
    `[Document ${d.docNumber} — ${d.type} — ${d.title}]\nSource : ${d.sourceUrl}\n\n${d.content}`
  ).join('\n\n---\n\n')

  const user = `## PLAN SUGGÉRÉ
I. ${blueprint.planSuggere.I}
  A. ${blueprint.planSuggere.IA}
  B. ${blueprint.planSuggere.IB}
II. ${blueprint.planSuggere.II}
  A. ${blueprint.planSuggere.IIA}
  B. ${blueprint.planSuggere.IIB}

## DOSSIER DOCUMENTAIRE (${documents.length} documents réels)
${docsText}

## CONSIGNE
Rédige la note de synthèse modèle. Minimum 2400 mots. Commence directement par l'introduction.

VÉRIFICATION OBLIGATOIRE avant de terminer :
- Chaque document de 1 à ${documents.length} DOIT être cité au moins une fois avec "(Doc. N)"
- Compter les mots : si moins de 2400, étoffer les sous-parties les plus courtes
- Aucune phrase d'analyse personnelle — uniquement de la restitution`

  return { system, user }
}

// ─── Agent 4: Grading Rubric Builder ─────────────────────────

export function buildRealGradingRubricPrompt(
  blueprint: RealDossierBlueprint,
  documents: RealDossierDocument[],
  modelSynthesis: string,
): { system: string; user: string } {
  const system = `Tu es membre de la Commission nationale d'harmonisation des corrections du CRFPA. Tu crées la grille de correction pour la note de synthèse.`

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
${documents.map(d => `Doc ${d.docNumber}: ${d.title} (${d.type}) — ${d.sourceUrl}`).join('\n')}

## SYNTHÈSE MODÈLE (extrait)
${modelSynthesis.slice(0, 2000)}...

## CONSIGNE
Crée la grille de correction. Retourne UNIQUEMENT le JSON (pas de backticks, pas de markdown) :
{
  "criteria": [
    { "criterion": "Nom du critère", "points": 3, "details": "Précisions pour le correcteur" }
  ],
  "totalPoints": 20,
  "documentCoverageMap": { "1": "IA", "2": "IIA" }
}

Critères obligatoires : citation de tous les documents, plan structuré, problématique, qualité de la synthèse (restitution neutre, pas dissertation), neutralité, respect de la limite, qualité rédactionnelle, équilibre des parties.
Total : 20 points.`

  return { system, user }
}

// ─── Quality Patch Prompt (coverage + length) ────────────────

export function buildQualityPatchPrompt(
  currentSynthesis: string,
  uncitedDocs: RealDossierDocument[],
  wordCount: number,
  needsExpansion: boolean,
): { system: string; user: string } {
  const system = `Tu es un correcteur de note de synthèse CRFPA. Tu améliores une synthèse existante SANS la réécrire entièrement.

RÈGLES :
- Conserve le plan, le style et la structure existants
- Ne supprime rien de ce qui existe déjà
- Intègre les corrections NATURELLEMENT dans le texte existant
- Cite toujours avec "(Doc. N)"
- Style de restitution neutre (pas de dissertation)
- Retourne la synthèse COMPLÈTE améliorée (pas seulement les corrections)`

  let instructions = ''

  if (uncitedDocs.length > 0) {
    const uncitedInfo = uncitedDocs.map(d =>
      `Document ${d.docNumber} (${d.type} — ${d.title}) :\n${d.content.slice(0, 1500)}`
    ).join('\n\n---\n\n')
    instructions += `## DOCUMENTS NON CITÉS À INTÉGRER\n\nLes documents suivants ne sont pas encore cités dans la synthèse. Intègre une référence "(Doc. N)" pour chacun dans la sous-partie appropriée du plan. Ajoute 1-2 phrases par document non cité.\n\n${uncitedInfo}\n\n`
  }

  if (needsExpansion) {
    instructions += `## LONGUEUR INSUFFISANTE\n\nLa synthèse fait actuellement ${wordCount} mots. Objectif : 2400 mots minimum.\nÉtoffe les sections les plus courtes avec davantage de restitution du contenu des documents déjà cités.\n\n`
  }

  const user = `${instructions}## SYNTHÈSE ACTUELLE\n${currentSynthesis}\n\n## CONSIGNE\nRetourne la synthèse COMPLÈTE améliorée. Ne retourne PAS uniquement les parties modifiées — retourne le texte entier de la synthèse avec les améliorations intégrées.`

  return { system, user }
}
