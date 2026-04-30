/**
 * Curated graded examples for each CRFPA coach.
 * Surfaced via the "Voir un exemple corrigé" button in each coach page header
 * — answers "what does a great answer look like before I write mine?".
 *
 * Each example is a real-feeling student submission with axis-level grading
 * showing exactly what the grader rewarded. Recognition-over-recall: seeing
 * one strong answer teaches more than three blank-page attempts.
 *
 * NOTE: These are pedagogical models, not legal authority. Article numbers,
 * dates, and case references should be verified against current sources before
 * being relied upon for actual exam preparation.
 *
 * Coaches without an example simply hide the trigger button.
 */

import type { CoachKind } from './coachPrimers'

export interface CoachExampleAxis {
  /** Axis name — should match the coach's actual rubric. */
  name: string
  score: number
  max: number
  /** Grader feedback — what was rewarded, what could be sharper. */
  comment: string
}

export interface CoachExample {
  /** Public-facing title — e.g. "Cass. soc. 13 mars 2024 — vol simple". */
  title: string
  /** Short tagline shown in the modal header. */
  hook: string
  /** Optional context paragraph (case background, prompt) — markdown. */
  context?: string
  /** The submission body — markdown. Use headings (## Majeure) for structure. */
  submission: string
  /** Overall numeric grading. */
  overallScore: number
  overallMax: number
  /** Optional one-liner overall comment from the grader. */
  overallComment?: string
  /** Axis-by-axis grading. */
  axes: CoachExampleAxis[]
}

// ─── Syllogisme ──────────────────────────────────────────────────────

const SYLLOGISME_EXAMPLE: CoachExample = {
  title: 'Accident de la circulation — quelle responsabilité ?',
  hook: 'Un cas classique : régime spécial vs. droit commun.',
  context: `**Énoncé.** Sophie, en se rendant à son travail au volant de sa voiture, percute par mégarde un piéton, Lucas (32 ans), qui traversait alors que le feu de circulation lui était défavorable. Lucas se blesse au genou et l'assigne en responsabilité civile.

**Question.** Sophie peut-elle être tenue d'indemniser Lucas, et sur quel fondement ?`,
  submission: `## Majeure

La responsabilité civile délictuelle de droit commun est régie par les articles 1240 et 1241 du Code civil, qui exigent la réunion de trois conditions cumulatives : une faute, un dommage, et un lien de causalité.

Toutefois, en matière d'accidents de la circulation impliquant un véhicule terrestre à moteur, la loi n° 85-677 du 5 juillet 1985 — dite loi Badinter — institue un régime spécial. Le conducteur ou gardien du véhicule impliqué doit indemniser la victime non-conductrice de ses dommages corporels, indépendamment de toute faute de sa part. L'article 3 de la loi prévoit une seule exception : le piéton ne peut être privé de son droit à indemnisation que si sa propre faute est qualifiée d'« inexcusable » et constitue la « cause exclusive » de l'accident.

La Cour de cassation a défini la faute inexcusable comme « la faute volontaire d'une exceptionnelle gravité exposant sans raison valable son auteur à un danger dont il aurait dû avoir conscience » (Civ. 2e, 20 juillet 1987, Bull. civ. II, n° 160).

## Mineure

En l'espèce, Sophie est conductrice d'un véhicule terrestre à moteur impliqué dans un accident de la circulation au sens de la loi de 1985. Lucas, piéton, a subi un dommage corporel (blessure au genou) imputable à cet accident. Les conditions d'application de la loi Badinter sont donc réunies.

Reste à examiner si la faute commise par Lucas — traverser au feu défavorable — peut faire échec à son indemnisation. Au regard du standard jurisprudentiel rappelé ci-dessus, cette faute, bien que réelle, n'atteint pas le seuil très exigeant de la « faute inexcusable » : elle relève de l'imprudence ordinaire d'un piéton, et non d'une exposition volontaire à un danger d'une exceptionnelle gravité.

## Conclusion

Sophie sera tenue d'indemniser intégralement Lucas en application de la loi du 5 juillet 1985. Le régime de droit commun (art. 1240 C. civ.) est écarté par la loi spéciale, et la faute du piéton ne suffit pas à constituer la cause exclusive d'exonération exigée par l'article 3.`,
  overallScore: 27,
  overallMax: 30,
  overallComment: 'Très bon syllogisme. Identification du régime spécial maîtrisée. La nuance sur la faute inexcusable pourrait être un cran plus précise.',
  axes: [
    {
      name: 'Majeure',
      score: 10,
      max: 10,
      comment: 'Article 1240 et loi Badinter correctement identifiés. La règle d\'éviction du droit commun par la loi spéciale est posée explicitement, et la jurisprudence sur la faute inexcusable est citée avec sa formule canonique. Excellent.',
    },
    {
      name: 'Mineure',
      score: 9,
      max: 10,
      comment: 'Les éléments de qualification (véhicule terrestre à moteur, accident, victime non-conductrice, dommage corporel) sont tous mappés. Pour aller plus loin : la condition de « cause exclusive » mériterait d\'être examinée à part — un correcteur très exigeant attendrait un raisonnement en deux temps (gravité + exclusivité), même s\'il aboutit à la même conclusion.',
    },
    {
      name: 'Conclusion',
      score: 8,
      max: 10,
      comment: 'Conclusion explicite, justifiée et appuyée sur la majeure. Le rappel de l\'éviction du droit commun est un bon réflexe. Manque léger : la conclusion pourrait préciser le quantum (« indemnisation intégrale du préjudice corporel, sous réserve d\'expertise »), ce qui est attendu pour une consultation pratique.',
    },
  ],
}

