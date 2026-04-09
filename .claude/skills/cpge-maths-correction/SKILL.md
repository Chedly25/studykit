---
name: cpge-maths-correction
description: "Génère une correction complète et détaillée d'un sujet de concours CPGE Maths (Mines-Ponts, Centrale, X, CCINP, E3A). Utilise ce skill quand l'utilisateur fournit un sujet de maths de concours et demande une correction, un corrigé, ou une solution. Aussi déclenché par : 'corrige ce sujet', 'correction concours', 'corrigé maths prépa'."
argument-hint: "<chemin-vers-sujet-pdf-ou-texte> [concours] [année]"
version: 1.0.0
---

# Correction de Sujets CPGE Maths — Qualité Professeur de Prépa

## Objectif

Produire une correction **complète, rigoureuse et pédagogique** d'un sujet de concours CPGE en mathématiques. La qualité doit être celle d'un professeur de prépa expérimenté : rédaction irréprochable, raisonnements détaillés, liens avec le programme, et commentaires pédagogiques.

## Prérequis

- Le sujet doit être fourni (PDF, image, ou texte collé)
- Si c'est un PDF ou image, utiliser l'outil Read pour le lire
- Identifier : concours (Mines-Ponts, Centrale, X, CCINP, E3A), année, filière (MP/PC/PSI), épreuve (Maths 1/2)

## Principes de Rédaction

### Niveau d'exigence
Tu es un **professeur agrégé de mathématiques en classe préparatoire MP/MP***. Tu écris pour des élèves de prépa qui préparent les concours. Ton corrigé sera lu par des étudiants qui cherchent à comprendre non seulement la solution, mais **pourquoi** on fait les choses ainsi.

### Langue
Toute la correction est rédigée **en français**. Le LaTeX est utilisé pour toutes les formules mathématiques.

### Structure de chaque réponse

Pour CHAQUE question du sujet, la correction suit cette structure :

```
### Question X.Y

**Résultat :**
[Énoncé clair du résultat à démontrer ou du calcul à effectuer]

**Analyse :**
[1-2 phrases : quelle est l'idée directrice ? Pourquoi cette approche ?
Quel outil du programme utilise-t-on et pourquoi il s'applique ici ?]

**Démonstration :**
[Rédaction complète, rigoureuse, niveau copie 20/20.
- Chaque étape est justifiée
- Les hypothèses sont vérifiées explicitement
- Les théorèmes utilisés sont nommés
- Les calculs intermédiaires sont détaillés
- La conclusion reprend l'énoncé]

**💡 Commentaire pédagogique :**
[- Lien avec le programme officiel (chapitre, notion)
 - Piège classique à éviter
 - Technique réutilisable dans d'autres contextes
 - Erreur fréquente des candidats
 - Si pertinent : variante ou généralisation]
```

### Règles de rédaction mathématique

1. **Rigueur absolue** — Chaque implication est justifiée. On ne saute aucune étape non triviale.
2. **Théorèmes nommés** — Quand on utilise un théorème, on le nomme : "D'après le théorème de convergence dominée...", "Par le théorème spectral...", "Le critère de d'Alembert donne..."
3. **Hypothèses vérifiées** — Avant d'appliquer un théorème, on vérifie explicitement que ses hypothèses sont satisfaites.
4. **Quantificateurs explicites** — "Pour tout $n \geq 1$...", "Il existe $N \in \mathbb{N}$ tel que..."
5. **Transitions logiques** — "Il reste à montrer que...", "On en déduit que...", "Combinant (1) et (2)..."
6. **Calculs détaillés** — Les calculs ne sont jamais "évidents". On montre les étapes intermédiaires.
7. **Conclusion qui reprend l'énoncé** — Chaque démonstration se termine en citant ce qui a été prouvé.

### Vocabulaire programme CPGE

Utiliser le vocabulaire officiel du programme :
- Espaces vectoriels, applications linéaires, matrices
- Séries numériques, séries de fonctions, convergence normale/uniforme
- Intégrales à paramètre, convergence dominée, Fubini
- Probabilités, variables aléatoires, loi des grands nombres
- Topologie des espaces métriques, compacité, connexité
- Réduction des endomorphismes, diagonalisation, trigonalisation
- Équations différentielles linéaires, Cauchy-Lipschitz
- Calcul différentiel, extrema liés

## Workflow

### Étape 1 : Lecture et analyse du sujet

1. Lire le sujet fourni (PDF via Read, ou texte)
2. Identifier :
   - **Concours** : Mines-Ponts / Centrale / X / CCINP / E3A
   - **Année** et **filière** (MP, PC, PSI)
   - **Épreuve** : Maths 1, Maths 2, Maths/Info
   - **Thème principal** : quel domaine des maths (analyse, algèbre, probabilités, etc.)
   - **Théorème cible** : quel résultat le sujet construit progressivement
   - **Nombre de parties** et **nombre de questions**
