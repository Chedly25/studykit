/**
 * Prompts for the CRFPA fiches de révision coach.
 *
 * Three builders:
 *  - buildLegalFicheGenerationPrompt: Opus generates a "wall-worthy" fiche
 *    grounded in a dual pool (legal corpus + her own cours).
 *  - buildLegalFicheVerificationPrompt: Sonnet verifies references are neither
 *    invented nor misrepresented (same pattern as cas pratique).
 *  - FICHE_THEMES: canonical catalogue of CRFPA themes with search seeds.
 *
 * Fiche skeleton derived from web research on top-quality CRFPA sources
 * (fiches-droit.com, IEJ Paris 1 Sorbonne, Bamdé/Gdroit, Objectif Barreau,
 * Prépa Dalloz). Mnémotechniques are deliberately NOT a section —
 * serious sources don't include them.
 */

import type { CasPratiqueGroundingEntry } from '../coaching/types'

// ─── Theme catalog ───────────────────────────────────────────────

export type FicheMatiere =
  | 'obligations'
  | 'civil'
  | 'penal'
  | 'affaires'
  | 'social'
  | 'administratif'
  | 'fiscal'
  | 'immobilier'
  | 'procedure-civile'
  | 'procedure-penale'
  | 'procedure-administrative'
  | 'libertes'

export interface LegalFicheTheme {
  id: string
  label: string
  matiere: FicheMatiere
  /** Short queries fanned out in parallel to assemble the grounding pool. */
  searchSeeds: string[]
}

