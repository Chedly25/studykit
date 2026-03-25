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
    ? `Analyse. Choisis un théorème de niveau recherche dans l'un des domaines suivants : séries et séries de fonctions, intégrales à paramètre, espaces de fonctions, équations différentielles, calcul différentiel, topologie des espaces métriques. Le sujet peut ponctuellement utiliser des outils d'un autre domaine si cela sert la preuve, mais le cœur du sujet doit rester en analyse.`
    : `Algèbre. Choisis un théorème de niveau recherche en algèbre linéaire, algèbre bilinéaire, théorie des groupes, ou polynômes. Le sujet peut ponctuellement utiliser des outils d'un autre domaine si cela sert la preuve, mais le cœur du sujet doit rester en algèbre. Évite le théorème de Gerstenhaber (Mines 2020) et la décomposition de Dunford.`

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

## CE QUI DISTINGUE UN VRAI SUJET DE CONCOURS D'UN DEVOIR DE PRÉPA

Un sujet de concours n'est PAS un enchaînement de résultats de cours. Il a les caractéristiques suivantes :

1. **Théorème cible non trivial** : Le résultat final est un théorème de RECHERCHE, pas un résultat du programme. Exemples : théorème de Gerstenhaber (Mines 2020), théorème de Perron-Frobenius, inégalité de Hadamard par méthode originale. Le candidat ne doit PAS reconnaître le résultat à l'avance.

2. **Questions sans indication** : Au moins 3-4 questions par partie ne donnent AUCUNE indication sur la méthode. Le candidat doit trouver seul l'approche. NE PAS abuser des "On pourra utiliser le résultat de la question N" — réserver ces indications aux 2-3 questions les plus difficiles de la Partie IV uniquement.

3. **Questions où le candidat doit trouver le résultat** : Ne pas uniquement poser des "Montrer que [résultat donné]". Inclure aussi des "Déterminer...", "Que peut-on dire de...", "Exprimer... en fonction de..." où le candidat doit découvrir la réponse.

4. **Sauts de difficulté** : Certaines questions demandent une idée non évidente (changement de point de vue, introduction d'un objet auxiliaire, argument inattendu). Ce ne sont pas des applications directes du cours.

5. **Notations et objets originaux** : Le sujet introduit des objets et notations spécifiques au problème, pas les notations standard du cours. Exemples : $\\mathcal{V}^\\bullet$, $K(\\mathcal{V})$, $a \\otimes x$ défini de façon ad hoc.

6. **Prose mathématique dense entre les questions** : Des paragraphes de 5-10 lignes entre certains blocs de questions, introduisant de nouveaux objets, posant de nouvelles hypothèses, donnant du contexte.

## ERREURS À ÉVITER ABSOLUMENT

- NE PAS choisir comme théorème cible un résultat du programme MP (Cayley-Hamilton, Dunford, spectral, Bolzano-Weierstrass, rang, noyau-image, etc.) — ce sont des OUTILS, pas des CIBLES
- NE PAS mettre "On pourra utiliser..." à chaque question — signe d'un sujet trop guidé
- NE PAS faire uniquement des petites questions prévisibles qui s'enchaînent mécaniquement — inclure des questions qui demandent une vraie idée
- NE PAS rester dans les bornes du cours — le sujet doit aller AU-DELÀ du programme tout en restant accessible avec les outils du programme
- NE PAS faire un sujet qui ressemble à un chapitre de Gourdon ou Roger-Casella

## CONTRAINTES DE FORMAT

- Tout le contenu mathématique est en LaTeX (délimiteurs $...$ et $$...$$)
- Calculatrice et tout dispositif électronique interdits

## STRUCTURE OBLIGATOIRE

1. **En-tête** : Titre du problème (un thème mathématique précis)

2. **Préambule** : Un paragraphe posant le cadre général, les notations qui seront utilisées dans tout le sujet, et les définitions des objets centraux. Les termes définis sont en **gras**.

3. **Énoncé du théorème cible** : Le théorème que le problème vise à démontrer, énoncé formellement. Ce théorème doit être un résultat RÉEL de mathématiques (publié, avec auteur et date si possible).

4. **Paragraphe de navigation** : "Les trois premières parties sont largement indépendantes les unes des autres. La partie I est constituée de... Dans la partie II... Dans la partie III... Dans la partie IV, les résultats des parties précédentes sont combinés pour établir le théorème de [X]."

5. **Parties I à IV** : Chaque partie a :
   - Un titre
   - Un paragraphe d'introduction posant le cadre spécifique de la partie (nouvelles hypothèses, nouveaux objets, nouvelles notations)
   - Des questions numérotées séquentiellement (la numérotation continue entre parties)

6. **"Fin du problème."** à la fin

## STYLE DES QUESTIONS

- Jamais de QCM. Les questions sont de la forme :
  - "Montrer que..." / "Démontrer que..."
  - "Justifier que..."
  - "En déduire que..."
  - "Déterminer..." / "Calculer..." / "Exprimer... en fonction de..."
  - "Que peut-on dire de... ?"
  - "Conclure." (sans préciser quoi — le candidat doit comprendre)

- Questions multi-lignes avec sous-parties a), b), c) quand nécessaire
- La dernière question de chaque partie est nettement plus difficile et synthétise les résultats précédents
- Introduire des notations et objets ENTRE les questions (pas dans les questions elles-mêmes) quand de nouveaux concepts sont nécessaires`

  const user = `## THÈME DEMANDÉ