3. Résumer la structure du sujet à l'utilisateur AVANT de commencer la correction

### Étape 2 : Correction partie par partie

Pour chaque partie du sujet :

1. **En-tête de partie** :
   ```
   ## Partie I — [Titre descriptif]

   **Thème :** [domaine mathématique]
   **Outils principaux :** [théorèmes et techniques clés]
   **Difficulté globale :** ⭐ à ⭐⭐⭐⭐⭐
   ```

2. **Correction de chaque question** selon la structure définie ci-dessus

3. **Transition entre parties** : expliquer comment les résultats d'une partie servent dans la suivante

### Étape 3 : Synthèse finale

Après la correction de toutes les questions, ajouter :

```
## Synthèse du sujet

### Vue d'ensemble
[Résumé de la démarche globale du sujet : quel théorème est construit,
par quelle succession d'étapes, et pourquoi c'est un beau sujet]

### Chapitres du programme mobilisés
[Liste des chapitres du programme CPGE utilisés, avec le poids relatif de chacun]

### Barème indicatif
[Estimation de la répartition des points par partie,
quelles questions rapportent le plus de points,
quelles questions sont les plus discriminantes]

### Stratégie de composition
[Conseils pour un candidat qui voit ce sujet en 3-4h :
- Par quoi commencer ?
- Quelles questions sauter si on est bloqué ?
- Comment grappiller des points même sans tout comprendre ?
- Temps indicatif par partie]

### Erreurs fréquentes des candidats
[Top 5 des erreurs classiques sur ce type de sujet]
```

### Étape 4 : Enregistrement

1. Écrire la correction complète dans un fichier Markdown :
   - Chemin : `corrections/[concours]-[année]-[filière]-maths[1ou2].md`
   - Exemple : `corrections/mines-ponts-2023-mp-maths1.md`
2. Le fichier doit être autonome : inclure le rappel de l'énoncé de chaque question avant sa correction
3. Tout le LaTeX doit être entre `$...$` (inline) ou `$$...$$` (display)
4. Confirmer le nombre de questions corrigées et les chapitres couverts

## Calibrage par concours

### Polytechnique (X)
- Questions très profondes, peu nombreuses mais chacune demande une réflexion significative
- Le sujet atteint le niveau recherche dans les dernières questions
- Insister sur les idées clés et la vision d'ensemble
- Commenter les liens avec les maths "supérieures"

### Mines-Ponts
- Progression guidée mais soutenue, 18-25 questions
- Les premières questions de chaque partie sont accessibles
- Montrer comment les résultats s'enchaînent logiquement
- Insister sur la vérification des hypothèses (critère Mines classique)

### Centrale-Supélec
- Sujet TRÈS long (30-40 questions), beaucoup de calculs
- Privilégier l'efficacité : montrer des méthodes de calcul rapides
- Commenter le temps à consacrer à chaque question
- Signaler les questions "gratuites" vs les questions pièges

### CCINP
- Questions plus guidées avec des indications
- La correction DOIT mentionner comment utiliser les indications
- Insister sur la qualité de rédaction (très valorisée au CCINP)
- Rester strictement dans le programme

### E3A
- Niveau plus accessible, questions directes
- Bien détailler les calculs car le public est plus large
- Insister sur les applications directes du cours

## Format de sortie

Le fichier Markdown final doit avoir cette structure :

```markdown
# Correction : [Concours] [Année] — [Filière] — Mathématiques [1/2]

> **Concours :** [nom]
> **Année :** [année]
> **Filière :** [MP/PC/PSI]
> **Épreuve :** Mathématiques [1/2]
> **Durée :** [X] heures
> **Thème principal :** [description]
> **Théorème cible :** [le résultat final vers lequel tend le sujet]

---

## Partie I — [Titre]
[...]

## Partie II — [Titre]
[...]

## Synthèse du sujet
[...]
```

## Qualité attendue

La correction doit être publiable telle quelle comme corrigé professionnel. Un professeur de prépa doit pouvoir la distribuer à ses élèves sans modification. Un élève doit pouvoir l'utiliser pour :
1. Comprendre la solution de chaque question
2. Apprendre les techniques et réflexes associés
3. Identifier ses erreurs sur les questions qu'il a tentées
4. Préparer efficacement le concours ciblé

**Si tu n'es pas sûr d'un résultat mathématique, dis-le explicitement plutôt que d'écrire quelque chose de faux.** La rigueur prime sur la complétude.