export const FICHE_THEMES: LegalFicheTheme[] = [
  // Droit des obligations (coefficient 2, épreuve écrite obligatoire)
  { id: 'formation-contrat', label: 'Formation du contrat', matiere: 'obligations',
    searchSeeds: ['conditions validité contrat 1128', 'consentement capacité contenu licite'] },
  { id: 'vices-consentement', label: 'Vices du consentement', matiere: 'obligations',
    searchSeeds: ['vices du consentement erreur dol violence 1130', 'nullité relative contrat 1131', 'réticence dolosive'] },
  { id: 'resp-contractuelle', label: 'Responsabilité contractuelle', matiere: 'obligations',
    searchSeeds: ['responsabilité contractuelle inexécution 1231-1', 'dommages-intérêts mise en demeure', 'clauses limitatives de réparation'] },
  { id: 'resp-delictuelle', label: 'Responsabilité délictuelle', matiere: 'obligations',
    searchSeeds: ['responsabilité délictuelle faute 1240', 'responsabilité du fait des choses 1242', 'arrêt Blieck garde autrui'] },
  { id: 'regime-obligations', label: 'Régime général des obligations', matiere: 'obligations',
    searchSeeds: ['régime général obligations cession créance 1321', 'paiement 1342 extinction', 'subrogation personnelle'] },
  { id: 'force-majeure', label: 'Force majeure et imprévision', matiere: 'obligations',
    searchSeeds: ['force majeure 1218 extériorité imprévisibilité irrésistibilité', 'imprévision 1195 révision contrat'] },

  // Droit civil (spécialité)
  { id: 'autorite-parentale', label: 'Autorité parentale', matiere: 'civil',
    searchSeeds: ['autorité parentale intérêt enfant 371-1', 'résidence alternée'] },
  { id: 'regimes-matrimoniaux', label: 'Régimes matrimoniaux', matiere: 'civil',
    searchSeeds: ['régime légal communauté réduite aux acquêts 1401', 'contribution aux charges du mariage'] },
  { id: 'successions-liberalites', label: 'Successions et libéralités', matiere: 'civil',
    searchSeeds: ['réserve héréditaire quotité disponible 912', 'rapport des libéralités partage'] },

  // Droit pénal (spécialité)
  { id: 'element-moral', label: 'Élément moral de l\'infraction', matiere: 'penal',
    searchSeeds: ['élément moral intention 121-3 code pénal', 'faute d\'imprudence dol général'] },
  { id: 'complicite', label: 'Complicité et coaction', matiere: 'penal',
    searchSeeds: ['complicité 121-7 aide assistance provocation', 'coaction emprunt de criminalité'] },
  { id: 'causes-irresponsabilite', label: 'Causes d\'irresponsabilité pénale', matiere: 'penal',
    searchSeeds: ['légitime défense 122-5', 'état de nécessité 122-7', 'contrainte 122-2'] },

  // Droit des affaires (spécialité)
  { id: 'societes-abus', label: 'Abus de majorité et de minorité', matiere: 'affaires',
    searchSeeds: ['abus majorité intérêt social associés minoritaires', 'abus minorité décision vitale'] },
  { id: 'procedures-collectives', label: 'Procédures collectives', matiere: 'affaires',
    searchSeeds: ['sauvegarde redressement liquidation judiciaire L620-1', 'cessation des paiements'] },
  { id: 'baux-commerciaux', label: 'Baux commerciaux', matiere: 'affaires',
    searchSeeds: ['bail commercial propriété commerciale L145-1', 'déplafonnement loi Pinel'] },

  // Droit social (spécialité)
  { id: 'licenciement-personnel', label: 'Licenciement pour motif personnel', matiere: 'social',
    searchSeeds: ['cause réelle sérieuse L1232-1', 'faute grave lourde licenciement'] },
  { id: 'licenciement-economique', label: 'Licenciement pour motif économique', matiere: 'social',
    searchSeeds: ['licenciement économique L1233-3 réorganisation compétitivité', 'plan sauvegarde emploi PSE'] },
  { id: 'harcelement-moral', label: 'Harcèlement moral et obligation de sécurité', matiere: 'social',
    searchSeeds: ['harcèlement moral L1152-1', 'obligation de sécurité employeur L4121-1'] },

  // Droit administratif (spécialité)
  { id: 'responsabilite-administrative', label: 'Responsabilité administrative', matiere: 'administratif',
    searchSeeds: ['responsabilité administrative faute service arrêt Blanco', 'responsabilité sans faute rupture égalité'] },
  { id: 'rep-rec-abus-pouvoir', label: 'Recours pour excès de pouvoir', matiere: 'administratif',
    searchSeeds: ['recours excès de pouvoir délai deux mois', 'moyens légalité externe interne'] },
  { id: 'contrats-administratifs', label: 'Contrats administratifs', matiere: 'administratif',
    searchSeeds: ['contrat administratif critère jurisprudentiel', 'théorie imprévision CE 1916 Gaz de Bordeaux'] },

  // Droit fiscal (spécialité)
  { id: 'controle-fiscal', label: 'Contrôle fiscal et procédures', matiere: 'fiscal',
    searchSeeds: ['contrôle fiscal vérification comptabilité L10 LPF', 'redressement contradictoire'] },
  { id: 'fiscalite-entreprise', label: 'Fiscalité de l\'entreprise', matiere: 'fiscal',
    searchSeeds: ['impôt sur les sociétés régime mère-fille 145', 'TVA territorialité déduction'] },

  // Droit immobilier (spécialité)
  { id: 'vente-immobiliere', label: 'Vente immobilière et vices cachés', matiere: 'immobilier',
    searchSeeds: ['vente immobilière vices cachés 1641', 'garantie décennale construction 1792'] },
  { id: 'copropriete', label: 'Copropriété', matiere: 'immobilier',
    searchSeeds: ['copropriété loi 1965 assemblée générale', 'charges parties communes'] },

  // Procédures (coefficient 1, au choix du candidat)
  { id: 'procedure-civile-competence', label: 'Compétence et procédure civile', matiere: 'procedure-civile',
    searchSeeds: ['compétence matérielle territoriale tribunal judiciaire', 'exception de procédure fin de non-recevoir'] },
  { id: 'procedure-civile-recours', label: 'Voies de recours civiles', matiere: 'procedure-civile',
    searchSeeds: ['appel effet dévolutif 561', 'pourvoi en cassation moyens'] },
  { id: 'procedure-penale-gav', label: 'Garde à vue et instruction', matiere: 'procedure-penale',
    searchSeeds: ['garde à vue 62-2 code procédure pénale droits', 'nullité procédure pénale'] },
  { id: 'procedure-penale-recours', label: 'Voies de recours pénales', matiere: 'procedure-penale',
    searchSeeds: ['appel correctionnel 496', 'pourvoi en cassation chambre criminelle'] },
  { id: 'procedure-admin-referes', label: 'Référés administratifs', matiere: 'procedure-administrative',
    searchSeeds: ['référé liberté L521-2 CJA urgence liberté fondamentale', 'référé suspension L521-1'] },
  { id: 'procedure-admin-plein-contentieux', label: 'Plein contentieux administratif', matiere: 'procedure-administrative',
    searchSeeds: ['plein contentieux contrat responsabilité', 'contentieux contractuel Tropic Béziers'] },

  // Libertés et droits fondamentaux (Grand Oral)
  { id: 'libertes-fondamentales', label: 'Libertés fondamentales', matiere: 'libertes',
    searchSeeds: ['liberté fondamentale Conseil constitutionnel bloc', 'article 66 constitution liberté individuelle'] },
  { id: 'cedh-conventionnalite', label: 'CEDH et contrôle de conventionnalité', matiere: 'libertes',
    searchSeeds: ['Convention européenne droits de l\'homme article 6 procès équitable', 'contrôle conventionnalité Jacques Vabre 1975'] },
  { id: 'qpc', label: 'Question prioritaire de constitutionnalité', matiere: 'libertes',
    searchSeeds: ['QPC article 61-1 Constitution procédure', 'Conseil constitutionnel QPC décision'] },
]