${domain}${topicHint}${avoidHint}${sourceHint}

## CE QUE TU DOIS PRODUIRE

Produis le sujet d'épreuve complet en Markdown avec LaTeX. Il doit être INDISTINGUABLE d'un vrai sujet ${concoursDisplayName(config.concours)} en termes de ton, rigueur, densité mathématique et difficulté.

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

## CE QUI DISTINGUE UN VRAI SUJET DE CONCOURS D'UN TD DE PRÉPA

1. **Système physique riche et réaliste** : Le sujet étudie un système réel (tokamak, laser à fibre, étoile à neutrons, moteur Stirling, piégeage magnéto-optique) — PAS un oscillateur harmonique générique ou un condensateur plan. Le système doit être suffisamment complexe pour nécessiter plusieurs modèles physiques.

2. **Modélisation progressive** : Chaque partie introduit un modèle plus raffiné du même système. Partie I = modèle simplifié, Partie II = on ajoute un effet, Partie III = modèle complet, Partie IV = cas limites ou applications. Le candidat voit le système se complexifier.

3. **Questions ouvertes** : Ne pas toujours donner le résultat à démontrer. Inclure des "Déterminer l'expression de...", "Quelle est la condition pour que...", "Représenter l'allure de..." où le candidat doit trouver la réponse. Au moins 2-3 par partie.

4. **Interprétation physique exigeante** : Pas juste "interpréter" — mais "Discuter la validité du modèle dans la limite où...", "Comparer avec le résultat expérimental donné", "Expliquer pourquoi cette approximation est légitime pour les paramètres considérés".

5. **Applications numériques non triviales** : Les A.N. ne sont pas de simples substitutions — elles doivent mener à une conclusion physique ("Le temps caractéristique est de l'ordre de... Ce résultat est-il cohérent avec l'observation que... ?").

## ERREURS À ÉVITER

- NE PAS faire un sujet qui ressemble à un exercice de Tout-en-un ou de Hprépa
- NE PAS choisir un système physique banal (pendule simple, circuit RLC basique, lentille mince)
- NE PAS mettre des indications à chaque question
- NE PAS séparer les parties en domaines déconnectés (Partie I = méca, Partie II = thermo, sans lien)

## CONTRAINTES DE FORMAT

- Calculatrice autorisée
- Tout le contenu mathématique en LaTeX (délimiteurs $...$ et $$...$$)
- Les vecteurs sont notés $\\vec{v}$ ou $\\mathbf{v}$
- Les unités sont toujours précisées

## STRUCTURE OBLIGATOIRE

1. **Titre** : Décrit le système physique étudié
2. **Introduction** : 1 à 2 paragraphes décrivant le contexte physique réel du problème et pourquoi il est intéressant
3. **Données numériques** : Un bloc listant toutes les constantes et valeurs numériques
4. **Paragraphe de navigation** : "Le problème comporte quatre parties largement indépendantes..."
5. **Parties I à IV** : Titre, introduction avec hypothèses et modèle, questions numérotées séquentiellement, [FIGURE : description] quand nécessaire
6. **"Fin du problème."**

## STYLE DES QUESTIONS

- **Dérivation** : "Établir l'équation différentielle vérifiée par..."
- **Expression** : "Exprimer $\\omega_0$ en fonction de..."
- **Détermination** : "Déterminer la condition sur... pour que..."
- **Application numérique** : "A.N." suivi d'une question d'interprétation
- **Interprétation** : "Discuter la validité de ce résultat." / "Commenter l'ordre de grandeur."
- **Vérification** : "Vérifier l'homogénéité." / "Retrouver ce résultat par analyse dimensionnelle."
- **Approximation** : "À quelle condition peut-on négliger... ? Justifier pour les valeurs numériques données."
- **Représentation** : "Représenter l'allure de..."
- **Synthèse** : "En déduire..." / "Conclure sur la stabilité du système."