// ─── Plan détaillé ───────────────────────────────────────────────────

const PLAN_EXAMPLE: CoachExample = {
  title: 'La théorie de l\'imprévision en droit des contrats',
  hook: 'Une dissertation classique, repensée par la réforme de 2016.',
  context: `**Sujet de dissertation.** « La théorie de l'imprévision en droit des contrats français. »

**Attendus.** Un plan détaillé en deux parties, deux sous-parties chacune. Problématique formulée en introduction. Intitulés brefs et juridiquement orientés.`,
  submission: `## Problématique

Dans quelle mesure la consécration légale de l'imprévision par la réforme de 2016 rompt-elle avec la tradition française d'intangibilité du contrat ?

## Plan

**I. Une rupture circonscrite avec le principe d'intangibilité du contrat**

A. *Le rejet historique de l'imprévision : la jurisprudence Canal de Craponne et le primat de l'autonomie de la volonté*

B. *Les contournements jurisprudentiels et conventionnels avant 2016 : bonne foi, théorie des risques, clauses de hardship*

**II. Une consécration légale au régime équilibré (art. 1195 du Code civil)**

A. *Le mécanisme : un changement imprévisible rendant l'exécution excessivement onéreuse, ouvrant droit à renégociation puis à révision judiciaire*

B. *Les limites du dispositif : caractère supplétif, exigences strictes, et résistance d'un certain ordre public économique*`,
  overallScore: 26,
  overallMax: 30,
  overallComment: 'Plan solide, problématique bien formulée. L\'opposition I/II pourrait être plus tranchée : le titre du I parle de « rupture circonscrite » alors que l\'idée principale est l\'évolution.',
  axes: [
    {
      name: 'Problématique',
      score: 5,
      max: 5,
      comment: 'Problématique juridique, interrogative, qui capte la tension réelle du sujet (continuité ou rupture de la tradition française). Bonne formulation.',
    },
    {
      name: 'Opposition I vs II',
      score: 4,
      max: 5,
      comment: 'L\'opposition existe (rejet historique → consécration), mais le titre I (« rupture circonscrite ») dilue déjà la tension. Un I plus net (« Le rejet traditionnel ») ferait ressortir plus fortement le mouvement de bascule en II.',
    },
    {
      name: 'Équilibre des parties',
      score: 5,
      max: 5,
      comment: 'Les quatre sous-parties sont d\'ampleur comparable : I.A et I.B couvrent la jurisprudence et ses contournements ; II.A et II.B couvrent le mécanisme et ses limites. Bon équilibre.',
    },
    {
      name: 'Non-chevauchement',
      score: 5,
      max: 5,
      comment: 'Aucun recoupement entre les sous-parties. La distinction historique/positif (I) puis mécanisme/limites (II) est nette.',
    },
    {
      name: 'Couverture et ancrage',
      score: 4,
      max: 5,
      comment: 'Le plan couvre l\'ensemble du sujet et ancre chaque sous-partie dans des références (Canal de Craponne, art. 1195, hardship). Un cran de plus serait possible en mentionnant la jurisprudence post-réforme dans le II.B (par ex. Cass. com. 26 janv. 2022 sur l\'application de 1195).',
    },
    {
      name: 'Transitions',
      score: 3,
      max: 5,
      comment: 'La logique I→II est lisible mais reste implicite. Une transition explicite (« si la jurisprudence avait pu contourner sans abolir, le législateur de 2016 a tranché ») rendrait le plan plus convaincant à la seule lecture des titres.',
    },
  ],
}

// ─── Fiche d'arrêt ───────────────────────────────────────────────────