export function findThemeById(id: string): LegalFicheTheme | undefined {
  return FICHE_THEMES.find(t => t.id === id)
}

// ─── Generation prompt ───────────────────────────────────────────

export interface LegalFicheUserCoursChunk {
  chunkId: string
  documentTitle?: string
  content: string
}

export interface LegalFicheGenerationConfig {
  /** Human label — the theme being summarized (e.g., "Vices du consentement"). */
  theme: string
  /** Matiere is surfaced to the model so it can adapt register & references. */
  matiere?: FicheMatiere
  /** Legal pool — real articles + cases. MUST be non-empty in practice. */
  groundingPool: CasPratiqueGroundingEntry[]
  /** User's own cours chunks. Empty array when she has no cours — generation still works. */
  userCoursChunks: LegalFicheUserCoursChunk[]
  /** Verification failures from a previous attempt, fed back for retry. */
  previousFailures?: string[]
  /** Free-text query if source='custom'. Overrides theme framing when present. */
  customQuery?: string
}

export function buildLegalFicheGenerationPrompt(
  config: LegalFicheGenerationConfig,
): { system: string; user: string } {
  const poolBlock = config.groundingPool.length > 0
    ? config.groundingPool
        .map((e, i) => `[${i}] ${e.codeName}, Art. ${e.articleNum}${e.breadcrumb ? ` (${e.breadcrumb})` : ''}\n${e.text}`)
        .join('\n\n')
    : '(pool vide — impossible de rédiger une fiche fiable sans sources juridiques)'

  const coursBlock = config.userCoursChunks.length > 0
    ? config.userCoursChunks
        .map((c, i) => `[COURS-${i}]${c.documentTitle ? ` Source : ${c.documentTitle}` : ''}\n${c.content}`)
        .join('\n\n---\n\n')
    : '(la candidate n\'a pas encore téléversé de cours — rédige une fiche générique de qualité sans t\'inventer des positions doctrinales attribuées à un professeur inconnu)'

  const failuresBlock = config.previousFailures?.length
    ? `\n\n## CORRECTIONS À APPORTER PAR RAPPORT À LA GÉNÉRATION PRÉCÉDENTE
La version précédente a échoué à la vérification pour ces raisons :
${config.previousFailures.map(f => `- ${f}`).join('\n')}
Corrige impérativement ces points dans cette nouvelle version.`
    : ''

  const system = `Tu rédiges une FICHE DE RÉVISION CRFPA de niveau "wall-worthy" pour une candidate au barreau. Tu vises la qualité des meilleures fiches de fiches-droit.com, IEJ Paris 1 Sorbonne, et les fiches d'Aurélien Bamdé (Gdroit), en format CRFPA (plus dense et plus orienté épreuve).

## OBJECTIF
Produire un document Markdown de 2 500 à 4 000 mots qui tient en 2 pages imprimées et couvre TOUT ce qu'une candidate doit savoir sur le thème. Une fiche qu'elle colle au mur, emporte à la bibliothèque, relit la veille de l'oral.

## RÈGLES DE CITATION ABSOLUES

1. **Zéro référence fabriquée.** Chaque article, arrêt, ECLI, date, numéro de pourvoi doit provenir EXACTEMENT du "Pool de références autorisées" fourni. Si une notion exigerait une référence absente du pool, adapte la rédaction (reformule en principe général) plutôt que d'inventer.
2. **Numéros de pourvoi OBLIGATOIRES** pour chaque arrêt cité : « Cass. com., 29 juin 2010, n° 09-11.841, *Faurecia 2* ». Jamais « arrêt Faurecia 2010 » seul.
3. **Chambre TOUJOURS précisée** : « Cass. 1re civ. », « Ass. plén. », « Ch. mixte », « CE, Sect. », « CE, Ass. ». Jamais « Cour de cassation » seul.
4. **Articles post-réforme flaggés** : pour toute matière réformée récemment (oblig. 2016, resp. civile 2024, etc.), indique systématiquement « Art. 1231-1 [nouv.] (anc. 1147) » avec la date charnière (1er oct. 2016 pour les obligations).
5. **Distingue principe / confirmation / revirement** dans la section Jurisprudence. Les revirements sont marqués explicitement (ex : « Revirement : Cass. 3e civ., 3 déc. 2003, n° 02-05.204, renverse Cass. 3e civ., 15 mai 2002 »).
6. Si la candidate a téléversé ses cours (section "Cours de la candidate" ci-dessous), tu les PRIVILÉGIES en cas de conflit avec la doctrine générique — mais tu ne cites jamais verbatim plus de 100 mots d'un extrait. Au-delà de 100 mots, paraphrase fidèlement en marquant la position comme provenant du cours (sans jamais attribuer la position à « ton professeur » ou à un auteur précis que le cours ne nomme pas).
7. Pour la sous-section **« Actualité (< 18 mois) »** : si le pool fourni contient moins de 2 arrêts ayant une date identifiable de moins de 18 mois sur ce thème, remplace le contenu de cette sous-section par UNIQUEMENT la ligne-marqueur ci-dessous (rien d'autre, pas de texte alentour) :

\`\`\`
<!-- ACTUALITE_WEB_PENDING -->
\`\`\`

Un processus asynchrone consultera des sources juridiques officielles pour compléter cette sous-section après la génération. N'invente JAMAIS d'arrêts récents pour remplir cette sous-section.

## STRUCTURE OBLIGATOIRE (H2 + H3, jamais H4 ou plus)

# {Titre — nom exact du thème}

## Cadre
1-2 phrases situant la notion dans sa branche du droit et pointant la question centrale.

## Définition
1 paragraphe, style Dalloz L'essentiel : quotable, précis, sans fioritures. Les termes-clés en **gras**.

## Textes fondamentaux
Liste à puces. Chaque entrée : **Art. [numéro] [nouv.]/[anc.]** — code — règle en 1 phrase — date de réforme si < 10 ans.

## Jurisprudence
### Arrêts de principe (★)
Pour chaque arrêt indispensable : **★ Cass. [chambre], [date], n° [pourvoi], *[nom de l'arrêt]*** — apport en 1 ligne.
### Confirmations / précisions
Arrêts qui précisent ou confirment. Format identique, sans étoile.
### Revirements
Quand pertinents. Marqués explicitement.
### Actualité (< 18 mois)
Si des arrêts récents du pool datent de moins de 18 mois, les mettre ici avec leur apport. Sinon, omettre la sous-section.

## Régime juridique
### Conditions
Liste à puces des conditions cumulatives ou alternatives (précise-le). Chaque condition en 1-2 lignes.
### Mise en œuvre
Qui agit, charge de la preuve, délai de prescription, juridiction compétente.
### Effets / Sanctions
Ce qui se passe quand les conditions sont réunies.
### Exceptions et aménagements conventionnels
Les dérogations légales ou les clauses contractuelles possibles.

## Distinctions
Ce que la notion n'est PAS. Tableau ou puces contrastives avec les notions voisines (ex : nullité ≠ résolution ; erreur ≠ dol).

## Controverses doctrinales
1 à 3 points de désaccord entre auteurs (sans citer de noms d'auteurs que le pool ne fournit pas). Formule : « Une partie de la doctrine estime que... ; d'autres au contraire soutiennent que... ».

## Pièges classiques
Liste à puces des erreurs typiques au CRFPA sur ce thème (application de l'ancien article à un contrat post-réforme, confusion de régimes, oubli de la mise en demeure, etc.).

## Méthodologie CRFPA
Comment la notion tombe au cas pratique (syllogisme-clé à retenir), à la note de synthèse (documents typiquement associés), et éventuellement au grand oral.

## Voir aussi
Liste courte de thèmes connexes (noms uniquement, sans liens hypertextes — le rendu les lie automatiquement).

## REGISTRE ET STYLE
- Français juridique soutenu, 3e personne, AUCUN tutoiement, AUCUN « nous » ou « vous ».
- AUCUN emoji. AUCUNE question rhétorique. AUCUNE phrase d'introduction générale du type « Dans ce document, nous allons... ».
- **Gras** : définitions, numéros d'articles, noms d'arrêts à leur première apparition, mots-clés des conditions.
- *Italique* : noms d'arrêts et expressions latines (*intuitu personae*, *a fortiori*, *sui generis*).
- Tableaux autorisés uniquement pour comparaisons binaires (ancien/nouveau article, obligation de moyens/de résultat). Maximum 1 tableau par fiche.
- PAS de section "Mnémotechniques" — c'est une pratique personnelle, pas un contenu de fiche.
- PAS de "fun facts", pas d'anecdotes historiques sauf si strictement doctrinales.

## SORTIE
Renvoie UNIQUEMENT le Markdown de la fiche. Aucune prose introductive ou conclusive hors du document. Aucune fence Markdown englobante. Commence directement par le titre \`# {Thème}\`.${failuresBlock}`

  const themeDescriptor = config.customQuery
    ? `THÈME (rédaction libre de la candidate) : ${config.customQuery}
Titre à utiliser : ${config.theme}`
    : `THÈME : ${config.theme}${config.matiere ? `\nMATIÈRE : ${config.matiere}` : ''}`

  const user = `${themeDescriptor}

POOL DE RÉFÉRENCES AUTORISÉES (articles + jurisprudence — seule source citable) :
---
${poolBlock}
---

COURS DE LA CANDIDATE (à privilégier en cas de conflit, mais ne jamais inventer ni attribuer à un auteur que le cours ne nomme pas) :
---
${coursBlock}
---

Rédige maintenant la fiche de révision CRFPA complète, en respectant STRICTEMENT la structure, le registre et les règles de citation. Commence directement par \`# ${config.theme}\`.`

  return { system, user }
}

