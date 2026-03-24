/**
 * Prompt templates for Type B document exam generation (CPGE concours-style).
 *
 * Each subject (maths, physique, informatique) has a dedicated prompt template.
 * Each concours (X, Mines, Centrale, CCINP) has a calibration profile that gets injected.
 * Prompts were validated with the user before implementation.
 */

// ─── Types ─────────────────────────────────────────────────────

export type DocumentExamSubject = 'maths-algebre' | 'maths-analyse' | 'physique' | 'informatique'
export type ConcoursType = 'polytechnique' | 'mines' | 'centrale' | 'ccinp'

export interface DocumentExamPromptConfig {
  subject: DocumentExamSubject
  concours: ConcoursType
  topics: string[]
  sourceExcerpts?: string
  avoidThemes?: string[]
  language?: 'fr' | 'en'
}

// ─── Concours Profiles ─────────────────────────────────────────

const CONCOURS_PROFILES: Record<ConcoursType, string> = {
  polytechnique: `PROFIL DU CONCOURS : Polytechnique (X) — Filière MP
- Durée : 4 heures
- Difficulté : Très élevée. Le sujet atteint le niveau recherche.
- 4 parties, 15 à 20 questions. Peu de questions mais chacune demande une réflexion profonde.
- Les questions "faciles" du début sont déjà au niveau d'une question médiane de Mines.
- Le sujet peut croiser plusieurs domaines de façon inattendue (algèbre + probabilités, analyse + géométrie).
- Rigueur extrême attendue. Aucune indication superflue.
- Le théorème cible est un résultat profond, souvent de niveau M2/recherche.`,

  mines: `PROFIL DU CONCOURS : Mines-Ponts — Filière MP
- Durée : 3 heures
- Difficulté : Élevée. Théorème réel non trivial.
- 4 parties, 18 à 25 questions. Progression guidée mais soutenue.
- Les premières questions de chaque partie sont accessibles (vérifications, cas particuliers).
- La difficulté monte progressivement dans chaque partie.
- La partie IV combine les résultats des parties précédentes, souvent par récurrence.`,

  centrale: `PROFIL DU CONCOURS : Centrale-Supélec — Filière MP
- Durée : 4 heures
- Difficulté : Modérée par question, mais sujet TRÈS long (30 à 40 questions).
- 4 à 5 parties. Beaucoup de calculs explicites et d'applications directes.
- Teste la rapidité et l'endurance autant que la compréhension.
- Moins abstrait que X/Mines : plus de calculs, plus de cas concrets.
- Les questions sont plus courtes et plus directes.
- Un bon candidat ne finit pas le sujet — la sélection se fait sur la quantité traitée correctement.`,

  ccinp: `PROFIL DU CONCOURS : CCINP — Filière MP
- Durée : 3 heures
- Difficulté : Accessible. Théorèmes classiques du programme.
- 3 à 4 parties, 15 à 20 questions.
- Questions plus guidées avec des indications fréquentes ("On pourra commencer par...", "On admettra que...").
- La correction est TRÈS stricte sur la qualité de rédaction et la justification.
- Un résultat correct mais mal justifié vaut zéro.
- Le sujet reste dans le programme strict, pas de hors-programme.`,
}

// ─── Subject Prompts ───────────────────────────────────────────