const FICHE_EXAMPLE: CoachExample = {
  title: 'Cass. ass. plén., 6 octobre 2006, Boot Shop',
  hook: 'L\'arrêt fondateur sur l\'opposabilité du manquement contractuel aux tiers.',
  context: `**Décision à ficher.** Cour de cassation, assemblée plénière, 6 octobre 2006, n° 05-13.255 (« Boot Shop »).

**Attendus.** Une fiche d'arrêt structurée : faits matériels, procédure, moyens du pourvoi, question de droit, solution et portée. Pas de commentaire — seulement la décision lue avec rigueur.`,
  submission: `## Faits

La société Boot Shop, locataire d'un local commercial appartenant à un bailleur, exploitait un commerce de chaussures. Le bailleur a ensuite consenti à un tiers la location d'une autre partie de l'ensemble immobilier, en violation d'une clause d'exclusivité contenue dans le bail consenti à Boot Shop. Le tiers a exercé sur place une activité concurrente, causant un préjudice à Boot Shop.

## Procédure

Boot Shop a assigné le tiers — avec lequel elle n'était liée par aucun contrat — sur le fondement de la responsabilité délictuelle, en se prévalant du manquement contractuel commis par le bailleur. La cour d'appel a accueilli la demande. Le tiers s'est pourvu en cassation, soutenant que l'effet relatif des contrats (art. 1165 ancien C. civ., devenu art. 1199) interdisait à un tiers d'invoquer un contrat auquel il n'était pas partie.

## Moyens du pourvoi

Le pourvoi soutenait que la responsabilité délictuelle d'un tiers ne peut être engagée par la seule constatation d'un manquement contractuel, en raison du principe de l'effet relatif des conventions. Il fallait, selon le demandeur au pourvoi, caractériser une faute distincte du seul manquement contractuel.

## Question de droit

Le tiers à un contrat peut-il invoquer, sur le fondement de la responsabilité délictuelle, un manquement contractuel qui lui a causé un dommage, sans avoir à démontrer une faute distincte de ce manquement ?

## Solution et portée

L'assemblée plénière rejette le pourvoi. Elle énonce que « le tiers à un contrat peut invoquer, sur le fondement de la responsabilité délictuelle, un manquement contractuel dès lors que ce manquement lui a causé un dommage ». La Cour consacre ainsi le principe de l'identité des fautes contractuelle et délictuelle pour le tiers victime.

**Portée.** Arrêt de principe d'assemblée plénière. Il met fin à une jurisprudence divisée et consacre l'unité du concept de faute. Solution confirmée — non sans débats doctrinaux et un infléchissement par Cass. ass. plén., 13 janvier 2020, n° 17-19.963, qui maintient le principe tout en exigeant que le tiers démontre que le manquement lui a causé un dommage propre.`,
  overallScore: 22,
  overallMax: 25,
  overallComment: 'Fiche solide, structure et hiérarchie respectées. La portée pourrait être davantage problématisée — pourquoi cet arrêt a été aussi controversé.',
  axes: [
    {
      name: 'Faits',
      score: 5,
      max: 5,
      comment: 'Faits matériels seuls, présentés chronologiquement, reformulés sans recopier l\'arrêt. Pas de procédure ni de droit mêlés. Excellent.',
    },
    {
      name: 'Procédure',
      score: 4,
      max: 5,
      comment: 'Le parcours procédural est clair (assignation, cour d\'appel, pourvoi) et le moyen du pourvoi est annoncé. Manque léger : préciser quel arrêt de cour d\'appel a été rendu (date, juridiction) si l\'énoncé l\'indique.',
    },
    {
      name: 'Moyens du pourvoi',
      score: 4,
      max: 5,
      comment: 'Le moyen est reformulé clairement (effet relatif, exigence d\'une faute distincte) et attribué au demandeur au pourvoi. Pour aller plus loin : citer l\'article visé par le pourvoi (1165 ancien C. civ.).',
    },
    {
      name: 'Question de droit',
      score: 5,
      max: 5,
      comment: 'Question abstraite, interrogative, dépouillée des faits du litige, et qui vise la règle de droit. Très bonne formulation.',
    },
    {
      name: 'Solution et portée',
      score: 4,
      max: 5,
      comment: 'Solution citée textuellement et exactement attribuée à l\'assemblée plénière. La portée est correctement identifiée comme arrêt de principe. La nuance sur Cass. ass. plén. 13 janvier 2020 est bienvenue. Manque : un mot sur la consécration partielle dans la réforme de 2016 (effet relatif maintenu mais opposabilité aménagée).',
    },
  ],
}

// ─── Commentaire d'arrêt ─────────────────────────────────────────────