Chaque partie doit contenir au moins une A.N. et au moins une question d'interprétation physique.`

  const user = `## THÈME DEMANDÉ

${topicHint}${avoidHint}${sourceHint}

## CE QUE TU DOIS PRODUIRE

Produis le sujet d'épreuve complet en Markdown avec LaTeX. Il doit être INDISTINGUABLE d'un vrai sujet ${concoursDisplayName(config.concours)} Physique.

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

## CE QUI DISTINGUE UN VRAI SUJET DE CONCOURS D'UN TP DE PRÉPA

1. **Problème algorithmique profond** : Le sujet ne demande pas juste d'implémenter un algorithme classique. Il explore un problème qui a une structure mathématique riche (combinatoire, théorie des graphes, langages formels) et où la solution optimale n'est pas évidente.

2. **Progression non linéaire** : La Partie I ne se contente pas de "coder les bases". Elle établit des propriétés structurelles (lemmes, bornes) qui seront NÉCESSAIRES dans les parties suivantes. Le code et la théorie sont entrelacés dès le début.

3. **Questions de conception ouverte** : Au moins 2-3 questions où le candidat doit CONCEVOIR un algorithme ou une structure de données, pas juste implémenter une spécification donnée. "Proposer un algorithme qui...", "Quelle structure de données permet de..."

4. **Preuves non triviales** : Les preuves de correction/terminaison ne sont pas de simples récurrences structurelles. Elles peuvent nécessiter un invariant subtil, un argument d'amortissement, ou une réduction.

5. **Questions sans indication** : Ne pas toujours donner la complexité cible. "Proposer l'algorithme le plus efficace possible" plutôt que "Proposer un algorithme en $O(n \\log n)$".

## ERREURS À ÉVITER

- NE PAS faire un sujet qui est juste "implémenter un arbre BST puis faire des opérations dessus"
- NE PAS donner systématiquement la complexité cible dans l'énoncé
- NE PAS séparer code et théorie (partie 1 = que du code, partie 2 = que des preuves)
- NE PAS demander uniquement des fonctions de 3-5 lignes triviales

## CONTRAINTES DE FORMAT

- Tout le code est en OCaml, présenté dans des blocs \`\`\`ocaml
- Les notations mathématiques sont en LaTeX (délimiteurs $...$ et $$...$$)
- La complexité est notée $O(\\cdot)$, $\\Theta(\\cdot)$, $\\Omega(\\cdot)$
- Les types OCaml sont donnés pour toutes les fonctions demandées

## STRUCTURE OBLIGATOIRE

1. **Titre** : Décrit le thème algorithmique
2. **Préambule** : Paragraphe posant le cadre, les notations, la motivation
3. **Définitions et types OCaml** : Les types de données utilisés dans tout le sujet
4. **Paragraphe de navigation**
5. **Parties I à IV** : Titre, introduction avec nouvelles définitions, questions numérotées
6. **"Fin du problème."**

## STYLE DES QUESTIONS

- **Code** : "Écrire une fonction \`f : int -> int list -> int\` qui..." — Type TOUJOURS donné. Spécification précise.
- **Complexité** : "Quelle est la complexité en temps dans le pire cas ? Justifier." / "Proposer l'algorithme le plus efficace possible."
- **Preuve** : "Montrer que l'algorithme termine." / "Montrer la correction." / "Donner un invariant de boucle."
- **Conception** : "Proposer un algorithme pour..." / "Quelle structure de données permet de..."
- **Contre-exemple** : "Donner un exemple montrant que l'approche naïve échoue."
- **Borne inférieure** : "Montrer qu'aucun algorithme ne peut résoudre ce problème en moins de..."

Le code OCaml doit être SYNTAXIQUEMENT CORRECT et IDIOMATIQUE (pattern matching, récursion, types algébriques).
Questions de code et questions théoriques ENTRELACÉES dans chaque partie.`

  const user = `## THÈME DEMANDÉ

${topicHint}${avoidHint}${sourceHint}

## CE QUE TU DOIS PRODUIRE

Produis le sujet d'épreuve complet en Markdown avec LaTeX et blocs OCaml. Il doit être INDISTINGUABLE d'un vrai sujet ${concoursDisplayName(config.concours)} Informatique.

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