function buildMathsPrompt(config: DocumentExamPromptConfig): { system: string; user: string } {
  const domain = config.subject === 'maths-analyse'
    ? `Analyse. Choisis un théorème adapté au niveau ${concoursDisplayName(config.concours)} MP dans l'un des domaines suivants : séries et séries de fonctions, intégrales à paramètre, espaces de fonctions, équations différentielles, calcul différentiel, topologie des espaces métriques, ou un croisement de ces domaines.`
    : `Algèbre linéaire. Choisis un théorème adapté au niveau ${concoursDisplayName(config.concours)} MP. Évite le théorème de Gerstenhaber sur les endomorphismes nilpotents (déjà utilisé en 2020).`

  const topicHint = config.topics.length > 0
    ? `\n\nLes sujets étudiés par le candidat incluent : ${config.topics.join(', ')}. Tu peux choisir un thème qui touche un ou plusieurs de ces domaines.`
    : ''

  const avoidHint = config.avoidThemes && config.avoidThemes.length > 0
    ? `\n\nÉvite les thèmes suivants, déjà utilisés dans des épreuves récentes : ${config.avoidThemes.join(', ')}.`
    : ''

  const sourceHint = config.sourceExcerpts
    ? `\n\nVoici des extraits du cours du candidat. Tu peux t'en inspirer pour choisir un thème qui correspond à ce qu'il étudie, mais ne copie pas les exercices tels quels :\n\n${config.sourceExcerpts}`
    : ''

  const system = `Tu es un professeur de mathématiques agrégé, membre du jury du concours ${concoursDisplayName(config.concours)}, chargé de concevoir l'épreuve de Mathématiques pour la filière MP.

Tu dois produire un SUJET D'ÉPREUVE COMPLET — un document mathématique continu de 5 à 6 pages, PAS une liste de questions indépendantes. Le sujet est UN problème unique qui guide le candidat vers la démonstration d'un théorème non trivial.

## ${CONCOURS_PROFILES[config.concours]}

## CONTRAINTES DE FORMAT

- Tout le contenu mathématique est en LaTeX (délimiteurs $...$ et $$...$$)
- Calculatrice et tout dispositif électronique interdits

## STRUCTURE OBLIGATOIRE

1. **En-tête** : Titre du problème (un thème mathématique précis)

2. **Préambule** : Un paragraphe posant le cadre général, les notations qui seront utilisées dans tout le sujet, et les définitions des objets centraux. Les termes définis sont en **gras**.

3. **Énoncé du théorème cible** : Le théorème que le problème vise à démontrer, énoncé formellement. Ce théorème doit être un résultat RÉEL de mathématiques (publié, avec auteur et date si possible).

4. **Paragraphe de navigation** : "Les trois premières parties sont largement indépendantes les unes des autres. La partie I est constituée de... Dans la partie II... Dans la partie III... Dans la partie IV, les résultats des parties précédentes sont combinés pour établir le théorème de [X]."

5. **Parties I à IV** : Chaque partie a :
   - Un titre (ex: "I  Généralités sur les endomorphismes nilpotents")
   - Un paragraphe d'introduction posant le cadre spécifique de la partie (nouvelles hypothèses, nouveaux objets, nouvelles notations)
   - Des questions numérotées séquentiellement (la numérotation continue entre parties)

6. **"Fin du problème."** à la fin

## STYLE DES QUESTIONS

- Jamais de QCM. Les questions sont TOUJOURS de la forme :
  - "Montrer que..." / "Démontrer que..."
  - "Justifier que..."
  - "En déduire que..." (résultat qui découle de la question précédente)
  - "Déterminer..." / "Calculer..."
  - "Donner une expression simplifiée de..."
  - "Conclure." (sans préciser quoi — le candidat doit comprendre)

- Les questions s'enchaînent : le résultat de la question k est utilisé dans la question k+1 ou une question ultérieure
- Les renvois explicites sont de la forme : "On pourra utiliser les résultats des questions 5 et 20."
- La dernière question de chaque partie est plus difficile et synthétise les résultats précédents

## CONSTRUCTION MATHÉMATIQUE

- Le domaine doit être au programme de MP : algèbre linéaire, algèbre bilinéaire, analyse (séries, intégrales, espaces de fonctions), topologie, probabilités, ou un croisement de ces domaines
- Le théorème cible doit être un résultat RÉEL, NON TRIVIAL, idéalement d'un mathématicien identifiable
- Les premières questions de chaque partie sont accessibles (vérifications directes, cas particuliers, calculs de dimension)
- La difficulté monte progressivement au sein de chaque partie
- La Partie IV est la plus technique : elle combine les outils des parties précédentes pour la preuve finale, souvent par récurrence
- Introduire des notations et objets ENTRE les questions (pas dans les questions elles-mêmes) quand de nouveaux concepts sont nécessaires`

  const user = `## THÈME DEMANDÉ

${domain}${topicHint}${avoidHint}${sourceHint}

## CE QUE TU DOIS PRODUIRE

Produis le sujet d'épreuve complet en Markdown avec LaTeX. Ce document doit être DIRECTEMENT utilisable comme énoncé d'épreuve. Il doit ressembler exactement à un vrai sujet ${concoursDisplayName(config.concours)} : même ton, même rigueur, même densité mathématique, même progression.

Ne produis PAS de corrigé, PAS de barème, PAS de commentaires. Uniquement l'énoncé.`

  return { system, user }
}