const COMMENTAIRE_EXAMPLE: CoachExample = {
  title: 'Cass. com., 22 octobre 1996, Chronopost',
  hook: 'L\'arrêt qui a réécrit le droit des clauses limitatives.',
  context: `**Décision à commenter.** Cass. com., 22 octobre 1996, n° 93-18.632, dit « Chronopost ».

**Faits sommaires.** La société Banchereau a confié à Chronopost un pli urgent qui devait être livré le lendemain. Le pli est arrivé en retard. Banchereau a assigné Chronopost en réparation. Chronopost a opposé une clause limitative de responsabilité plafonnant l'indemnisation au prix du transport.

**Attendus.** Une introduction complète (accroche, présentation, faits, procédure, problème, solution, annonce du plan) suivie d'un plan en deux parties critiques.`,
  submission: `## Introduction

« Lorsque la stipulation revient à priver de toute portée l'engagement essentiel pris par le débiteur, le contrat n'est plus qu'une coquille vide. » Cette intuition doctrinale, longtemps cantonnée aux marges de la matière contractuelle, a trouvé sa traduction juridique dans un arrêt de principe rendu par la chambre commerciale de la Cour de cassation le 22 octobre 1996 (n° 93-18.632), connu sous le nom de l'arrêt Chronopost.

En l'espèce, la société Banchereau avait confié au transporteur Chronopost un pli urgent dont la livraison devait intervenir le lendemain. Le délai n'a pas été respecté. La société Banchereau, ayant subi un préjudice du fait de ce retard, a assigné Chronopost en réparation. Cette dernière a opposé une clause du contrat plafonnant l'indemnisation au prix du transport. La cour d'appel a fait droit à la demande de Chronopost. La société Banchereau s'est pourvue en cassation.

Le pourvoi soulevait la question de savoir si une clause limitative de responsabilité peut produire effet lorsqu'elle vide de sa substance l'obligation essentielle du débiteur. La chambre commerciale casse l'arrêt et énonce qu'« en raison du manquement à cette obligation essentielle, la clause limitative de responsabilité du contrat, qui contredisait la portée de l'engagement pris, devait être réputée non écrite ». La Cour invente, en pratique, une cause autonome d'exclusion des clauses limitatives, distincte de la faute lourde et du dol.

L'apport de l'arrêt mérite d'être discuté en deux temps : la sanction radicale d'une clause contredisant l'obligation essentielle (**I**), avant d'examiner la portée de cette solution et son intégration dans le droit positif contemporain (**II**).

## I. Une sanction radicale fondée sur la contradiction avec l'obligation essentielle

A. *L'identification d'une obligation essentielle : le délai de livraison comme cœur de l'engagement*

B. *L'exclusion de la clause par la voie du « réputé non écrit » — une innovation par rapport aux mécanismes traditionnels (faute lourde, dol)*

## II. Une portée jurisprudentielle confirmée et consacrée par la réforme de 2016

A. *Une jurisprudence ancrée : confirmations (Cass. com., 30 mai 2006) et infléchissements (Cass. ch. mixte, 22 avril 2005, Faurecia I et II)*

B. *La consécration légale par l'article 1170 du Code civil — une cristallisation, mais aussi une discipline du « réputé non écrit »*`,
  overallScore: 22,
  overallMax: 25,
  overallComment: 'Très bon commentaire sur un arrêt difficile. Plan ancré dans la décision, accroche convaincante. Le II pourrait davantage discuter les critiques doctrinales du critère de l\'obligation essentielle.',
  axes: [
    {
      name: 'Accroche et présentation',
      score: 5,
      max: 5,
      comment: 'Accroche doctrinale élégante et juridiquement orientée. Présentation complète : juridiction, date, numéro de pourvoi, parties identifiables. Excellent.',
    },
    {
      name: 'Intérêt et enjeu',
      score: 4,
      max: 5,
      comment: 'L\'intérêt est posé (innovation par rapport aux mécanismes traditionnels), mais l\'articulation avec la jurisprudence antérieure pourrait être plus explicite. Mentionner l\'état du droit avant 1996 (faute lourde et dol comme seules exclusions) renforcerait l\'enjeu.',
    },
    {
      name: 'Problématique',
      score: 4,
      max: 5,
      comment: 'Question juridique précise, qui capte la tension propre à cet arrêt (clause valide en théorie, mais qui prive l\'obligation de sa substance). Pour aller plus loin : formuler la question de manière plus interrogative directe (« La clause limitative... peut-elle... ? »).',
    },
    {
      name: 'Plan ancré dans l\'arrêt',
      score: 5,
      max: 5,
      comment: 'Plan binaire, équilibré, ANCRÉ dans la décision (sanction radicale + portée consacrée). Les intitulés évoquent la solution et ses prolongements, pas des étiquettes neutres. Très bon réflexe.',
    },
    {
      name: 'Articulation et annonce',
      score: 4,
      max: 5,
      comment: 'L\'annonce du plan est claire et placée en fin d\'introduction. La logique I→II est perceptible. Manque léger : une transition entre I et II rappelant que la solution radicale a appelé une discipline jurisprudentielle puis légale rendrait l\'enchaînement plus convaincant.',
    },
  ],
}

// ─── Cas pratique ────────────────────────────────────────────────────