// ─── Tavily domain allowlist (per matière) ───────────────────────

/**
 * Authoritative French legal sources for the web-search actualité pass.
 * DELIBERATELY conservative: courts + official + Dalloz Actualité.
 * No commentary-heavy sites (village-justice.com etc.) by default.
 * The Tavily endpoint re-checks this list server-side to prevent bypass.
 */
export const TAVILY_DOMAINS: Record<FicheMatiere, string[]> = {
  obligations:                  ['courdecassation.fr', 'legifrance.gouv.fr', 'dalloz-actualite.fr'],
  civil:                        ['courdecassation.fr', 'legifrance.gouv.fr', 'dalloz-actualite.fr'],
  penal:                        ['courdecassation.fr', 'legifrance.gouv.fr', 'dalloz-actualite.fr'],
  affaires:                     ['courdecassation.fr', 'legifrance.gouv.fr', 'dalloz-actualite.fr'],
  social:                       ['courdecassation.fr', 'legifrance.gouv.fr', 'dalloz-actualite.fr', 'travail-emploi.gouv.fr'],
  administratif:                ['conseil-etat.fr', 'legifrance.gouv.fr', 'dalloz-actualite.fr'],
  fiscal:                       ['legifrance.gouv.fr', 'impots.gouv.fr', 'dalloz-actualite.fr'],
  immobilier:                   ['courdecassation.fr', 'legifrance.gouv.fr', 'dalloz-actualite.fr'],
  'procedure-civile':           ['courdecassation.fr', 'legifrance.gouv.fr'],
  'procedure-penale':           ['courdecassation.fr', 'legifrance.gouv.fr'],
  'procedure-administrative':   ['conseil-etat.fr', 'legifrance.gouv.fr'],
  libertes:                     ['conseil-constitutionnel.fr', 'conseil-etat.fr', 'legifrance.gouv.fr', 'echr.coe.int'],
}