function buildPhysiquePrompt(config: DocumentExamPromptConfig): { system: string; user: string } {
  const topicHint = config.topics.length > 0
    ? `Choisis un système physique qui met en jeu les domaines suivants étudiés par le candidat : ${config.topics.join(', ')}.`
    : `Choisis un système physique adapté au niveau ${concoursDisplayName(config.concours)} MP qui met en jeu au moins deux domaines du programme.`

  const avoidHint = config.avoidThemes && config.avoidThemes.length > 0
    ? `\n\nÉvite les systèmes suivants, déjà utilisés récemment : ${config.avoidThemes.join(', ')}.`
    : ''

  const sourceHint = config.sourceExcerpts
    ? `\n\nVoici des extraits du cours du candidat pour grounding :\n\n${config.sourceExcerpts}`
    : ''

  const system = `Tu es un professeur de physique agrégé, membre du jury du concours ${concoursDisplayName(config.concours)}, chargé de concevoir une épreuve de Physique pour la filière MP.

Tu dois produire un SUJET D'ÉPREUVE COMPLET — un problème de physique continu de 5 à 7 pages centré sur l'étude d'un SYSTÈME PHYSIQUE RÉEL.

## ${CONCOURS_PROFILES[config.concours]}

## CONTRAINTES DE FORMAT

- Calculatrice autorisée
- Tout le contenu mathématique en LaTeX (délimiteurs $...$ et $$...$$)
- Les vecteurs sont notés $\\vec{v}$ ou $\\mathbf{v}$
- Les unités sont toujours précisées

## STRUCTURE OBLIGATOIRE

1. **Titre** : Décrit le système physique étudié

2. **Introduction** : 1 à 2 paragraphes décrivant le contexte physique réel du problème

3. **Données numériques** : Un bloc listant toutes les constantes et valeurs numériques

4. **Paragraphe de navigation** : "Le problème comporte quatre parties largement indépendantes..."

5. **Parties I à IV** : Chaque partie a :
   - Un titre décrivant l'aspect du système étudié
   - Un paragraphe d'introduction posant les hypothèses et le modèle
   - Des questions numérotées séquentiellement
   - [FIGURE : description précise] quand un schéma est nécessaire

6. **"Fin du problème."** à la fin

## STYLE DES QUESTIONS

- **Dérivation** : "Établir l'équation différentielle vérifiée par $x(t)$."
- **Expression** : "Exprimer $\\omega_0$ en fonction de $k$, $m$ et $L$."
- **Application numérique** : "Faire l'application numérique." ou "A.N."
- **Interprétation** : "Interpréter physiquement ce résultat."
- **Vérification** : "Vérifier l'homogénéité de l'expression obtenue."
- **Approximation** : "À quelle condition peut-on négliger le terme en $x^3$ ?"
- **Représentation** : "Représenter l'allure de $V(r)$ en fonction de $r$."

Chaque partie doit contenir au moins une application numérique et au moins une question d'interprétation physique.

## CONSTRUCTION PHYSIQUE

- Le système étudié doit être un système RÉEL
- Domaines au programme MP : mécanique, thermodynamique, électromagnétisme, optique ondulatoire, physique quantique introductive, mécanique des fluides, électrocinétique
- Le problème doit croiser au moins 2 domaines de la physique
- Les ordres de grandeur doivent être réalistes`

  const user = `## THÈME DEMANDÉ

${topicHint}${avoidHint}${sourceHint}

## CE QUE TU DOIS PRODUIRE

Produis le sujet d'épreuve complet en Markdown avec LaTeX. Le document doit ressembler exactement à un vrai sujet ${concoursDisplayName(config.concours)} Physique.

Ne produis PAS de corrigé, PAS de barème, PAS de commentaires. Uniquement l'énoncé.`

  return { system, user }
}