const CAS_PRATIQUE_EXAMPLE: CoachExample = {
  title: 'Compromis de vente — condition suspensive et défaillance fautive',
  hook: 'Un cas multi-problèmes en droit des contrats spéciaux.',
  context: `**Énoncé.** Mme A (38 ans) a signé le 15 mars un compromis de vente pour acquérir un appartement parisien à 600 000 €. Le compromis prévoyait une condition suspensive d'obtention d'un prêt avant le 15 mai, ainsi que le versement d'un acompte de 30 000 €.

Le 10 mai, Mme A reçoit un refus de prêt par sa banque principale (BNP Paribas). Elle ne sollicite aucun autre établissement. Le 18 mai, le vendeur la met en demeure d'exécuter le compromis, lui reprochant d'avoir « volontairement saboté » son dossier de prêt. Mme A souhaite récupérer son acompte de 30 000 €.

**Question.** Quels conseils juridiques pouvez-vous lui apporter ?`,
  submission: `Il convient d'examiner successivement (1) le sort de la condition suspensive d'obtention de prêt, (2) le risque d'une défaillance fautive opposée par le vendeur, et (3) la stratégie de récupération de l'acompte.

## 1. La défaillance de la condition suspensive d'obtention du prêt

**Règle.** L'article 1304 du Code civil définit la condition suspensive comme une obligation dont la naissance dépend d'un événement futur et incertain. Aux termes de l'article 1304-6, l'obligation devient pure et simple lorsque la condition s'accomplit ; à l'inverse, lorsque la condition est défaillie, l'obligation est anéantie. Lorsque la condition tient à l'obtention d'un prêt, la loi du 13 juillet 1979 (loi Scrivener), codifiée aux articles L. 313-40 et suivants du Code de la consommation, protège l'acquéreur non professionnel : la non-obtention du prêt entraîne la caducité du compromis et la restitution intégrale des sommes versées.

**Application.** En l'espèce, Mme A a signé un compromis assorti d'une condition suspensive d'obtention de prêt avant le 15 mai. Elle a essuyé un refus de prêt le 10 mai, soit avant l'échéance fixée. La condition est donc, en principe, défaillie, ce qui devrait emporter la caducité du compromis et la restitution de l'acompte de 30 000 €.

**Conclusion.** La défaillance de la condition suspensive est, à première vue, acquise.

## 2. Le risque d'une défaillance fautive opposée par le vendeur

**Règle.** L'article 1304-3 alinéa 2 du Code civil dispose : « La condition est réputée accomplie si celui qui y avait intérêt en a empêché l'accomplissement. » La jurisprudence, antérieure et postérieure à la réforme de 2016, exige que l'acquéreur ait engagé des démarches sérieuses et de bonne foi. La Cour de cassation considère qu'une seule sollicitation, ou une sollicitation manifestement vouée à l'échec (montant disproportionné par rapport aux capacités de l'emprunteur, dégradation volontaire du dossier), peut caractériser un manquement à cette obligation (Civ. 3e, 13 février 2008, n° 06-22.043 ; Civ. 3e, 12 sept. 2007).

**Application.** Mme A n'a sollicité qu'un seul établissement bancaire — la BNP Paribas — et n'a entrepris aucune démarche complémentaire après le refus du 10 mai. Cette unique demande, en l'absence d'autres tentatives, expose l'acquéreur à voir sa bonne foi contestée. Le grief du vendeur (« sabotage » du dossier) est plus exigeant à démontrer, mais le seul reproche d'inertie suffirait à fonder une défaillance fautive si le vendeur établit que d'autres établissements auraient pu prêter.

**Conclusion.** Le risque que la condition soit réputée accomplie au visa de l'article 1304-3 alinéa 2 existe, mais il pèse sur le vendeur d'apporter la preuve de l'intention de Mme A de faire échec à la condition.

## 3. La stratégie de récupération de l'acompte

**Règle.** En cas de défaillance non fautive, l'acquéreur a droit à la restitution intégrale des sommes versées (art. L. 313-41 C. consom.). À défaut de restitution amiable, l'acquéreur peut engager une action en restitution devant le tribunal judiciaire compétent. L'article 1304-4 prévoit que le créancier a droit à la restitution de ce qu'il a reçu lorsque la condition défaillit.

**Application et conseil.** Pour Mme A, la stratégie optimale est :

- **Court terme** : produire la lettre de refus de la BNP Paribas et adresser au vendeur (et au notaire séquestre) une mise en demeure de restituer l'acompte de 30 000 €, fondée sur l'article L. 313-41 du Code de la consommation et 1304-6 du Code civil.
- **Renforcer le dossier** : solliciter à titre conservatoire deux autres établissements bancaires, même tardivement, afin de neutraliser le grief de défaillance fautive.
- **À moyen terme** : si le vendeur refuse, engager une action en restitution. Le risque pour Mme A reste l'application de 1304-3 alinéa 2 ; elle devra alors démontrer que ses démarches étaient sérieuses et que la non-obtention du prêt n'est pas imputable à sa mauvaise foi.

Mme A peut donc, sous réserve de ces démarches, raisonnablement espérer récupérer l'intégralité de son acompte.`,
  overallScore: 17,
  overallMax: 20,
  overallComment: 'Très bonne consultation. Trois problèmes identifiés et traités, avec un conseil stratégique concret. Le style est juste. Manque léger sur la précision des références jurisprudentielles dans le 2.',
  axes: [
    {
      name: 'Identification des problèmes',
      score: 4,
      max: 4,
      comment: 'Les trois problèmes principaux (défaillance de la condition, défaillance fautive, restitution de l\'acompte) sont identifiés et annoncés en tête. Bonne hiérarchisation.',
    },
    {
      name: 'Qualité du syllogisme',
      score: 4,
      max: 5,
      comment: 'Chaque problème est traité avec une structure règle → application → conclusion identifiable. Pour aller plus loin : marquer plus explicitement la mineure dans le problème 2 (en commençant par « En l\'espèce » au lieu d\'enchaîner les faits avec la règle).',
    },
    {
      name: 'Exactitude des règles',
      score: 3,
      max: 4,
      comment: 'Articles cités correctement (1304, 1304-3, 1304-6, L. 313-40 C. consom.). La jurisprudence Civ. 3e, 13 février 2008 et Civ. 3e, 12 sept. 2007 est plausible mais doit être vérifiée — au CRFPA, une référence imprécise peut coûter cher. Sois certain des numéros de pourvoi avant de citer.',
    },
    {
      name: 'Application aux faits',
      score: 3,
      max: 3,
      comment: 'Reprise précise des faits : montant du compromis (600 000 €), montant de l\'acompte (30 000 €), date du refus (10 mai), nom de l\'établissement (BNP Paribas). Pas de réponse générique. Excellent.',
    },
    {
      name: 'Rédaction',
      score: 2,
      max: 2,
      comment: 'Style consultation maîtrisé : « Il convient de », « Sur le fondement de », transitions claires entre les trois problèmes. Bonne rédaction.',
    },
    {
      name: 'Conseil pratique',
      score: 1,
      max: 2,
      comment: 'Le conseil existe (mise en demeure, sollicitations conservatoires, action en restitution) et est concret. Manque un cran : chiffrer le risque (par ex. « probabilité de récupération estimée à 70 % en l\'état du dossier ») et préciser le délai d\'action.',
    },
  ],
}