/** Convenience — flat union of every allowed domain across matières. */
export const TAVILY_ALL_DOMAINS: string[] = [
  ...new Set(Object.values(TAVILY_DOMAINS).flat()),
]

// ─── Actualité enrichment prompt ─────────────────────────────────

export const ACTUALITE_MARKER = '<!-- ACTUALITE_WEB_PENDING -->'

export interface LegalFicheActualiteTavilyResult {
  url: string
  title: string
  content: string                        // snippet returned by Tavily
  publishedDate?: string                 // ISO if Tavily provided one
}

export interface LegalFicheActualiteConfig {
  theme: string
  matiere: FicheMatiere
  tavilyResults: LegalFicheActualiteTavilyResult[]
}

export function buildLegalFicheActualitePrompt(
  config: LegalFicheActualiteConfig,
): { system: string; user: string } {
  const allowed = TAVILY_DOMAINS[config.matiere].join(', ')

  const system = `Tu synthétises des actualités juridiques récentes en une sous-section « Actualité (< 18 mois) » pour une fiche de révision CRFPA.

Règles :
1. Tu t'appuies UNIQUEMENT sur les extraits fournis ci-dessous. Aucune référence, date, ou numéro de pourvoi hors de ces extraits n'est autorisé.
2. Tu cites UNIQUEMENT des URL dont le domaine figure dans la liste autorisée : ${allowed}. Toute autre URL est INTERDITE.
3. Tu produis entre 2 et 4 entrées, triées de la plus récente à la plus ancienne.
4. Chaque entrée suit le format : \`- **[Juridiction], [date], [n° pourvoi si identifiable]** — [apport en 1 phrase] ([source](URL))\`.
5. Si un extrait ne permet pas d'identifier clairement la juridiction, la date OU l'apport, tu l'IGNORES. Mieux vaut renvoyer 2 entrées fiables que 4 approximatives.
6. Français juridique soutenu. 3e personne. Aucun emoji. Aucune introduction (pas de phrase du type « Voici les actualités récentes »).
7. Tu renvoies UNIQUEMENT le Markdown des entrées en liste à puces. PAS d'en-tête \`### Actualité\`. PAS de texte autour. PAS de fence Markdown englobante.
8. Si aucun extrait n'est exploitable avec ces règles, renvoie exactement la ligne : \`*Aucune actualité récente identifiable dans les sources consultées.*\``

  const resultsBlock = config.tavilyResults.length > 0
    ? config.tavilyResults.map((r, i) => {
        const date = r.publishedDate ? ` (publié le ${r.publishedDate})` : ''
        return `[${i}] ${r.title}${date}\nURL : ${r.url}\n${r.content}`
      }).join('\n\n---\n\n')
    : '(aucun résultat)'

  const user = `THÈME : ${config.theme}
MATIÈRE : ${config.matiere}

EXTRAITS TAVILY (sources juridiques officielles, < 18 mois) :
---
${resultsBlock}
---

Rédige maintenant la sous-section « Actualité » en Markdown, suivant strictement le format et les règles. Ne renvoie que les entrées en liste à puces (ou la ligne de repli si aucun extrait n'est exploitable).`

  return { system, user }
}