function buildInformatiquePrompt(config: DocumentExamPromptConfig): { system: string; user: string } {
  const topicHint = config.topics.length > 0
    ? `Choisis un thème algorithmique qui touche les domaines suivants étudiés par le candidat : ${config.topics.join(', ')}.`
    : `Choisis un thème algorithmique adapté au niveau ${concoursDisplayName(config.concours)} MP.`

  const avoidHint = config.avoidThemes && config.avoidThemes.length > 0
    ? `\n\nÉvite les thèmes suivants, déjà utilisés récemment : ${config.avoidThemes.join(', ')}.`
    : ''

  const sourceHint = config.sourceExcerpts
    ? `\n\nVoici des extraits du cours du candidat :\n\n${config.sourceExcerpts}`
    : ''

  const system = `Tu es un professeur d'informatique agrégé, membre du jury du concours ${concoursDisplayName(config.concours)}, chargé de concevoir l'épreuve d'Informatique pour la filière MP, option informatique.

Tu dois produire un SUJET D'ÉPREUVE COMPLET — un problème d'informatique continu de 5 à 7 pages.

## ${CONCOURS_PROFILES[config.concours]}

## CONTRAINTES DE FORMAT

- Tout le code est en OCaml, présenté dans des blocs \`\`\`ocaml
- Les notations mathématiques sont en LaTeX (délimiteurs $...$ et $$...$$)
- La complexité est notée $O(\\cdot)$, $\\Theta(\\cdot)$, $\\Omega(\\cdot)$
- Les types OCaml sont donnés pour toutes les fonctions demandées

## STRUCTURE OBLIGATOIRE

1. **Titre** : Décrit le thème algorithmique

2. **Préambule** : Paragraphe posant le cadre et les notations

3. **Définitions et types OCaml** : Les types de données utilisés dans tout le sujet

4. **Paragraphe de navigation** : "Les parties I et II sont indépendantes..."

5. **Parties I à IV** : Chaque partie a un titre, une introduction, des questions numérotées

6. **"Fin du problème."** à la fin

## STYLE DES QUESTIONS

- **Code** : "Écrire une fonction \`f : int -> int list -> int\` qui prend en entrée... et renvoie..." — Le type OCaml est TOUJOURS donné.
- **Complexité** : "Quelle est la complexité en temps de la fonction \`f\` dans le pire cas ? Justifier."
- **Preuve** : "Montrer que l'algorithme termine." / "Donner un invariant de boucle pour..."
- **Conception** : "Proposer un algorithme de complexité $O(n \\log n)$ pour résoudre ce problème."
- **Contre-exemple** : "Donner un exemple montrant que l'algorithme glouton ne donne pas toujours la solution optimale."

Le code OCaml doit être SYNTAXIQUEMENT CORRECT et IDIOMATIQUE.

## CONSTRUCTION ALGORITHMIQUE

- Thème au programme MP option info : graphes, arbres, tris, programmation dynamique, automates et langages formels, logique, bases de données
- La partie I pose les bases, la partie II développe un algorithme, la partie III analyse, la partie IV optimise ou généralise
- Questions de code et questions théoriques ENTRELACÉES`

  const user = `## THÈME DEMANDÉ

${topicHint}${avoidHint}${sourceHint}

## CE QUE TU DOIS PRODUIRE

Produis le sujet d'épreuve complet en Markdown avec LaTeX et blocs OCaml. Le document doit ressembler exactement à un vrai sujet ${concoursDisplayName(config.concours)} Informatique.

Ne produis PAS de corrigé, PAS de barème, PAS de commentaires. Uniquement l'énoncé.`

  return { system, user }
}