// ─── Note de synthèse ────────────────────────────────────────────────

const NOTE_SYNTHESE_EXAMPLE: CoachExample = {
  title: 'L\'encadrement juridique du télétravail',
  hook: 'Un dossier multi-sources synthétisé en quatre pages.',
  context: `**Dossier (six documents).**

- *Doc. 1.* Code du travail, articles L. 1222-9 à L. 1222-11.
- *Doc. 2.* Accord national interprofessionnel (ANI) du 26 novembre 2020 relatif au télétravail.
- *Doc. 3.* Cass. soc., 1er juillet 2009, n° 07-44.482 (qualification du télétravail).
- *Doc. 4.* J. Mouly, « Le télétravail après la pandémie », *Droit social* 2021, p. 245.
- *Doc. 5.* Décret n° 2020-1257 du 14 octobre 2020 (état d'urgence sanitaire et télétravail).
- *Doc. 6.* DARES, « Le télétravail en France en 2022 — pratiques et perceptions ».

**Attendus.** Une note de synthèse fidèle aux documents, en quatre pages environ, avec problématique, plan binaire et citation systématique des sources.

**N.B. — exemple condensé.** Le texte ci-dessous présente l'introduction et les deux premières sous-parties (I.A et I.B) à titre de modèle. Une copie complète comporterait la totalité des sous-parties II.A et II.B, sur environ 2 400 mots au total.`,
  submission: `## Introduction

Le télétravail, longtemps cantonné à la marge des relations de travail, est devenu en France une pratique de masse à la faveur de la crise sanitaire. Les sources rassemblées dans le dossier témoignent de la rapidité de cette mutation : le législateur (Doc. 1), les partenaires sociaux (Doc. 2), le pouvoir réglementaire (Doc. 5) et le juge (Doc. 3) ont tour à tour défini, encadré et précisé le statut juridique de cette modalité d'exécution du contrat de travail. La doctrine (Doc. 4) et les statistiques publiques (Doc. 6) confirment que le sujet excède désormais le cadre conjoncturel.

L'encadrement juridique du télétravail soulève une tension constante : préserver la flexibilité offerte au salarié et à l'employeur, sans laisser le travailleur isolé se trouver privé des protections traditionnelles attachées au contrat de travail. **Comment le droit français concilie-t-il, dans le cadre du télétravail, la flexibilité organisationnelle et la protection du salarié ?**

Pour y répondre, il convient d'examiner successivement le cadre normatif progressivement bâti autour du télétravail (**I**), puis les garanties spécifiques attachées à son exécution (**II**).

## I. Un cadre normatif progressivement bâti

### A. Une définition légale et conventionnelle stabilisée

Le télétravail fait l'objet d'une définition légale à l'article L. 1222-9 du Code du travail (Doc. 1), introduit par la loi du 22 mars 2012 puis modifié par l'ordonnance du 22 septembre 2017. Le texte le définit comme « toute forme d'organisation du travail dans laquelle un travail qui aurait pu être exécuté dans les locaux de l'employeur est effectué par un salarié hors de ces locaux de façon volontaire en utilisant les technologies de l'information et de la communication ». Cette définition légale est complétée par l'ANI du 26 novembre 2020 (Doc. 2), qui distingue le télétravail régulier du télétravail occasionnel et précise les modalités de mise en œuvre.

La jurisprudence (Doc. 3) avait, dès 2009, admis que la simple tolérance d'un travail à domicile n'emportait pas qualification de télétravail, retenant un critère de formalisation : la qualification suppose un accord exprès des parties. La doctrine (Doc. 4) souligne que cette exigence formaliste, héritée de l'avant-2017, a été tempérée par la pratique post-pandémie.

### B. Une architecture normative à deux étages : loi et accord collectif

L'architecture du dispositif est structurée à deux niveaux. Le Code du travail (Doc. 1) pose les règles générales — réversibilité, prise en charge des coûts, droit à la déconnexion — tandis que la mise en œuvre concrète relève de l'accord collectif d'entreprise ou, à défaut, d'une charte unilatérale soumise à consultation du CSE (art. L. 1222-9, al. 2). L'ANI 2020 (Doc. 2) sert ici de cadre de référence supplétif, fixant des standards conventionnels que les accords d'entreprise tendent à reprendre.

Le décret du 14 octobre 2020 (Doc. 5), pris dans le contexte de l'urgence sanitaire, a marqué une parenthèse particulière : il a imposé le recours au télétravail dans les activités le permettant, démontrant la capacité du pouvoir réglementaire à activer ponctuellement un cadre dérogatoire. La doctrine (Doc. 4) en tire la leçon que le droit du télétravail oscille entre régulation négociée et intervention impérative.

[*La copie complète développerait ensuite II.A et II.B sur les garanties offertes au salarié — droit à la déconnexion, prise en charge des frais, accès aux droits collectifs — appuyées sur les Doc. 1, 2, 4 et 6, dans la limite de 4 pages au total.*]`,
  overallScore: 16,
  overallMax: 20,
  overallComment: 'Bonne synthèse, fidèle aux documents et bien problématisée. La citation systématique avec « (Doc. N) » est respectée. La neutralité est globalement tenue.',
  axes: [
    {
      name: 'Citation de tous les documents',
      score: 3,
      max: 4,
      comment: 'Cinq documents sur six sont cités explicitement (Doc. 1, 2, 3, 4, 5). Le Doc. 6 (DARES) est mentionné en introduction mais n\'est pas réinvesti dans le développement présenté. Une copie complète devrait y revenir en II.',
    },
    {
      name: 'Plan structuré',
      score: 2,
      max: 3,
      comment: 'Plan binaire I/II, sous-parties A/B annoncées et lisibles. Manque léger : les intitulés de I.A et I.B se ressemblent (« cadre » et « architecture »), ce qui peut affaiblir l\'opposition. Préférer des intitulés plus distincts.',
    },
    {
      name: 'Problématique pertinente',
      score: 2,
      max: 2,
      comment: 'Problématique juridique, interrogative, qui découle directement de la tension perceptible dans le dossier (flexibilité vs protection). Bonne formulation.',
    },
    {
      name: 'Qualité de la synthèse',
      score: 3,
      max: 4,
      comment: 'Restitution fidèle, sans interprétation personnelle (sauf une fin de paragraphe légèrement extrapolative — « la doctrine en tire la leçon »). Bonne reformulation des documents. Pour le 4/4 : éviter toute prise de position implicite.',
    },
    {
      name: 'Neutralité',
      score: 2,
      max: 2,
      comment: 'Pas d\'avis personnel exprimé, pas de « il convient de » ou de « force est de constater ». Le ton est sobre. Très bien.',
    },
    {
      name: 'Respect de la limite',
      score: 1,
      max: 1,
      comment: 'L\'exemple est explicitement présenté comme un extrait. Une copie complète sur 2 400 mots / 4 pages tient le format. Conforme.',
    },
    {
      name: 'Qualité rédactionnelle',
      score: 2,
      max: 2,
      comment: 'Français juridique correct, transitions visibles entre I.A et I.B, vocabulaire précis. Très bonne rédaction.',
    },
    {
      name: 'Équilibre entre les parties',
      score: 1,
      max: 2,
      comment: 'L\'équilibre I/II ne peut être pleinement évalué sur l\'extrait, mais les sous-parties I.A et I.B sont d\'ampleur comparable. La complétion en II est nécessaire pour valider l\'équilibre global.',
    },
  ],
}