// ─── Verification prompt ─────────────────────────────────────────

export interface LegalFicheVerificationConfig {
  groundingPool: CasPratiqueGroundingEntry[]
  userCoursChunks: LegalFicheUserCoursChunk[]
  ficheMarkdown: string
}

export interface LegalFicheVerificationIssue {
  citation: string
  claim: string
  reason: string
  /** 'invented' = not in pool; 'misrepresented' = in pool but content is wrong; 'cours-fabricated' = attributes a quote/position to her cours that doesn't appear there. */
  severity: 'invented' | 'misrepresented' | 'cours-fabricated'
}

export interface LegalFicheVerificationResult {
  passed: boolean
  issues: LegalFicheVerificationIssue[]
}

export function buildLegalFicheVerificationPrompt(
  config: LegalFicheVerificationConfig,
): { system: string; user: string } {
  const system = `Tu es un vérificateur juridique rigoureux. Ta seule tâche est de détecter les RÉFÉRENCES FABRIQUÉES ou DÉNATURÉES dans une fiche de révision.

Règles :
1. Tu ne juges PAS la qualité pédagogique, le style, la complétude ou l'équilibre des sections — uniquement l'exactitude des citations.
2. Le "Pool de références autorisées" est la liste FINIE des articles et décisions que la fiche peut citer. Tout article, numéro de pourvoi, ECLI, date précise présenté comme une source et absent du pool est FABRIQUÉ (severity: "invented").
3. Une référence qui figure dans le pool mais dont le contenu affirmé dans la fiche CONTREDIT le texte du pool est DÉNATURÉE (severity: "misrepresented").
4. Toute citation verbatim présentée entre guillemets comme venant des "cours de la candidate" doit APPARAÎTRE littéralement dans la liste "Cours de la candidate" fournie. Sinon : severity "cours-fabricated".
5. Une paraphrase large d'un principe général (« le principe de loyauté contractuelle », « l'autonomie de la volonté ») sans rattachement à un numéro précis n'est PAS une fabrication.
6. Si aucun problème détecté : passed=true, issues=[].
7. Tu renvoies UNIQUEMENT du JSON strict. Aucun texte hors JSON. Aucune fence Markdown. Aucun emoji.`

  const poolBlock = config.groundingPool
    .map((e, i) => `[${i}] ${e.codeName}, Art. ${e.articleNum}${e.breadcrumb ? ` (${e.breadcrumb})` : ''}\n${e.text}`)
    .join('\n\n')

  const coursBlock = config.userCoursChunks.length > 0
    ? config.userCoursChunks
        .map((c, i) => `[COURS-${i}]${c.documentTitle ? ` Source : ${c.documentTitle}` : ''}\n${c.content}`)
        .join('\n\n---\n\n')
    : '(aucun cours téléversé — toute citation attribuée à "mon cours" ou similaire est cours-fabricated)'

  const user = `Vérifie les références juridiques citées dans la FICHE ci-dessous.

POOL DE RÉFÉRENCES AUTORISÉES :
---
${poolBlock}
---

COURS DE LA CANDIDATE :
---
${coursBlock}
---

FICHE À VÉRIFIER :
---
${config.ficheMarkdown}
---

Passe en revue :
- CHAQUE numéro d'article cité (« Art. 1231-1 », « article L. 145-1 », etc.) : existe-t-il dans le pool avec le même code et le même numéro ?
- CHAQUE arrêt cité (« Cass. com., 29 juin 2010, n° 09-11.841 ») : chambre + date + pourvoi matchent-ils une entrée du pool ?
- CHAQUE contenu affirmé qui cite un article/arrêt précis : correspond-il au texte du pool ?
- CHAQUE citation verbatim entre guillemets attribuée aux cours de la candidate : apparaît-elle littéralement dans les extraits de cours fournis ?

Retourne ce JSON strict :

{
  "passed": true,
  "issues": []
}

ou :

{
  "passed": false,
  "issues": [
    {
      "citation": "Art. 1131 Code civil",
      "claim": "dispose que le contrat est nul à défaut de cause",
      "reason": "Article 1131 absent du pool ; par ailleurs, l'article 1131 du code civil actuel ne porte pas sur la cause, abrogée par l'ord. 10 fév. 2016.",
      "severity": "invented"
    }
  ]
}`

  return { system, user }
}