// ─── Solution Prompt ───────────────────────────────────────────

export function buildSolutionPrompt(documentContent: string): { system: string; user: string } {
  const system = `Tu es un correcteur agrégé. On te donne un sujet d'épreuve de concours. Tu dois produire le corrigé complet avec barème.

Pour CHAQUE question numérotée dans le sujet, produis :
- Le numéro de la question
- La solution complète (en Markdown+LaTeX, même formalisme que le sujet)
- Le barème détaillé : points par critère, erreurs courantes et pénalités

Retourne un tableau JSON avec cette structure exacte :
[
  {
    "questionNumber": 1,
    "modelAnswer": "**Solution.** On a $\\\\text{tr}(u^k) = \\\\sum_{i=1}^n \\\\lambda_i^k$. Puisque $u$ est nilpotent...",
    "markingScheme": {
      "fullMarks": 3,
      "criteria": [
        { "criterion": "Utilisation correcte de la trace", "points": 1 },
        { "criterion": "Exploitation de la nilpotence", "points": 1 },
        { "criterion": "Conclusion rigoureuse", "points": 1 }
      ],
      "commonErrors": [
        { "error": "Oubli du cas k=0", "deduction": 0.5 },
        { "error": "Confusion valeurs propres / coefficients diagonaux", "deduction": 1 }
      ]
    }
  },
  ...
]

IMPORTANT : Couvre TOUTES les questions du sujet, dans l'ordre. Le JSON doit être valide et complet.`

  const user = `Voici le sujet d'épreuve :\n\n${documentContent}\n\nProduis le corrigé complet avec barème pour chaque question. Retourne UNIQUEMENT le tableau JSON, sans texte autour.`

  return { system, user }
}

// ─── Main Builder ──────────────────────────────────────────────

export function buildDocumentExamPrompt(config: DocumentExamPromptConfig): { system: string; user: string } {
  switch (config.subject) {
    case 'maths-algebre':
    case 'maths-analyse':
      return buildMathsPrompt(config)
    case 'physique':
      return buildPhysiquePrompt(config)
    case 'informatique':
      return buildInformatiquePrompt(config)
    default:
      return buildMathsPrompt(config)
  }
}

// ─── Helpers ───────────────────────────────────────────────────

function concoursDisplayName(concours: ConcoursType): string {
  switch (concours) {
    case 'polytechnique': return 'Polytechnique (X)'
    case 'mines': return 'Mines-Ponts'
    case 'centrale': return 'Centrale-Supélec'
    case 'ccinp': return 'CCINP'
  }
}

export const CONCOURS_OPTIONS: Array<{ value: ConcoursType; label: string }> = [
  { value: 'polytechnique', label: 'Polytechnique (X)' },
  { value: 'mines', label: 'Mines-Ponts' },
  { value: 'centrale', label: 'Centrale-Supélec' },
  { value: 'ccinp', label: 'CCINP' },
]

export const SUBJECT_OPTIONS: Array<{ value: DocumentExamSubject; label: string; labelFr: string }> = [
  { value: 'maths-algebre', label: 'Mathematics (Algebra)', labelFr: 'Mathématiques (Algèbre)' },
  { value: 'maths-analyse', label: 'Mathematics (Analysis)', labelFr: 'Mathématiques (Analyse)' },
  { value: 'physique', label: 'Physics', labelFr: 'Physique' },
  { value: 'informatique', label: 'Computer Science', labelFr: 'Informatique' },
]