// ─── Grand Oral ──────────────────────────────────────────────────────

const GRAND_ORAL_EXAMPLE: CoachExample = {
  title: 'Le contrôle de conventionnalité par le juge ordinaire',
  hook: 'Une question classique, à articuler avec la QPC.',
  context: `**Sujet tiré au sort.** « Le contrôle de conventionnalité par le juge ordinaire en France. »

**Format.** Quinze minutes d'exposé devant un jury de trois membres, suivies de trente minutes de questions.

**N.B. — extrait de la transcription.** Sont reproduits ci-dessous l'introduction et la conclusion de l'exposé, ainsi qu'un échange représentatif avec le jury. La transcription complète couvrirait l'intégralité des deux parties, sujet à la limite des 15 minutes.`,
  submission: `## Introduction (extrait)

« Monsieur le Président, Mesdames et Messieurs les membres du jury,

Le contrôle de la conformité de la loi à un traité international par le juge ordinaire — communément appelé contrôle de conventionnalité — n'a rien d'évident dans une tradition juridique française historiquement marquée par la souveraineté du législateur et la suprématie de la loi. C'est pourtant aujourd'hui un instrument central de l'État de droit en France, exercé quotidiennement par les juridictions civiles, pénales et administratives.

Trois textes et trois arrêts en posent les fondations. L'article 55 de la Constitution de 1958 confère aux traités régulièrement ratifiés une autorité supérieure à celle des lois. La décision *IVG* du Conseil constitutionnel du 15 janvier 1975 réserve cependant le contrôle de conventionnalité aux juridictions ordinaires, en refusant d'opérer ce contrôle elle-même. La Cour de cassation, dans l'arrêt *Société des Cafés Jacques Vabre* du 24 mai 1975, accepte la première de faire prévaloir le traité — en l'occurrence le Traité de Rome — sur une loi française postérieure. Le Conseil d'État, plus tardivement, abandonne sa jurisprudence *Semoules de France* en consacrant la même solution dans l'arrêt *Nicolo* du 20 octobre 1989.

Mais cet édifice, construit en moins de vingt ans, soulève aujourd'hui une question décisive : **dans quelle mesure le contrôle de conventionnalité, exercé par le juge ordinaire, demeure-t-il distinct du contrôle de constitutionnalité depuis l'instauration de la QPC en 2010 ?**

Pour y répondre, il convient d'examiner d'abord la consécration progressive d'un contrôle de conventionnalité par le juge ordinaire (**I**), avant d'analyser son articulation contemporaine avec le contrôle de constitutionnalité, dans un mouvement qui n'est pas sans tension (**II**). »

## Conclusion (extrait)

« En définitive, le contrôle de conventionnalité par le juge ordinaire est passé, en cinquante ans, du statut d'innovation jurisprudentielle à celui d'instrument de droit commun de l'État de droit. La QPC, en consacrant un contrôle de constitutionnalité a posteriori, n'a pas marginalisé ce contrôle de conventionnalité — elle l'a plutôt concurrencé sans le supplanter, comme en témoigne la jurisprudence *Melki et Abdeli* (CJUE, 22 juin 2010) et la pratique récente du contrôle in concreto.

Reste une question ouverte : si la convergence se confirme entre les normes constitutionnelles et conventionnelles dans la protection des droits fondamentaux, le dualisme du contrôle a-t-il vocation à perdurer ? Je vous remercie. »

## Échange avec le jury (extrait)

> **Jury.** Vous avez cité l'arrêt *Nicolo*. Pouvez-vous nous préciser la jurisprudence antérieure du Conseil d'État sur ce point, et expliquer pourquoi *Nicolo* a été jugé tardif ?
>
> **Candidate.** Le Conseil d'État avait, dans l'arrêt *Syndicat général des fabricants de semoules de France* du 1er mars 1968, refusé de faire prévaloir un traité sur une loi postérieure, au motif qu'il n'appartenait pas au juge administratif de contrôler la loi. Cette position était perçue comme tardive par rapport à la chambre mixte de la Cour de cassation, qui avait admis dès *Cafés Jacques Vabre* en 1975 ce que le Conseil d'État n'a admis qu'en 1989. La doctrine y voit un retard de quatorze ans imputable à la fidélité initiale du juge administratif à la souveraineté législative.`,
  overallScore: 56,
  overallMax: 80,
  overallComment: 'Très bonne prestation pour un Grand Oral. Fond solide, plan clair, réactivité honnête. La posture pourrait gagner en assurance (quelques tics verbaux dans l\'extrait du milieu, non reproduits ici).',
  axes: [
    {
      name: 'Fond juridique',
      score: 16,
      max: 20,
      comment: 'Références citées exactement : Constitution art. 55, Cons. const. 15 janv. 1975 IVG, Cass. ch. mixte 24 mai 1975 Cafés Jacques Vabre, CE 20 oct. 1989 Nicolo. Bonne mobilisation de Semoules de France 1968 et Melki et Abdeli 2010. Pour le 18-20/20 : intégrer une référence au contrôle in concreto contemporain (Cass. ass. plén., 5 oct. 2018, n° 10-19.053).',
    },
    {
      name: 'Forme',
      score: 14,
      max: 20,
      comment: 'Plan apparent, annonce claire, conclusion ouverte. Durée respectée (≈ 14 min 30). Quelques transitions implicites entre I.A et I.B où une formulation plus marquée (« ce socle textuel et jurisprudentiel posé… ») renforcerait la lisibilité.',
    },
    {
      name: 'Réactivité',
      score: 14,
      max: 20,
      comment: 'Trois réponses de fond aux questions du jury, dont l\'extrait reproduit. La candidate rebondit sur Semoules de France et le « retard » du Conseil d\'État avec précision. Faille : sur une question relative à la portée du contrôle in concreto, la candidate a hésité avant de citer la jurisprudence Cass. ass. plén. 5 oct. 2018 sans la dater précisément.',
    },
    {
      name: 'Posture',
      score: 12,
      max: 20,
      comment: 'Confiance globalement perçue, registre adapté (« Mesdames et Messieurs les membres du jury »). Quelques tics verbaux (« en fait », « voilà ») reviennent à trois reprises dans la transcription complète. Fluidité tenue lors des relances. Travailler les silences et la respiration entre les questions.',
    },
  ],
}

// ─── Registry ────────────────────────────────────────────────────────

export const COACH_EXAMPLES: Partial<Record<CoachKind, CoachExample>> = {
  syllogisme: SYLLOGISME_EXAMPLE,
  plan: PLAN_EXAMPLE,
  fiche: FICHE_EXAMPLE,
  commentaire: COMMENTAIRE_EXAMPLE,
  'cas-pratique': CAS_PRATIQUE_EXAMPLE,
  'note-synthese': NOTE_SYNTHESE_EXAMPLE,
  'grand-oral': GRAND_ORAL_EXAMPLE,
}
