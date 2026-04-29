/**
 * CRFPA "lived-in mid-prep" demo seed.
 *
 * Wipes profile-scoped child tables and re-installs a deterministic dataset:
 * cours documents, coaching sessions (syllogisme / plan / fiche / commentaire /
 * cas pratique / note de synthèse), legal fiches, Oracle conversations, library
 * read status, and 14 days of study logs.
 *
 * Subjects, chapters, topics, and the profile itself are preserved — they're
 * set up by the standard profile-creation flow.
 *
 * Determinism: every row uses a stable string id, every timestamp is computed
 * from a single anchor date. Re-running with the same anchor reproduces the
 * exact same dataset.
 */

import { db } from '../index'
import { chunkText, computeKeywords } from '../../lib/sources'
import type {
  Document,
  DocumentChunk,
  CoachingSession,
  LegalFiche,
  Conversation,
  ChatMessage,
  LibraryReadStatus,
  DailyStudyLog,
} from '../schema'
import type {
  SyllogismeTask,
  SyllogismeSubmission,
  SyllogismeGrading,
  PlanTask,
  PlanSubmission,
  PlanGrading,
  FicheTask,
  FicheSubmission,
  FicheGrading,
  CommentaireTask,
  CommentaireSubmission,
  CommentaireGrading,
  CasPratiqueTask,
  CasPratiqueSubmission,
  CasPratiqueGrading,
  NoteSyntheseTask,
  NoteSyntheseSubmission,
  NoteSyntheseGrading,
} from '../../ai/coaching/types'

// ─── Anchor & helpers ─────────────────────────────────────────────

const DEFAULT_ANCHOR = '2026-04-29' // today per environment

function isoDaysAgo(anchor: string, days: number): string {
  const t = new Date(anchor + 'T18:30:00Z').getTime() - days * 86400000
  return new Date(t).toISOString()
}

function dateDaysAgo(anchor: string, days: number): string {
  const t = new Date(anchor + 'T00:00:00Z').getTime() - days * 86400000
  return new Date(t).toISOString().slice(0, 10)
}

// ─── Documents (cours) ───────────────────────────────────────────

interface DemoDocument {
  id: string
  title: string
  category: 'course' | 'exam' | 'other'
  daysAgo: number
  tags?: string[]
  /** Optional sourceUrl pointing to a real PDF in /public/library/pdfs/crfpa */
  sourceUrl?: string
  sourceType: 'text' | 'pdf'
  content: string
}

export const CRFPA_DEMO_DOCUMENTS: DemoDocument[] = [
  {
    id: 'demo-doc-obligations-formation',
    title: 'Cours — Droit des obligations : la formation du contrat',
    category: 'course',
    daysAgo: 32,
    tags: ['obligations', 'cours', 'M1'],
    sourceType: 'text',
    content: `# Droit des obligations — La formation du contrat

## I. Notion et conditions de validité

Le contrat est défini par l'article 1101 du Code civil comme « un accord de volontés entre deux ou plusieurs personnes destiné à créer, modifier, transmettre ou éteindre des obligations ». La formation valable du contrat suppose la réunion de quatre conditions essentielles, désormais codifiées à l'article 1128 du Code civil depuis l'ordonnance du 10 février 2016 :

1. Le consentement des parties ;
2. Leur capacité de contracter ;
3. Un contenu licite et certain ;
4. (La cause, supprimée par la réforme, demeure néanmoins présente sous la forme du contrôle du déséquilibre significatif et du but illicite — articles 1162 et 1169 C. civ.)

L'absence d'une de ces conditions emporte nullité — relative pour la protection d'un intérêt particulier (vices du consentement, incapacité), absolue pour la protection de l'intérêt général (illicéité).

## II. Le consentement

Le consentement, réflexe de la liberté contractuelle, doit exister et être exempt de vices. L'article 1130 C. civ. énumère trois vices : l'erreur, le dol, la violence.

**L'erreur** (art. 1132-1136) doit porter sur une qualité essentielle de la prestation due ou du cocontractant, et avoir été déterminante du consentement. L'erreur sur les motifs n'est pas, en principe, cause de nullité (art. 1135).

**Le dol** (art. 1137-1138) est défini comme le fait pour un contractant d'obtenir le consentement de l'autre par des manœuvres ou des mensonges. La réticence dolosive — silence sur une information dont l'autre devait avoir connaissance — est expressément consacrée à l'article 1137 alinéa 2. La preuve incombe à celui qui l'invoque, mais la jurisprudence admet largement les présomptions (Cass. com., 17 janv. 2018).

**La violence** (art. 1140-1143) consiste dans une pression de nature à inspirer la crainte d'un mal considérable. La réforme de 2016 a consacré l'abus de dépendance économique (art. 1143), faisant écho à un courant doctrinal et jurisprudentiel ancien.

## III. La capacité

La capacité de contracter est la règle, l'incapacité l'exception (art. 1145). Les mineurs non émancipés et les majeurs protégés ne peuvent contracter qu'à concurrence des actes de la vie courante autorisés par leur statut. Les actes accomplis hors de leur capacité sont sanctionnés par la nullité relative.

Pour les personnes morales, la capacité s'apprécie à l'aune du principe de spécialité — l'objet social définit la sphère de la capacité juridique.

## IV. Le contenu du contrat

L'article 1162 C. civ. impose que le contrat ne déroge pas, par ses stipulations ou son but, à l'ordre public. L'article 1163 exige que la prestation soit possible et déterminée ou déterminable. La détermination du prix, qui posait problème sous l'empire des anciens articles 1129 et 1591, est désormais régie par l'article 1164 (contrats-cadre) et l'article 1165 (contrats de prestation de service) : le prix peut être fixé unilatéralement par une partie, à charge pour elle d'en motiver le montant en cas de contestation.

Le déséquilibre significatif est sanctionné dans les contrats d'adhésion par la réputation non écrite des clauses créant un déséquilibre substantiel (art. 1171). Cette disposition opère un contrôle de l'équilibre interne du contrat sans pour autant remettre en cause le principe de la liberté contractuelle.

## V. Sanctions

La nullité relative protège un intérêt particulier ; elle ne peut être invoquée que par la partie protégée et se prescrit par cinq ans à compter de la découverte du vice (art. 1144 C. civ. et 2224). La nullité absolue, en revanche, sanctionne la violation d'une règle d'ordre public et peut être invoquée par tout intéressé.

La caducité (art. 1186-1187) frappe le contrat lorsque l'un de ses éléments essentiels disparaît postérieurement à sa formation. L'inopposabilité, enfin, prive le contrat d'effet à l'égard des tiers sans en affecter la validité entre les parties.

## VI. Conclusion

La formation du contrat, profondément remaniée par l'ordonnance du 10 février 2016, demeure un point de passage obligé pour tout praticien. La maîtrise des conditions de validité, la qualification précise du vice invoqué et la sanction adéquate sont au cœur de l'épreuve d'obligations du concours.

Pour aller plus loin : Cass. ch. mixte, 21 décembre 2007 (réticence dolosive et obligation d'information) ; Cass. 1re civ., 3 février 1999 (erreur sur la rentabilité) ; Cass. 1re civ., 28 mai 2008 (violence économique).
`,
  },
  {
    id: 'demo-doc-procedure-penale-gav',
    title: 'Cours — Procédure pénale : la garde à vue',
    category: 'course',
    daysAgo: 21,
    tags: ['procédure pénale', 'cours', 'M1'],
    sourceType: 'text',
    content: `# Procédure pénale — La garde à vue

## I. Définition et finalité

La garde à vue est une mesure de contrainte par laquelle une personne soupçonnée d'avoir commis ou tenté de commettre un crime ou un délit puni d'emprisonnement est, sur décision et sous le contrôle d'un officier de police judiciaire (OPJ), maintenue à la disposition des enquêteurs (art. 62-2 CPP).

Elle poursuit cinq objectifs limitativement énumérés à l'article 62-2 CPP : permettre l'exécution d'investigations impliquant la présence ou la participation de la personne, garantir sa présentation devant le procureur de la République, empêcher la modification des preuves, empêcher la pression sur les témoins ou les victimes, empêcher la concertation avec d'éventuels coauteurs ou complices.

## II. Conditions de placement

Le placement en garde à vue suppose l'existence de raisons plausibles de soupçonner que la personne a commis ou tenté de commettre une infraction punie d'emprisonnement (art. 62-2 CPP). La mesure est ordonnée par l'OPJ et placée sous le contrôle du procureur de la République (art. 62-3 CPP).

La décision de placement doit être motivée. La jurisprudence exige une nécessité concrète et appréciée in concreto — un placement sans nécessité actuelle expose la procédure à la nullité (Cass. crim., 11 juill. 2017, n° 17-80.313).

## III. Droits du gardé à vue

L'article 63-1 CPP impose la notification immédiate au gardé à vue des droits suivants :

- La nature et la date présumée de l'infraction reprochée ;
- La durée de la mesure ainsi que les conditions de prolongation ;
- Le droit de faire prévenir un proche et son employeur ;
- Le droit d'être examiné par un médecin ;
- Le droit de garder le silence et de ne pas s'incriminer ;
- Le droit d'être assisté d'un avocat (art. 63-3-1 et 63-4 CPP) ;
- Le droit à un interprète si la langue française n'est pas comprise ;
- Le droit de consulter le dossier (limité, art. 63-4-1 CPP).

L'assistance de l'avocat est un droit consubstantiel aux droits de la défense (art. 6 § 3 CEDH). Sa mise en œuvre, longtemps cantonnée à la première heure puis étendue par la loi du 14 avril 2011, est désormais effective dès le début de la mesure et peut intervenir sur simple demande lors des auditions.

## IV. Durée et prolongation

La durée initiale de la garde à vue est de 24 heures (art. 63 CPP). Une prolongation de 24 heures supplémentaires peut être ordonnée par le procureur de la République sur autorisation écrite et motivée, à condition que les nécessités de l'enquête le justifient et que l'infraction soit punie d'un an d'emprisonnement au moins (art. 63 II CPP).

Pour les crimes contre l'humanité, le terrorisme, le trafic de stupéfiants en bande organisée et la criminalité organisée, des prolongations spéciales sont prévues (art. 706-88 et s. CPP) — jusqu'à 96 heures, voire 144 heures pour les actes de terrorisme.

La prolongation suppose la présentation effective de la personne devant le magistrat, sauf décision motivée fondée sur les nécessités de l'enquête.

## V. Sanctions

Le non-respect des règles relatives à la garde à vue est sanctionné par la nullité de la procédure (art. 171 CPP). Toutefois, la jurisprudence subordonne le prononcé de la nullité à la démonstration d'un grief par celui qui l'invoque (Cass. crim., 19 sept. 2012, n° 12-83.527).

Constituent classiquement des causes de nullité : l'absence de notification des droits ou sa notification tardive ; l'absence de l'avocat lors d'un interrogatoire ; le défaut de placement effectif en garde à vue alors que la personne se trouvait privée de liberté ; le défaut de motivation de la prolongation.

Les déclarations recueillies en violation des droits de la défense sont écartées du dossier — la chambre criminelle a réaffirmé ce principe à plusieurs reprises depuis l'arrêt fondateur du 19 octobre 2010.

## VI. Conclusion

La garde à vue cristallise l'équilibre toujours instable entre les nécessités de l'enquête et les droits fondamentaux du suspect. La maîtrise des règles de fond et de forme — placement, notification, durée, droits de la défense — est indispensable au candidat à l'épreuve de procédure pénale.
`,
  },
  {
    id: 'demo-doc-civil-regimes-matrimoniaux',
    title: 'Cours — Droit civil : les régimes matrimoniaux',
    category: 'course',
    daysAgo: 26,
    tags: ['civil', 'cours', 'famille'],
    sourceType: 'text',
    content: `# Droit civil — Les régimes matrimoniaux

## I. Notion et choix du régime

Le régime matrimonial gouverne les rapports patrimoniaux entre époux pendant le mariage et lors de sa dissolution. Le Code civil consacre la liberté des conventions matrimoniales (art. 1387 C. civ.) sous réserve du respect du régime primaire impératif (art. 212 à 226).

À défaut de contrat, les époux sont soumis au **régime légal de la communauté réduite aux acquêts** (art. 1400 C. civ.) — solution par défaut depuis la loi du 13 juillet 1965.

## II. Le régime primaire impératif

Indépendamment du régime choisi, certaines règles s'appliquent à tous les couples mariés :

- **Contribution aux charges du mariage** (art. 214) — proportionnelle aux facultés respectives.
- **Solidarité ménagère** (art. 220) — chaque époux engage l'autre pour les dettes ayant pour objet l'entretien du ménage ou l'éducation des enfants, sauf dépenses manifestement excessives.
- **Protection du logement familial** (art. 215 al. 3) — l'aliénation et la constitution de droits réels sur le logement requièrent l'accord des deux époux.
- **Indépendance professionnelle et bancaire** (art. 223 et 221) — chacun peut exercer sa profession et ouvrir un compte bancaire à son nom.

## III. Le régime légal — communauté réduite aux acquêts

### Composition de la communauté

L'**actif commun** comprend les biens acquis à titre onéreux pendant le mariage (art. 1401), les revenus de chaque époux et les fruits des biens propres.

Les **biens propres** comprennent les biens possédés avant le mariage et ceux reçus par succession ou libéralité pendant le mariage (art. 1405).

### Gestion

Chaque époux gère librement les biens communs (gestion concurrente, art. 1421), sauf actes de disposition graves nécessitant le consentement des deux (art. 1422 — donation, et art. 1424 — aliénation des immeubles, fonds de commerce, droits sociaux non négociables).

### Liquidation

À la dissolution, la communauté est partagée par moitié (art. 1467). Chaque époux reprend ses propres et rapporte les récompenses dues à la communauté.

## IV. Les régimes conventionnels

**La séparation de biens** (art. 1536-1543) : chaque époux conserve la propriété et la gestion exclusive de ses biens. Solution adaptée aux époux exerçant des professions à risque (commerçants, professions libérales).

**La communauté universelle** (art. 1526) : tous les biens, présents et à venir, deviennent communs. Souvent assortie d'une clause d'attribution intégrale au survivant.

**La participation aux acquêts** (art. 1569-1581) : fonctionne comme la séparation de biens pendant l'union, comme la communauté à la dissolution. Régime hybride d'origine allemande.

## V. Changement de régime

Depuis la loi du 23 juin 2006, le changement de régime est permis sans homologation judiciaire systématique (art. 1397). Conditions : intervention d'un notaire, information des enfants majeurs, opposition possible des créanciers.

## VI. Conclusion

Le choix du régime matrimonial doit être éclairé par la situation patrimoniale et professionnelle du couple. Le régime primaire offre un socle de protection commun, mais c'est la nature des biens et les modes de gestion qui déterminent l'équilibre véritable du patrimoine conjugal.
`,
  },
  {
    id: 'demo-doc-penal-element-moral',
    title: 'Cours — Droit pénal général : l\'élément moral de l\'infraction',
    category: 'course',
    daysAgo: 19,
    tags: ['pénal', 'cours', 'M1'],
    sourceType: 'text',
    content: `# Droit pénal général — L'élément moral de l'infraction

## I. Le principe de l'article 121-3 du Code pénal

L'article 121-3 du Code pénal pose le principe selon lequel **« il n'y a point de crime ou de délit sans intention de le commettre »** (alinéa 1). L'intention est donc, en principe, constitutive de l'infraction.

L'alinéa 2 précise toutefois que **« lorsque la loi le prévoit, il y a délit en cas de mise en danger délibérée de la personne d'autrui »**. L'alinéa 3 ouvre, lorsque la loi le prévoit, la possibilité d'incriminer la **faute d'imprudence, de négligence ou de manquement à une obligation de prudence ou de sécurité** prévue par la loi ou le règlement.

L'alinéa 4, issu de la loi Fauchon du 10 juillet 2000, opère une distinction capitale en matière de **causalité indirecte** : seule la faute qualifiée — manifestement délibérée ou caractérisée — engage la responsabilité pénale lorsque le lien de causalité avec le dommage est indirect.

## II. Les variétés du dol

### Le dol général

Le dol général, conscience et volonté de commettre l'infraction, suffit pour la majorité des infractions intentionnelles. Sa preuve résulte le plus souvent des circonstances objectives — la jurisprudence n'exige pas une démonstration psychologique mais déduit l'intention des actes commis.

### Le dol spécial

Certaines incriminations exigent un dol spécial — une intention particulière s'ajoutant au dol général. Exemple : le vol (art. 311-1 C. pén.) suppose l'intention de s'approprier la chose d'autrui (l'*animus domini*). L'escroquerie (art. 313-1) exige l'intention de tromper en vue d'obtenir un avantage indu.

### Le dol éventuel

Le dol éventuel — accepter le risque de réaliser une infraction sans l'avoir voulu directement — n'est en principe pas reconnu en droit français comme dol au sens strict. Il est cependant traité par le mécanisme de la **mise en danger délibérée** (art. 121-3 al. 2 C. pén. et infractions spécifiques comme l'art. 223-1).

## III. La faute non intentionnelle

### Faute simple et faute qualifiée

Avant la loi Fauchon, toute faute d'imprudence pouvait engager la responsabilité pénale. Depuis 2000, l'article 121-3 al. 4 distingue selon que le lien de causalité est direct ou indirect :

- **Causalité directe** : la faute simple suffit (homicide involontaire en matière de circulation, par ex.).
- **Causalité indirecte** : seule la faute qualifiée engage la responsabilité — soit la **faute caractérisée** exposant autrui à un risque d'une particulière gravité que l'auteur ne pouvait ignorer, soit la **violation manifestement délibérée** d'une obligation de sécurité ou de prudence imposée par la loi ou le règlement.

### Effets pratiques

Cette distinction protège les auteurs de fautes mineures dont les conséquences résultent d'un enchaînement causal indirect — chefs d'entreprise, élus, médecins. La jurisprudence est exigeante sur la qualification de la faute caractérisée (Cass. crim., 12 sept. 2006).

## IV. Les causes d'irresponsabilité

L'élément moral peut être anéanti par des causes objectives :

- **L'erreur de droit invincible** (art. 122-3) — neutralise l'intention si l'agent croyait pouvoir légitimement accomplir l'acte.
- **La contrainte** (art. 122-2) — physique ou morale, à condition d'être irrésistible.
- **L'état de nécessité** (art. 122-7) — protège la commission d'une infraction nécessaire à la sauvegarde d'un intérêt supérieur.
- **La légitime défense** (art. 122-5) — riposte proportionnée à une atteinte injustifiée.
- **L'ordre de la loi ou de l'autorité légitime** (art. 122-4).
- **Le trouble psychique ayant aboli le discernement** (art. 122-1 al. 1) — abolit l'élément moral subjectif.

## V. Conclusion

L'élément moral est la part subjective de l'infraction — celle qui transforme un fait matériel en acte coupable. Sa qualification précise (dol général, dol spécial, faute simple, faute qualifiée) commande la pénalité encourue et oriente la défense.
`,
  },
  {
    id: 'demo-doc-procedure-civile-competence',
    title: 'Cours — Procédure civile : compétence et fins de non-recevoir',
    category: 'course',
    daysAgo: 16,
    tags: ['procédure civile', 'cours'],
    sourceType: 'text',
    content: `# Procédure civile — Compétence, exceptions et fins de non-recevoir

## I. La compétence

### Compétence matérielle

Depuis la réforme du 1er janvier 2020 (loi du 23 mars 2019), le **tribunal judiciaire** est juridiction de droit commun en matière civile (art. L211-3 COJ). Il connaît de toutes les affaires pour lesquelles compétence n'est pas attribuée à une autre juridiction.

Juridictions spécialisées : conseil de prud'hommes (litiges du contrat de travail), tribunal de commerce (litiges entre commerçants ou relatifs à un acte de commerce), tribunal paritaire des baux ruraux, juge aux affaires familiales.

### Compétence territoriale

Le principe est la compétence du tribunal du domicile du défendeur (art. 42 CPC). Exceptions notables :

- En matière contractuelle : tribunal du lieu de livraison ou d'exécution (art. 46).
- En matière délictuelle : tribunal du fait dommageable ou du dommage (art. 46).
- En matière immobilière : tribunal du lieu de l'immeuble (art. 44, compétence exclusive).

## II. Les exceptions de procédure

L'article 73 CPC définit l'exception de procédure comme tout moyen tendant à faire déclarer la procédure irrégulière ou éteinte, ou à en suspendre le cours. Caractéristiques :

- Doivent être soulevées **in limine litis** — avant toute défense au fond et toute fin de non-recevoir (art. 74).
- Sont relatives — l'irrégularité doit causer grief au défendeur.
- Sont régularisables (art. 115) — la nullité disparaît si la cause cesse avant que le juge ne statue.

Catégories : exception d'incompétence (art. 75-99), exception de litispendance et de connexité (art. 100-107), exceptions dilatoires (art. 108-111), exceptions de nullité (art. 112-121).

## III. Les fins de non-recevoir

L'article 122 CPC définit la fin de non-recevoir comme tout moyen tendant à faire déclarer l'adversaire irrecevable en sa demande, sans examen au fond, **pour défaut de droit d'agir**.

Causes typiques :
- Défaut de qualité ou d'intérêt à agir (art. 31).
- Prescription de l'action.
- Forclusion ou délai préfix.
- Chose jugée (art. 1355 C. civ.).

Régime : peuvent être proposées en tout état de cause (art. 123), à la différence des exceptions de procédure. Sont d'ordre public si elles sanctionnent l'inobservation d'un délai ou les défaillances du droit d'agir (art. 125).

## IV. L'effet dévolutif de l'appel

L'appel transmet à la cour le litige tel qu'il a été soumis aux premiers juges (art. 561 CPC). Toutefois, depuis la réforme du 6 mai 2017, l'effet dévolutif est conditionné par l'identification précise des chefs de jugement critiqués dans la déclaration d'appel (art. 901 et 562) — à défaut, la cour n'est saisie que des chefs expressément énoncés (Cass. 2e civ., 30 janv. 2020).

## V. Conclusion

La maîtrise de la chronologie procédurale — exceptions de procédure avant tout, puis fins de non-recevoir, enfin défense au fond — est essentielle pour ne pas perdre ses moyens. La réforme de 2020 et celle de 2017 sur l'appel ont renforcé l'exigence de rigueur procédurale.
`,
  },
  {
    id: 'demo-doc-affaires-procedures-collectives',
    title: 'Cours — Droit des affaires : procédures collectives',
    category: 'course',
    daysAgo: 12,
    tags: ['affaires', 'cours'],
    sourceType: 'text',
    content: `# Droit des affaires — Les procédures collectives

## I. Vue d'ensemble

Les procédures collectives, codifiées au Livre VI du Code de commerce, traitent des entreprises en difficulté. Trois procédures judiciaires principales :

- La **sauvegarde** (art. L620-1 et s.) — préventive, pour une entreprise pas encore en cessation des paiements mais qui rencontre des difficultés insurmontables.
- Le **redressement judiciaire** (art. L631-1 et s.) — pour une entreprise en cessation des paiements dont la situation n'est pas irrémédiablement compromise.
- La **liquidation judiciaire** (art. L640-1 et s.) — lorsque le redressement est manifestement impossible.

S'y ajoutent des dispositifs amiables : mandat ad hoc et conciliation (art. L611-3 et s.).

## II. La cessation des paiements

L'article L631-1 du Code de commerce définit la cessation des paiements comme **« l'impossibilité de faire face au passif exigible avec son actif disponible »**.

Le débiteur doit déposer le bilan dans les 45 jours suivant la cessation des paiements (art. L631-4). Le défaut emporte sanction (interdiction de gérer, faillite personnelle).

## III. La période d'observation

À l'ouverture du redressement ou de la sauvegarde, une **période d'observation** de 6 mois renouvelable (max. 18 mois) débute. Pendant cette période :

- Le dirigeant continue, en principe, à gérer (art. L622-1) — sauf désignation d'un administrateur.
- Les créances antérieures sont **gelées** : interdiction des paiements (art. L622-7) et arrêt des poursuites individuelles (art. L622-21).
- Les contrats en cours peuvent être continués sur option de l'administrateur (art. L622-13).

## IV. L'élaboration du plan

À l'issue de la période d'observation, trois issues :

- **Plan de sauvegarde ou de redressement** — étalement des dettes sur 10 ans maximum (art. L626-12), engagements du débiteur, possibles cessions partielles.
- **Plan de cession** (redressement) — transmission de l'entreprise à un repreneur (art. L631-22).
- **Liquidation** — si aucune solution de redressement n'apparaît viable.

## V. La liquidation judiciaire

Ouverture par décision du tribunal lorsque le redressement est manifestement impossible (art. L640-1). Le débiteur est dessaisi de la gestion (art. L641-9), confiée au liquidateur. L'actif est réalisé pour désintéresser les créanciers selon l'ordre des privilèges.

La **clôture pour insuffisance d'actif** (art. L643-9) éteint les poursuites des créanciers, sauf cas particuliers (fraude, créances alimentaires).

## VI. Sanctions

Le dirigeant peut être frappé de :

- **Interdiction de gérer** (art. L653-8) — temporaire.
- **Faillite personnelle** (art. L653-1 à L653-7) — pour fautes de gestion graves.
- **Responsabilité pour insuffisance d'actif** (art. L651-2) — anciennement « action en comblement de passif ».
- **Sanctions pénales** : banqueroute (art. L654-2), abus de biens sociaux.

## VII. Conclusion

Le droit des procédures collectives concilie le sauvetage de l'entreprise, la protection des créanciers et la sanction des dirigeants fautifs. Les réformes successives (2005, 2014, 2021) ont renforcé l'attractivité de la sauvegarde, sans toujours résoudre la tension entre rapidité de la procédure et qualité de l'analyse économique.
`,
  },
  {
    id: 'demo-doc-social-licenciement',
    title: 'Cours — Droit social : le licenciement pour motif personnel',
    category: 'course',
    daysAgo: 9,
    tags: ['social', 'cours'],
    sourceType: 'text',
    content: `# Droit social — Le licenciement pour motif personnel

## I. La cause réelle et sérieuse

L'article L1232-1 du Code du travail conditionne tout licenciement à l'existence d'une **cause réelle et sérieuse**. Triple exigence :

- **Réelle** : objective, existante, exacte.
- **Sérieuse** : suffisamment grave pour justifier la rupture.
- **Personnelle** : tirée du comportement ou de la situation du salarié, par opposition au motif économique.

L'absence de cause réelle et sérieuse ouvre droit à indemnisation, dont les barèmes sont désormais encadrés (art. L1235-3, dits « barèmes Macron » — validés par Cass. soc., 11 mai 2022).

## II. Les motifs personnels

### La faute du salarié

Trois degrés de gravité :

- **Faute simple** : comportement fautif justifiant le licenciement, mais pas la rupture immédiate. Le salarié conserve indemnité de licenciement, indemnité compensatrice de préavis et de congés payés.
- **Faute grave** : manquement rendant impossible le maintien du salarié dans l'entreprise, même pendant le préavis. Privation des indemnités de préavis et de licenciement (art. L1234-1, L1234-9). Caractérisée par : violences, vol, abandon de poste prolongé, insubordination caractérisée.
- **Faute lourde** : intention de nuire à l'employeur. Outre la perte des indemnités, la faute lourde justifie l'engagement de la responsabilité civile du salarié.

### L'insuffisance professionnelle

Distincte de la faute, elle suppose une incapacité objective à exécuter correctement le travail. Pas de responsabilité disciplinaire — l'insuffisance peut résulter d'un défaut de formation, d'une inadaptation à un nouveau poste, etc. (Cass. soc., 13 nov. 2008).

### L'inaptitude médicale

Constatée par le médecin du travail, l'inaptitude impose à l'employeur une obligation de reclassement (art. L1226-2 et L1226-10). Le licenciement n'est possible que si l'impossibilité du reclassement est démontrée.

## III. La procédure

### Convocation à l'entretien préalable

Notification écrite par lettre recommandée ou remise en main propre contre décharge (art. L1232-2). L'entretien doit être tenu au moins 5 jours ouvrables après la réception de la convocation. Le salarié peut se faire assister par un membre du personnel ou un conseiller du salarié (art. L1232-4).

### Notification du licenciement

Lettre recommandée envoyée au moins 2 jours ouvrables après l'entretien (art. L1232-6). La lettre doit énoncer les motifs précis : tout motif non énoncé sera réputé absent.

Depuis l'ordonnance du 22 septembre 2017, l'employeur peut **préciser** les motifs de la lettre dans les 15 jours suivant sa notification (art. L1235-2).

## IV. Conséquences

Le préavis (sauf faute grave/lourde) est dû selon l'ancienneté : 1 mois (< 2 ans) ou 2 mois (≥ 2 ans).

L'indemnité légale de licenciement (art. L1234-9 et R1234-2) : ¼ de mois de salaire par année jusqu'à 10 ans, ⅓ au-delà.

En cas de licenciement sans cause réelle et sérieuse : indemnité plafonnée par les barèmes Macron (de 0,5 à 20 mois selon ancienneté et taille de l'entreprise).

## V. Conclusion

Le licenciement pour motif personnel est un terrain technique. La jurisprudence sociale est très exigeante sur la précision de la motivation et la régularité de la procédure. Une erreur sur la qualification de la faute peut transformer une rupture justifiée en licenciement abusif.
`,
  },
  {
    id: 'demo-doc-administratif-rep',
    title: 'Cours — Droit administratif : recours pour excès de pouvoir',
    category: 'course',
    daysAgo: 7,
    tags: ['administratif', 'cours'],
    sourceType: 'text',
    content: `# Droit administratif — Le recours pour excès de pouvoir

## I. Définition et nature

Le recours pour excès de pouvoir (REP) est défini par la jurisprudence Dame Lamotte (CE, ass., 17 fév. 1950) comme un recours ouvert même sans texte contre tout acte administratif, ayant pour effet d'assurer le respect de la légalité.

C'est un **recours objectif** : le juge se borne à apprécier la conformité de l'acte au droit, sans se prononcer sur les droits subjectifs des parties. Le pouvoir du juge se limite à l'annulation — il ne peut ni réformer ni indemniser dans le cadre du REP.

## II. Conditions de recevabilité

### Acte attaquable

L'acte doit faire grief — produire des effets juridiques. Sont attaquables : les décisions administratives unilatérales, individuelles ou réglementaires. Ne le sont pas : les mesures d'ordre intérieur (sauf atteinte à des droits, CE 17 fév. 1995 Marie), les actes préparatoires, les circulaires non impératives.

### Intérêt à agir

Le requérant doit justifier d'un intérêt direct et personnel. La jurisprudence l'apprécie largement : un contribuable local peut attaquer un acte de sa commune (CE, 29 mars 1901, Casanova).

### Délai

Le délai est de **2 mois** (art. R421-1 CJA) à compter de la publication ou de la notification de l'acte. Le délai franc, le respect des règles de notification et la mention des voies et délais de recours conditionnent la régularité de la procédure.

## III. Moyens de légalité

### Moyens de légalité externe

- **Incompétence** — l'auteur de l'acte n'avait pas le pouvoir de le prendre. Moyen d'ordre public.
- **Vice de forme** — non-respect des formes prescrites (motivation lorsqu'elle est requise, signature, etc.).
- **Vice de procédure** — méconnaissance des règles procédurales (consultations obligatoires, contradictoire, etc.). N'est sanctionné que si la violation a influé sur la décision (CE, ass., 23 déc. 2011, Danthony).

### Moyens de légalité interne

- **Violation directe de la loi** — l'acte contredit une règle de droit applicable.
- **Erreur de droit** — l'administration s'est fondée sur un texte inapplicable ou en a fait une interprétation erronée.
- **Erreur de fait** — fondement factuel inexact.
- **Erreur manifeste d'appréciation** — limite minimale du contrôle juridictionnel.
- **Détournement de pouvoir** — l'administration a poursuivi un but autre que celui en vue duquel le pouvoir lui a été conféré.

## IV. Effets de l'annulation

L'annulation produit un effet **rétroactif** — l'acte est censé n'avoir jamais existé. La jurisprudence Association AC ! (CE, ass., 11 mai 2004) admet toutefois la modulation dans le temps lorsque la rétroactivité aurait des conséquences manifestement excessives.

L'autorité de la chose jugée s'impose à l'administration, qui doit tirer les conséquences de l'annulation et, le cas échéant, retirer ou abroger les actes pris sur le fondement de l'acte annulé.

## V. Articulation avec d'autres recours

Le REP coexiste avec le **recours de pleine juridiction** (recours subjectif, appréciation des droits, indemnisation possible). En matière contractuelle, depuis la jurisprudence Tropic (CE, ass., 16 juill. 2007) puis Tarn-et-Garonne (CE, ass., 4 avr. 2014), le contentieux contractuel est largement passé du REP au recours de pleine juridiction.

## VI. Conclusion

Le REP demeure le pilier du contentieux administratif et l'instrument central de protection contre l'arbitraire. La maîtrise de ses conditions de recevabilité, des moyens de légalité et de leur articulation est requise pour toute épreuve d'administratif.
`,
  },
  {
    id: 'demo-doc-libertes-presse',
    title: 'Cours — Libertés fondamentales : liberté de la presse',
    category: 'course',
    daysAgo: 4,
    tags: ['libertés', 'cours'],
    sourceType: 'text',
    content: `# Libertés fondamentales — La liberté de la presse

## I. Fondements

La liberté de la presse est ancrée dans plusieurs sources :

- **Article 11 de la Déclaration des droits de l'homme et du citoyen de 1789** — « la libre communication des pensées et des opinions est un des droits les plus précieux de l'homme ».
- **Article 10 CEDH** — liberté d'expression, sous réserve de restrictions nécessaires dans une société démocratique.
- **Loi du 29 juillet 1881 sur la liberté de la presse** — texte fondateur, encore en vigueur.

Le Conseil constitutionnel a élevé la liberté d'expression au rang de liberté fondamentale (DC 84-181 du 11 oct. 1984).

## II. Régime — la loi du 29 juillet 1881

Le régime privilégié de la presse repose sur quatre piliers :

1. **Délai de prescription court** : 3 mois (art. 65) — encourage la stabilité du débat public.
2. **Procédure spéciale** : citation directe avec libellé précis des faits, à peine de nullité (art. 53).
3. **Règles probatoires particulières** : exception de vérité, présomption de bonne foi journalistique.
4. **Spécialisation des juridictions** : 17e chambre du tribunal correctionnel de Paris pour les délits de presse politiques.

## III. Les délits de presse

### La diffamation

Article 29 alinéa 1 : « Toute allégation ou imputation d'un fait qui porte atteinte à l'honneur ou à la considération de la personne ou du corps auquel le fait est imputé. »

L'imputation doit être suffisamment précise pour faire l'objet d'un débat sur la vérité. Les jugements de valeur, en revanche, relèvent de l'injure (art. 29 al. 2).

### L'injure

Définition à l'article 29 al. 2 : expression outrageante ne renfermant l'imputation d'aucun fait.

### Provocation et apologie

La loi de 1881 sanctionne la provocation aux crimes (art. 23, 24) et l'apologie d'actes terroristes (art. 24 al. 5, complétée par la loi du 13 nov. 2014).

## IV. Moyens de défense

Le journaliste poursuivi pour diffamation dispose principalement de deux moyens :

### L'exception de vérité

Article 35 : la preuve de la vérité des faits diffamatoires écarte la responsabilité. Conditions strictes : la preuve doit être parfaite, complète, antérieure aux poursuites. Exclusions : faits relatifs à la vie privée, faits remontant à plus de 10 ans (sauf condamnation non amnistiée).

### La bonne foi

Présomption jurisprudentielle qui exonère le journaliste s'il établit cumulativement quatre critères (Cass. crim., 11 juin 2013) :

- **Légitimité du but poursuivi** — débat d'intérêt général.
- **Absence d'animosité personnelle** — neutralité du propos.
- **Sérieux de l'enquête** — vérifications préalables, pluralité de sources.
- **Prudence et mesure dans l'expression** — distance par rapport aux affirmations.

La CEDH (Lingens c/ Autriche, 8 juill. 1986) protège plus fortement la critique des élus et personnalités publiques, qui doivent accepter un degré supérieur de surveillance.

## V. Évolutions et tensions

Le numérique a brouillé les frontières : la loi du 21 juin 2004 a étendu certaines règles de la loi de 1881 aux communications en ligne. La protection des sources (loi du 4 janv. 2010) consacre un droit nouveau, mais la jurisprudence reste prudente face à la sécurité publique (Cass. crim., 14 mai 2013).

## VI. Conclusion

La liberté de la presse, consubstantielle à la démocratie, repose sur un équilibre délicat entre liberté d'expression, protection de l'honneur des personnes et sauvegarde de l'ordre public. La maîtrise des moyens de défense — exception de vérité, bonne foi — distingue le simple usager du droit du véritable spécialiste.
`,
  },
  {
    id: 'demo-doc-deontologie-secret-pro',
    title: 'Cours — Déontologie : le secret professionnel de l\'avocat',
    category: 'course',
    daysAgo: 2,
    tags: ['déontologie', 'cours', 'RIN'],
    sourceType: 'text',
    content: `# Déontologie — Le secret professionnel de l'avocat

## I. Sources et fondement

Le secret professionnel de l'avocat trouve son ancrage dans plusieurs textes :

- **Article 66-5 de la loi du 31 décembre 1971** — « En toutes matières, que ce soit dans le domaine du conseil ou dans celui de la défense, les consultations adressées par un avocat à son client ou destinées à celui-ci, les correspondances échangées entre le client et son avocat, entre l'avocat et ses confrères, à l'exception pour ces dernières de celles portant la mention "officielle", les notes d'entretien et, plus généralement, toutes les pièces du dossier sont couvertes par le secret professionnel. »
- **Article 226-13 du Code pénal** — sanctionne la révélation d'une information à caractère secret par une personne qui en est dépositaire (1 an d'emprisonnement et 15 000 € d'amende).
- **Articles 2 et 3 du RIN** — obligations déontologiques générales et spécification du secret professionnel.

## II. Étendue

### Caractère général et absolu

Le secret est **général** : il couvre toutes les matières (civil, commercial, pénal, administratif), tous les domaines (conseil et défense), toutes les pièces (correspondances, notes, consultations).

Il est **absolu** dans son principe : il ne souffre aucune exception fondée sur l'opportunité ou l'intérêt général. La Cour de cassation rappelle régulièrement ce caractère absolu (Cass. crim., 14 nov. 2017, n° 16-87.275).

Il est **illimité dans le temps** — la fin du mandat ne lève pas le secret.

### Caractère d'ordre public

Le client lui-même ne peut délier l'avocat du secret professionnel (Cass. crim., 6 mai 1992). Le secret protège l'institution autant que le client.

## III. Les correspondances

L'article 66-5 distingue :

- **Correspondances confidentielles** entre avocat et client, et entre confrères — couvertes par le secret. Insaisissables, inopposables, irrecevables comme moyen de preuve.
- **Correspondances officielles** entre confrères (mention « officielle » apposée) — peuvent être produites en justice. Servent généralement à acter des positions formelles dans une négociation ou une procédure.

## IV. Les exceptions et tempéraments

### Lutte anti-blanchiment (TRACFIN)

L'avocat est soumis, dans certaines activités spécifiques (transactions immobilières, gestion d'actifs, montage de sociétés), à une obligation de déclaration de soupçon (art. L561-3 CMF). Sont exclues les activités de défense, conseil juridique, mandat ad hoc.

La déclaration passe par le bâtonnier qui filtre — la confidentialité initiale est préservée.

### Procédure pénale

Les perquisitions au cabinet d'un avocat sont strictement encadrées (art. 56-1 CPP) : présence du bâtonnier, contrôle effectif du juge des libertés et de la détention sur les pièces saisies.

### Défense pénale du client

L'avocat peut, pour les besoins de la défense, faire état d'éléments que le client lui a communiqués — toujours dans le cadre du mandat et dans l'intérêt du client.

## V. Sanctions

Le manquement au secret professionnel expose à :

- Sanctions **pénales** (art. 226-13 C. pén.) — un an d'emprisonnement et 15 000 € d'amende.
- Sanctions **disciplinaires** — peines pouvant aller jusqu'à la radiation (art. 184 décret du 27 nov. 1991).
- Sanctions **civiles** — engagement de la responsabilité civile professionnelle.

## VI. Tensions contemporaines

Les évolutions récentes mettent à l'épreuve le caractère absolu du secret :

- Les **données numériques** posent la question de la sécurisation matérielle des communications.
- La **transparence financière** (Panama Papers, Pandora Papers) interroge sur la protection accordée à certaines structurations patrimoniales.
- La directive européenne sur les **dispositifs transfrontaliers** (DAC 6) impose des obligations déclaratives à certains avocats fiscalistes.

## VII. Conclusion

Le secret professionnel n'est pas un privilège mais une garantie offerte au justiciable. Sa stricte observance est ce qui distingue la confiance dans la défense d'un simple échange. Tout candidat à la profession doit avoir intégré que le secret se construit dans la pratique quotidienne — bien plus que dans la déclamation des principes.
`,
  },
  // ─── Real PDFs from public/library/pdfs/crfpa — referenced by sourceUrl ───
  {
    id: 'demo-doc-pdf-sujet-2024-obligations',
    title: 'Sujet CRFPA 2024 — Droit des obligations',
    category: 'exam',
    daysAgo: 35,
    tags: ['CRFPA', 'sujet', 'obligations', '2024'],
    sourceType: 'pdf',
    sourceUrl: '/library/pdfs/crfpa/sujet-2024-obligations.pdf',
    content: `Sujet officiel d'examen d'accès au CRFPA — Session 2024 — Épreuve de droit des obligations.

L'épreuve de droit des obligations est une dissertation juridique de 3 heures, coefficient 2, qui constitue l'épreuve écrite obligatoire la plus discriminante du concours. Le sujet 2024 porte sur la formation et l'exécution du contrat, avec une attention particulière à la réforme de 2016.

Cette épreuve teste la capacité du candidat à structurer un raisonnement juridique en deux parties équilibrées (I/II, A/B), à problématiser un sujet général, à mobiliser les articles pertinents du Code civil et la jurisprudence la plus récente.

Les correcteurs valorisent : la précision des références (article + alinéa), l'identification des évolutions jurisprudentielles récentes, la capacité à articuler théorie et pratique, et la qualité de la rédaction (français juridique, transitions, problématisation).

Pour s'entraîner, le candidat est invité à : lire la grille de correction officielle 2025 (annexée), s'exercer sur des sujets d'années antérieures (2020-2023), et pratiquer le commentaire d'arrêts emblématiques sur la réforme.`,
  },
  {
    id: 'demo-doc-pdf-sujet-2024-procedures',
    title: 'Sujet CRFPA 2024 — Procédures',
    category: 'exam',
    daysAgo: 33,
    tags: ['CRFPA', 'sujet', 'procédures', '2024'],
    sourceType: 'pdf',
    sourceUrl: '/library/pdfs/crfpa/sujet-2024-procedures.pdf',
    content: `Sujet officiel d'examen d'accès au CRFPA — Session 2024 — Épreuve de procédure civile, pénale ou administrative (au choix).

L'épreuve de procédures est une dissertation juridique de 2 heures, coefficient 1, dans la procédure choisie par le candidat. Le sujet 2024 invite à examiner la place du contradictoire dans la procédure choisie.

Notes pour la préparation : (1) bien identifier la procédure choisie dès l'inscription ; (2) maîtriser les articles structurants du CPC, CPP ou CJA ; (3) intégrer les réformes récentes (loi du 23 mars 2019 pour la procédure civile, loi du 22 décembre 2021 pour l'organisation judiciaire). Les correcteurs apprécient particulièrement la qualité de la problématisation et la mobilisation de la jurisprudence récente.`,
  },
  {
    id: 'demo-doc-pdf-cas-pratiques-2023',
    title: 'Sujet CRFPA 2023 — Cas pratiques',
    category: 'exam',
    daysAgo: 30,
    tags: ['CRFPA', 'sujet', 'cas-pratique', '2023'],
    sourceType: 'pdf',
    sourceUrl: '/library/pdfs/crfpa/sujet-2023-cas-pratiques.pdf',
    content: `Sujet officiel d'examen d'accès au CRFPA — Session 2023 — Épreuve de cas pratiques (matière de spécialité au choix).

L'épreuve de cas pratiques (3 heures, coefficient 2) est une consultation juridique sur un dossier réel adapté à la matière de spécialité. Le candidat doit identifier les questions de droit, mobiliser le régime juridique pertinent, et formuler des conseils opérationnels argumentés.

Méthodologie attendue : (1) identifier précisément les parties et leurs intérêts respectifs ; (2) qualifier juridiquement chaque situation ; (3) examiner le régime applicable en exposant la règle, son fondement légal, et la jurisprudence pertinente ; (4) appliquer aux faits et formuler une conclusion claire ; (5) anticiper les réactions et stratégies adverses.`,
  },
  {
    id: 'demo-doc-pdf-grille-civil-2025',
    title: 'Grille de correction CRFPA 2025 — Droit civil',
    category: 'other',
    daysAgo: 38,
    tags: ['CRFPA', 'grille', 'civil', '2025', 'méthodologie'],
    sourceType: 'pdf',
    sourceUrl: '/library/pdfs/crfpa/grille-2025-civil.pdf',
    content: `Grille de correction officielle 2025 — Droit civil (matière de spécialité).

Document de référence pour comprendre les attentes du jury en matière de spécialité civil. La grille détaille les critères d'évaluation par axe (problématisation, structuration du plan, mobilisation des articles, jurisprudence, qualité rédactionnelle) et indique les pondérations relatives.

Points particulièrement valorisés : (1) la précision des références au Code civil (article + alinéa) ; (2) la mobilisation de la jurisprudence post-réforme 2016 ; (3) la capacité à dépasser le seul rappel des règles pour proposer une analyse critique ; (4) l'identification des points de tension (jurisprudence évolutive, dispositions controversées).

Erreurs récurrentes signalées par le jury : confusion entre nullité absolue et relative, oubli des conditions de fond et de forme, mauvaise identification de la jurisprudence applicable, plan trop chronologique sans logique conceptuelle.`,
  },
  {
    id: 'demo-doc-pdf-grille-note-synthese-2025',
    title: 'Grille de correction CRFPA 2025 — Note de synthèse',
    category: 'other',
    daysAgo: 40,
    tags: ['CRFPA', 'grille', 'note-synthèse', '2025', 'méthodologie'],
    sourceType: 'pdf',
    sourceUrl: '/library/pdfs/crfpa/grille-2025-note-synthese.pdf',
    content: `Grille de correction officielle 2025 — Note de synthèse.

L'épreuve de note de synthèse (5 heures, coefficient 3) est l'épreuve écrite la plus longue et celle dont les attendus méthodologiques sont les plus stricts. Le candidat reçoit un dossier de 15 à 25 pages comprenant des documents de natures variées (textes officiels, jurisprudence, doctrine, articles de presse) et doit produire une synthèse de 4 pages maximum.

Critères d'évaluation : (1) couverture du dossier — exploitation de tous les documents pertinents ; (2) construction du plan — apparente, structurée, équilibrée ; (3) problématique — claire, articulée au sujet, dégagée du dossier ; (4) qualité de la synthèse — neutralité, fidélité aux documents, pas d'apport personnel ; (5) longueur — respect strict des 4 pages ; (6) rédaction — français juridique, transitions soignées, pas de citations longues.

Pièges classiques : exploitation déséquilibrée des documents, plan trop scolaire, citations trop nombreuses, dépassement du nombre de pages, absence de transition entre I et II, conclusion qui prend parti.`,
  },
]

// ─── Coaching sessions ───────────────────────────────────────────

interface DemoCoachingSession {
  id: string
  type: 'syllogisme' | 'plan-detaille' | 'fiche-arret' | 'commentaire-arret' | 'cas-pratique' | 'note-synthese' | 'grand-oral'
  daysAgo: number
  /** Whether the session is graded, in-progress (no grading), or just a task (no submission). */
  state: 'graded' | 'in-progress' | 'fresh'
  task: unknown   // serialized as JSON in coachingSessions.task
  submission?: unknown
  grading?: unknown
}

export const CRFPA_DEMO_COACHING_SESSIONS: DemoCoachingSession[] = [
  // ─── Syllogisme — Responsabilité contractuelle (graded, 22/30) ───
  {
    id: 'demo-syll-resp-contractuelle-1',
    type: 'syllogisme',
    daysAgo: 14,
    state: 'graded',
    task: ((): SyllogismeTask => ({
      theme: 'Responsabilité contractuelle',
      difficulty: 'intermediate',
      scenario: `Madame Lefebvre a commandé à un menuisier la fabrication d'une bibliothèque sur mesure pour un montant de 4 200 € selon devis signé le 12 janvier. La livraison était prévue pour le 15 mars. Le 22 mars, le menuisier livre une bibliothèque dont les dimensions diffèrent de plusieurs centimètres du devis et dont la teinte du bois ne correspond pas à l'échantillon validé. Madame Lefebvre adresse une mise en demeure le 24 mars demandant la mise en conformité ou, à défaut, la résolution du contrat. Le menuisier refuse, invoquant les "tolérances d'usage" du métier.`,
      question: `Madame Lefebvre peut-elle obtenir réparation sur le fondement de la responsabilité contractuelle ?`,
      sourceArticles: [
        {
          articleNum: '1217',
          codeName: 'Code civil',
          breadcrumb: 'Livre III, Titre III, Sous-titre I, Chapitre IV, Section 5',
          text: `La partie envers laquelle l'engagement n'a pas été exécuté, ou l'a été imparfaitement, peut : refuser d'exécuter ou suspendre l'exécution de sa propre obligation ; poursuivre l'exécution forcée en nature de l'obligation ; obtenir une réduction du prix ; provoquer la résolution du contrat ; demander réparation des conséquences de l'inexécution.`,
        },
        {
          articleNum: '1231-1',
          codeName: 'Code civil',
          text: `Le débiteur est condamné, s'il y a lieu, au paiement de dommages et intérêts soit à raison de l'inexécution de l'obligation, soit à raison du retard dans l'exécution, s'il ne justifie pas que l'exécution a été empêchée par la force majeure.`,
        },
        {
          articleNum: '1103',
          codeName: 'Code civil',
          text: `Les contrats légalement formés tiennent lieu de loi à ceux qui les ont faits.`,
        },
      ],
      modelSyllogisme: {
        majeure: {
          article: 'Art. 1231-1 et 1217 C. civ.',
          rule: `Le créancier d'une obligation contractuelle inexécutée peut, après mise en demeure, obtenir l'exécution forcée en nature ou la résolution du contrat assortie de dommages-intérêts.`,
          elements: [
            `Existence d'un contrat valablement formé`,
            `Inexécution ou exécution imparfaite imputable au débiteur`,
            `Mise en demeure préalable du débiteur`,
            `Absence de cas de force majeure exonératoire`,
          ],
        },
        mineure: {
          factMappings: [
            { element: `Existence d'un contrat valablement formé`, fact: `Le devis du 12 janvier signé par Madame Lefebvre constitue un contrat de louage d'ouvrage.` },
            { element: `Inexécution ou exécution imparfaite imputable au débiteur`, fact: `Les dimensions et la teinte non conformes au devis caractérisent une exécution imparfaite imputable au menuisier.` },
            { element: `Mise en demeure préalable du débiteur`, fact: `La mise en demeure du 24 mars satisfait à la condition formelle.` },
            { element: `Absence de cas de force majeure exonératoire`, fact: `Le menuisier n'invoque qu'une "tolérance d'usage" qui ne constitue pas une cause d'exonération opposable au cocontractant.` },
          ],
        },
        conclusion: {
          answer: `Madame Lefebvre peut obtenir l'exécution forcée en nature (mise en conformité) ou, à défaut, la résolution du contrat assortie de dommages-intérêts.`,
          justification: `Toutes les conditions de la responsabilité contractuelle sont réunies. Les usages du métier ne peuvent prévaloir sur les stipulations claires du devis (art. 1188 C. civ.).`,
        },
      },
      generatedAt: isoDaysAgo(DEFAULT_ANCHOR, 14),
    }))(),
    submission: ((): SyllogismeSubmission => ({
      majeure: `L'article 1231-1 du Code civil prévoit que le débiteur d'une obligation inexécutée doit réparer le préjudice causé. L'article 1217 ouvre au créancier plusieurs options : exécution forcée, résolution, réduction du prix, dommages-intérêts. Pour engager la responsabilité contractuelle, il faut donc un contrat, une inexécution imputable au débiteur et une mise en demeure préalable.`,
      mineure: `Madame Lefebvre a signé un devis avec le menuisier le 12 janvier. Ce devis constitue un contrat. Le menuisier a livré une bibliothèque non conforme aux dimensions et à la teinte prévues. Madame Lefebvre a adressé une mise en demeure le 24 mars. Le menuisier invoque les usages mais ne prouve pas la force majeure.`,
      conclusion: `Madame Lefebvre peut donc demander la mise en conformité ou la résolution du contrat avec dommages-intérêts. Elle peut choisir entre les options offertes par l'article 1217.`,
      submittedAt: isoDaysAgo(DEFAULT_ANCHOR, 14),
    }))(),
    grading: ((): SyllogismeGrading => ({
      majeure: {
        score: 8,
        articleCorrect: true,
        elementsIdentified: [
          { element: `Existence d'un contrat valablement formé`, found: true },
          { element: `Inexécution ou exécution imparfaite imputable au débiteur`, found: true },
          { element: `Mise en demeure préalable du débiteur`, found: true },
          { element: `Absence de cas de force majeure exonératoire`, found: false },
        ],
        feedback: `Très bonne identification des articles 1231-1 et 1217. Les trois premiers éléments constitutifs sont énoncés clairement. Vous avez en revanche oublié l'absence de force majeure comme condition d'engagement de la responsabilité — c'est pourtant une donnée structurante puisque le menuisier tente de s'exonérer en invoquant les usages.`,
      },
      mineure: {
        score: 7,
        mappings: [
          { element: `Existence d'un contrat valablement formé`, mapped: true },
          { element: `Inexécution ou exécution imparfaite imputable au débiteur`, mapped: true },
          { element: `Mise en demeure préalable du débiteur`, mapped: true },
          { element: `Absence de cas de force majeure exonératoire`, mapped: true, note: `Vous l'évoquez mais sans citer l'article 1188 qui écarte les usages contraires aux stipulations.` },
        ],
        feedback: `La qualification des faits est correcte mais elle manque de précision juridique. Évitez le raccourci "ce devis constitue un contrat" — précisez qu'il s'agit d'un contrat de louage d'ouvrage (art. 1779). L'argument du menuisier sur les "tolérances d'usage" méritait une réfutation explicite via l'article 1188 C. civ.`,
      },
      conclusion: {
        score: 7,
        explicit: true,
        justified: true,
        nuanced: false,
        feedback: `La conclusion est claire et offre les deux options (mise en conformité, résolution). Manque une nuance : Madame Lefebvre doit normalement privilégier l'exécution forcée en nature (art. 1221) avant de pouvoir prétendre à la résolution. Précisez aussi que les dommages-intérêts cumulables couvrent le préjudice résultant du retard et de la non-conformité.`,
      },
      overall: {
        score: 22,
        topMistake: `Oubli de l'absence de force majeure comme condition de fond, et absence de référence à l'article 1188 sur la primauté des stipulations sur les usages.`,
        strength: `Structure du syllogisme respectée et articulation claire entre majeure et mineure. La hiérarchie des sanctions de l'article 1217 est correctement identifiée.`,
      },
      gradedAt: isoDaysAgo(DEFAULT_ANCHOR, 14),
    }))(),
  },

  // ─── Plan détaillé — La force obligatoire du contrat (graded, 24/30) ───
  {
    id: 'demo-plan-force-obligatoire-1',
    type: 'plan-detaille',
    daysAgo: 9,
    state: 'graded',
    task: ((): PlanTask => ({
      question: `La force obligatoire du contrat`,
      themeLabel: `Droit des contrats — théorie générale`,
      sourceArticles: [
        { articleNum: '1103', codeName: 'Code civil', text: `Les contrats légalement formés tiennent lieu de loi à ceux qui les ont faits.` },
        { articleNum: '1104', codeName: 'Code civil', text: `Les contrats doivent être négociés, formés et exécutés de bonne foi.` },
        { articleNum: '1193', codeName: 'Code civil', text: `Les contrats ne peuvent être modifiés ou révoqués que du consentement mutuel des parties, ou pour les causes que la loi autorise.` },
        { articleNum: '1195', codeName: 'Code civil', text: `Si un changement de circonstances imprévisible lors de la conclusion du contrat rend l'exécution excessivement onéreuse pour une partie qui n'avait pas accepté d'en assumer le risque, celle-ci peut demander une renégociation du contrat à son cocontractant.` },
      ],
      modelPlan: {
        problematique: `La force obligatoire du contrat, principe cardinal du droit des obligations, demeure-t-elle absolue à l'heure où l'ordonnance du 10 février 2016 a consacré la révision pour imprévision et où la jurisprudence multiplie les tempéraments à la liberté contractuelle ?`,
        I: {
          title: `Une force obligatoire affirmée comme principe`,
          IA: `Le fondement classique de la force obligatoire — théorie de l'autonomie de la volonté, codification à l'article 1103 C. civ., adage pacta sunt servanda. Référence à Domat et Pothier, à la jurisprudence Canal de Craponne (Cass. civ., 6 mars 1876).`,
          IB: `Les corollaires du principe — irrévocabilité unilatérale (art. 1193), opposabilité du contrat aux tiers (art. 1200), exécution de bonne foi (art. 1104), et sanctions (exécution forcée art. 1221, résolution art. 1224, dommages-intérêts art. 1231-1).`,
        },
        II: {
          title: `Une force obligatoire tempérée par des facteurs extérieurs`,
          IIA: `Les tempéraments légaux et jurisprudentiels classiques — réfaction du contrat par le juge (clauses pénales, art. 1231-5), théorie de l'imprévision en droit administratif (CE, 30 mars 1916, Gaz de Bordeaux), exception d'inexécution (art. 1219).`,
          IIB: `La consécration moderne d'une force obligatoire négociable — l'article 1195 C. civ. introduit la révision pour imprévision en droit privé, le contrôle des clauses abusives dans les contrats d'adhésion (art. 1171), le devoir d'information (art. 1112-1).`,
        },
        transitions: {
          intro_to_I: `Si le principe de force obligatoire trouve son ancrage dans l'autonomie de la volonté et continue de structurer le droit des contrats, sa portée est progressivement infléchie.`,
          I_to_II: `Cependant, l'absoluité du principe a toujours composé avec des nécessités d'équité et d'équilibre, désormais consacrées par la réforme de 2016.`,
        },
        anchors: {
          IA: `Cass. civ., 6 mars 1876, Canal de Craponne ; art. 1103 C. civ.`,
          IB: `Art. 1193, 1200, 1104, 1221, 1224, 1231-1 C. civ.`,
          IIA: `Art. 1231-5 (clauses pénales), CE 30 mars 1916 Gaz de Bordeaux, art. 1219 (exception d'inexécution).`,
          IIB: `Art. 1195 (imprévision), 1171 (clauses abusives), 1112-1 (information).`,
        },
      },
      commonPitfalls: [
        `Énoncer un plan I/II purement chronologique (avant/après 2016) sans dégager une logique conceptuelle.`,
        `Confondre la force obligatoire (entre parties) avec l'opposabilité (à l'égard des tiers).`,
        `Oublier la dimension internationale (CVIM, Principes Unidroit) si le sujet le permet.`,
      ],
      generatedAt: isoDaysAgo(DEFAULT_ANCHOR, 9),
    }))(),
    submission: ((): PlanSubmission => ({
      problematique: `Dans quelle mesure la force obligatoire du contrat, consacrée à l'article 1103 du Code civil, conserve-t-elle son caractère absolu face à l'évolution récente du droit des obligations et notamment à la consécration de la révision pour imprévision par l'article 1195 ?`,
      I: {
        title: `Une force obligatoire principe fondamental du droit des contrats`,
        IA: `Le fondement de la force obligatoire — théorie de l'autonomie de la volonté, article 1103 du Code civil, adage pacta sunt servanda, jurisprudence Canal de Craponne de 1876 confirmant que le juge ne peut modifier les conventions.`,
        IB: `Les conséquences du principe — interdiction de la révocation unilatérale (art. 1193), exécution forcée des obligations (art. 1221), sanctions de l'inexécution (art. 1217).`,
      },
      II: {
        title: `Une force obligatoire désormais relative`,
        IIA: `Les tempéraments traditionnels — clauses pénales modérées par le juge (art. 1231-5), exception d'inexécution (art. 1219), théorie de l'imprévision en droit administratif (CE 1916 Gaz de Bordeaux).`,
        IIB: `Les évolutions récentes — révision pour imprévision (art. 1195), contrôle des clauses abusives dans les contrats d'adhésion (art. 1171), obligation précontractuelle d'information (art. 1112-1).`,
      },
      submittedAt: isoDaysAgo(DEFAULT_ANCHOR, 9),
    }))(),
    grading: ((): PlanGrading => ({
      axes: [
        { axis: 'problematique', label: 'Problématique', score: 4, feedback: `Problématique claire, articulant principe et exception. Vous auriez gagné en finesse en interrogeant non seulement la "mesure" de l'absoluité, mais aussi la nature même du principe — fondement individualiste vs. fondement social du contrat.` },
        { axis: 'opposition', label: 'Opposition I/II', score: 4, feedback: `L'opposition entre principe et tempérament est nette. Le titre du II (« désormais relative ») est trop fort — il aurait été préférable de parler d'une force obligatoire « tempérée » ou « infléchie ».` },
        { axis: 'equilibre', label: 'Équilibre des parties', score: 4, feedback: `Bon équilibre entre I.A/I.B et II.A/II.B. Le II.A est légèrement plus pauvre que les autres sous-parties (deux exemples seulement) — densifiez-le avec une référence à la stabilité contractuelle face aux tiers.` },
        { axis: 'chevauchement', label: 'Absence de chevauchement', score: 5, feedback: `Aucun chevauchement notable entre les sous-parties. Chaque idée trouve sa place unique dans le plan.` },
        { axis: 'couverture', label: 'Couverture du sujet', score: 4, feedback: `Couverture solide de la théorie générale. Manque la dimension internationale et comparatiste (CVIM, Principes Unidroit) qui aurait enrichi le II.B. La bonne foi (art. 1104) est sous-exploitée — elle aurait pu nourrir un I.B sur les modalités d'exécution.` },
        { axis: 'transitions', label: 'Transitions', score: 3, feedback: `Les transitions ne figurent pas dans votre soumission. C'est une lacune méthodologique : la transition I → II est attendue par le correcteur. Pensez à formuler une phrase explicite de bascule.` },
      ],
      overall: {
        score: 24,
        topMistake: `Absence de transitions explicites et titre du II trop tranchant ("désormais relative" suggère un renversement, alors que vous démontrez en réalité un infléchissement).`,
        strength: `Plan très clair, problématique correctement positionnée, articles cités avec précision. La structure I/II reflète fidèlement l'opposition principe/tempérament.`,
      },
      gradedAt: isoDaysAgo(DEFAULT_ANCHOR, 9),
    }))(),
  },

  // ─── Syllogisme — Vol aggravé (graded, 18/30, beginner) ───
  {
    id: 'demo-syll-vol-aggrave-1',
    type: 'syllogisme',
    daysAgo: 28,
    state: 'graded',
    task: ((): SyllogismeTask => ({
      theme: 'Vol et circonstances aggravantes',
      difficulty: 'beginner',
      scenario: `Trois individus, après s'être concertés à la sortie d'un bar, se rendent à 23h dans un magasin de téléphonie. L'un d'eux brise la vitrine à coups de marteau pendant que les deux autres pénètrent à l'intérieur et emportent dix téléphones portables d'une valeur totale de 8 500 €. Ils sont interpellés trois rues plus loin par une patrouille de police.`,
      question: `Quelle qualification pénale retenir contre les trois individus ?`,
      sourceArticles: [
        { articleNum: '311-1', codeName: 'Code pénal', text: `Le vol est la soustraction frauduleuse de la chose d'autrui.` },
        { articleNum: '311-4', codeName: 'Code pénal', text: `Le vol est puni de cinq ans d'emprisonnement et de 75 000 euros d'amende lorsqu'il est commis : 1° Par plusieurs personnes agissant en qualité d'auteur ou de complice, sans qu'elles constituent une bande organisée ; (...) 4° Avec usage ou menace d'une arme ; (...) 8° Dans un local d'habitation ou dans un lieu utilisé ou destiné à l'entrepôt de fonds, valeurs, marchandises ou matériels.` },
      ],
      modelSyllogisme: {
        majeure: { article: 'Art. 311-1 et 311-4 1° et 8° C. pén.', rule: `Le vol est la soustraction frauduleuse de la chose d'autrui ; les circonstances aggravantes de réunion et de commission dans un local d'entrepôt portent la peine à cinq ans.`, elements: [`Soustraction matérielle`, `Chose appartenant à autrui`, `Élément intentionnel (animus domini)`, `Pluralité d'auteurs`, `Local d'entrepôt de marchandises`] },
        mineure: { factMappings: [
          { element: `Soustraction matérielle`, fact: `Les trois individus ont emporté les téléphones après bris de vitrine.` },
          { element: `Chose appartenant à autrui`, fact: `Les téléphones appartiennent au commerçant.` },
          { element: `Élément intentionnel (animus domini)`, fact: `La concertation préalable et le mode opératoire démontrent l'intention de s'approprier.` },
          { element: `Pluralité d'auteurs`, fact: `Trois personnes agissent de concert.` },
          { element: `Local d'entrepôt de marchandises`, fact: `Le magasin de téléphonie est un lieu destiné à l'entrepôt de matériel.` },
        ] },
        conclusion: { answer: `Les trois individus se rendent coupables de vol aggravé par la pluralité d'auteurs et la commission dans un local d'entrepôt (5 ans / 75 000 €).`, justification: `Les éléments matériels et intentionnels du vol sont caractérisés ; deux circonstances aggravantes de l'art. 311-4 sont réunies.` },
      },
      generatedAt: isoDaysAgo(DEFAULT_ANCHOR, 28),
    }))(),
    submission: ((): SyllogismeSubmission => ({
      majeure: `L'article 311-1 du Code pénal définit le vol comme la soustraction frauduleuse de la chose d'autrui. L'article 311-4 prévoit des aggravations notamment quand le vol est commis par plusieurs personnes.`,
      mineure: `Les trois individus ont brisé la vitrine et emporté les téléphones. Ils ont agi à plusieurs et avec l'intention de voler. Le vol est consommé.`,
      conclusion: `Ils sont coupables de vol aggravé.`,
      submittedAt: isoDaysAgo(DEFAULT_ANCHOR, 28),
    }))(),
    grading: ((): SyllogismeGrading => ({
      majeure: { score: 5, articleCorrect: true, elementsIdentified: [
        { element: `Soustraction matérielle`, found: true },
        { element: `Chose appartenant à autrui`, found: false },
        { element: `Élément intentionnel (animus domini)`, found: false },
        { element: `Pluralité d'auteurs`, found: true },
        { element: `Local d'entrepôt de marchandises`, found: false },
      ], feedback: `Les articles sont cités mais sans précision sur les alinéas applicables. Vous oubliez la circonstance aggravante du local d'entrepôt — pourtant centrale ici puisque le bris de vitrine cible un magasin.` },
      mineure: { score: 6, mappings: [
        { element: `Soustraction matérielle`, mapped: true },
        { element: `Chose appartenant à autrui`, mapped: false, note: `Vous ne précisez pas que les téléphones appartiennent au commerçant.` },
        { element: `Élément intentionnel`, mapped: true },
        { element: `Pluralité d'auteurs`, mapped: true },
        { element: `Local d'entrepôt`, mapped: false },
      ], feedback: `Qualification trop rapide. Chaque élément constitutif doit être qualifié explicitement avec la formule "constitue [élément]". L'animus domini mérite davantage qu'une simple mention de l'intention.` },
      conclusion: { score: 7, explicit: true, justified: false, nuanced: false, feedback: `La conclusion est trop laconique. Elle doit énoncer la qualification précise (vol aggravé par pluralité d'auteurs ET local d'entrepôt) et la peine encourue (5 ans / 75 000 €).` },
      overall: { score: 18, topMistake: `Oubli de la circonstance aggravante du local d'entrepôt et qualification trop superficielle des éléments constitutifs.`, strength: `Bonne identification de la qualification de vol et de la circonstance de pluralité d'auteurs.` },
      gradedAt: isoDaysAgo(DEFAULT_ANCHOR, 28),
    }))(),
  },

  // ─── Syllogisme — Vices du consentement (graded, 26/30, advanced) ───
  {
    id: 'demo-syll-vices-consentement-1',
    type: 'syllogisme',
    daysAgo: 19,
    state: 'graded',
    task: ((): SyllogismeTask => ({
      theme: 'Vices du consentement',
      difficulty: 'advanced',
      scenario: `M. Fontaine acquiert un appartement parisien sur la base d'une plaquette commerciale présentant l'opération comme garantissant un rendement locatif net de 7 % par an. La plaquette omet de mentionner que l'immeuble fait l'objet d'une procédure préfectorale de péril non résolu, connue du vendeur depuis 18 mois. M. Fontaine découvre la procédure quatre mois après la signature de l'acte authentique et le rendement effectif s'avère plafonné à 2,8 %.`,
      question: `M. Fontaine peut-il obtenir l'annulation du contrat sur le fondement des vices du consentement ?`,
      sourceArticles: [
        { articleNum: '1130', codeName: 'Code civil', text: `L'erreur, le dol et la violence vicient le consentement lorsqu'ils sont de telle nature que, sans eux, l'une des parties n'aurait pas contracté ou aurait contracté à des conditions substantiellement différentes.` },
        { articleNum: '1137', codeName: 'Code civil', text: `Le dol est le fait pour un contractant d'obtenir le consentement de l'autre par des manœuvres ou des mensonges. Constitue également un dol la dissimulation intentionnelle par l'une des parties d'une information dont elle sait le caractère déterminant pour l'autre partie.` },
        { articleNum: '1112-1', codeName: 'Code civil', text: `Celle des parties qui connaît une information dont l'importance est déterminante pour le consentement de l'autre doit l'en informer dès lors que, légitimement, cette dernière ignore cette information ou fait confiance à son cocontractant.` },
      ],
      modelSyllogisme: {
        majeure: { article: 'Art. 1130, 1137 al. 2 et 1112-1 C. civ.', rule: `La réticence dolosive — dissimulation intentionnelle d'une information déterminante du consentement — vicie le consentement et permet la nullité relative du contrat.`, elements: [`Information déterminante du consentement`, `Connaissance par le cocontractant`, `Dissimulation intentionnelle`, `Caractère légitime de l'ignorance`] },
        mineure: { factMappings: [
          { element: `Information déterminante du consentement`, fact: `La procédure de péril et son impact sur le rendement sont déterminants — un acquéreur informé n'aurait pas contracté ou aurait contracté à des conditions substantiellement différentes.` },
          { element: `Connaissance par le cocontractant`, fact: `Le vendeur connaît la procédure depuis 18 mois.` },
          { element: `Dissimulation intentionnelle`, fact: `L'omission dans la plaquette commerciale, présentée comme exhaustive, caractérise la dissimulation.` },
          { element: `Caractère légitime de l'ignorance`, fact: `M. Fontaine, acquéreur non professionnel, pouvait légitimement se fier à la documentation commerciale.` },
        ] },
        conclusion: { answer: `M. Fontaine peut obtenir la nullité relative du contrat pour réticence dolosive (art. 1131 et 1144 C. civ.) et, alternativement ou cumulativement, demander des dommages-intérêts (art. 1240).`, justification: `Les quatre conditions de la réticence dolosive sont réunies. La nullité relative se prescrit par 5 ans à compter de la découverte du vice (art. 2224).` },
      },
      generatedAt: isoDaysAgo(DEFAULT_ANCHOR, 19),
    }))(),
    submission: ((): SyllogismeSubmission => ({
      majeure: `L'article 1130 du Code civil dispose que le dol vicie le consentement lorsqu'il est tel que, sans lui, la partie n'aurait pas contracté. L'article 1137 alinéa 2, issu de l'ordonnance de 2016, consacre la réticence dolosive : la dissimulation intentionnelle d'une information dont le caractère déterminant est connu de celui qui la dissimule. L'article 1112-1 fonde l'obligation précontractuelle d'information sur le critère de l'asymétrie informationnelle entre les parties. Quatre conditions doivent être réunies : information déterminante, connaissance par le cocontractant, dissimulation intentionnelle, ignorance légitime.`,
      mineure: `En l'espèce, la procédure de péril préfectoral est manifestement déterminante — elle compromet la rentabilité de l'opération et la sécurité de l'investissement. Le vendeur, qui en a connaissance depuis 18 mois, ne pouvait l'ignorer. L'absence de mention dans la plaquette — document présenté comme synthétique — caractérise la dissimulation intentionnelle. M. Fontaine, acquéreur non-professionnel, pouvait légitimement se fier à la documentation fournie par le vendeur. L'écart entre rendement annoncé (7 %) et rendement réel (2,8 %) confirme le caractère déterminant.`,
      conclusion: `M. Fontaine peut obtenir la nullité relative du contrat sur le fondement de l'article 1131 du Code civil. Il dispose d'un délai de 5 ans à compter de la découverte du vice (art. 2224). Il peut alternativement demander des dommages-intérêts pour le préjudice subi (art. 1240) — le cumul est admis (Cass. com., 17 janv. 2018).`,
      submittedAt: isoDaysAgo(DEFAULT_ANCHOR, 19),
    }))(),
    grading: ((): SyllogismeGrading => ({
      majeure: { score: 9, articleCorrect: true, elementsIdentified: [
        { element: `Information déterminante du consentement`, found: true },
        { element: `Connaissance par le cocontractant`, found: true },
        { element: `Dissimulation intentionnelle`, found: true },
        { element: `Caractère légitime de l'ignorance`, found: true },
      ], feedback: `Excellente articulation des trois articles fondateurs. Les quatre conditions sont énoncées clairement. Une référence à la jurisprudence Baldus (Cass. 1re civ., 3 mai 2000) ou à l'arrêt fondateur de la chambre mixte du 21 décembre 2007 aurait élevé encore davantage la majeure.` },
      mineure: { score: 9, mappings: [
        { element: `Information déterminante du consentement`, mapped: true },
        { element: `Connaissance par le cocontractant`, mapped: true },
        { element: `Dissimulation intentionnelle`, mapped: true },
        { element: `Caractère légitime de l'ignorance`, mapped: true },
      ], feedback: `Qualification précise et rigoureuse. L'articulation entre rendement annoncé et rendement réel comme indice du caractère déterminant est particulièrement bienvenue.` },
      conclusion: { score: 8, explicit: true, justified: true, nuanced: true, feedback: `Conclusion solide et nuancée. La précision de la prescription (5 ans / découverte) et la mention du cumul nullité/dommages-intérêts sont remarquables. Vous auriez pu ajouter une réflexion sur la stratégie : la nullité restituerait le bien mais le délai de prescription court.` },
      overall: { score: 26, topMistake: `Pas de jurisprudence emblématique citée dans la majeure (chambre mixte 2007, arrêt Baldus).`, strength: `Maîtrise de la triple base textuelle (1130, 1137 al. 2, 1112-1) et qualification précise des quatre conditions de la réticence dolosive.` },
      gradedAt: isoDaysAgo(DEFAULT_ANCHOR, 19),
    }))(),
  },

  // ─── Syllogisme — Recours pour excès de pouvoir (graded, 14/30) ───
  {
    id: 'demo-syll-rep-1',
    type: 'syllogisme',
    daysAgo: 6,
    state: 'graded',
    task: ((): SyllogismeTask => ({
      theme: 'Recours pour excès de pouvoir',
      difficulty: 'advanced',
      scenario: `Une association de défense de l'environnement a déposé un recours en annulation contre un arrêté préfectoral autorisant l'implantation d'une carrière. La requête, déposée le 78e jour suivant la publication de l'arrêté, invoque l'incompétence de l'auteur de l'acte et l'erreur d'appréciation. Le préfet soulève l'irrecevabilité pour tardiveté, l'association réplique en soutenant que la mention des voies et délais de recours était insuffisante.`,
      question: `Le recours est-il recevable ?`,
      sourceArticles: [
        { articleNum: 'R421-1', codeName: 'Code de justice administrative', text: `La juridiction ne peut être saisie que par voie de recours formé contre une décision, et ce, dans les deux mois à partir de la notification ou de la publication de la décision attaquée.` },
        { articleNum: 'R421-5', codeName: 'Code de justice administrative', text: `Les délais de recours contre une décision administrative ne sont opposables qu'à la condition d'avoir été mentionnés, ainsi que les voies de recours, dans la notification de la décision.` },
      ],
      modelSyllogisme: {
        majeure: { article: 'Art. R421-1 et R421-5 CJA', rule: `Le délai de deux mois pour former un recours pour excès de pouvoir n'est opposable qu'à la condition que la notification ou la publication ait régulièrement mentionné les voies et délais de recours.`, elements: [`Existence d'un délai de deux mois`, `Mention des voies et délais de recours`, `Régularité de la publication`, `Conséquence : opposabilité du délai`] },
        mineure: { factMappings: [
          { element: `Existence d'un délai de deux mois`, fact: `78 jours se sont écoulés depuis la publication, dépassant les 60 jours.` },
          { element: `Mention des voies et délais de recours`, fact: `L'association soutient que cette mention était insuffisante.` },
          { element: `Régularité de la publication`, fact: `À vérifier au regard de la jurisprudence Czabaj (CE, ass., 13 juill. 2016) qui pose un délai raisonnable d'un an même en l'absence de mention.` },
          { element: `Conséquence : opposabilité du délai`, fact: `Si la mention est insuffisante, le délai est inopposable mais le délai raisonnable d'un an s'applique néanmoins.` },
        ] },
        conclusion: { answer: `Le recours peut être recevable si l'association démontre l'insuffisance de la mention des voies et délais ; à défaut, il est irrecevable comme tardif.`, justification: `La jurisprudence Czabaj a tempéré la sanction de l'absence ou insuffisance de mention par un délai raisonnable d'un an, qui n'est pas dépassé en l'espèce (78 jours).` },
      },
      generatedAt: isoDaysAgo(DEFAULT_ANCHOR, 6),
    }))(),
    submission: ((): SyllogismeSubmission => ({
      majeure: `L'article R421-1 du Code de justice administrative prévoit un délai de deux mois pour former un recours contre une décision administrative. L'article R421-5 précise que ce délai n'est opposable que si les voies et délais ont été mentionnés.`,
      mineure: `Le recours a été déposé après 78 jours, soit au-delà des deux mois. L'association invoque l'insuffisance de la mention des voies et délais.`,
      conclusion: `Le recours est tardif et donc irrecevable.`,
      submittedAt: isoDaysAgo(DEFAULT_ANCHOR, 6),
    }))(),
    grading: ((): SyllogismeGrading => ({
      majeure: { score: 5, articleCorrect: true, elementsIdentified: [
        { element: `Existence d'un délai de deux mois`, found: true },
        { element: `Mention des voies et délais de recours`, found: true },
        { element: `Régularité de la publication`, found: false },
        { element: `Conséquence : opposabilité du délai`, found: false },
      ], feedback: `Articles correctement cités mais aucune référence à la jurisprudence Czabaj (CE, ass., 13 juill. 2016) qui révolutionne pourtant ce contentieux. Il manque l'articulation entre l'inopposabilité du délai (en cas de défaut de mention) et le délai raisonnable d'un an que pose Czabaj.` },
      mineure: { score: 5, mappings: [
        { element: `Existence d'un délai de deux mois`, mapped: true },
        { element: `Mention des voies et délais`, mapped: true },
        { element: `Régularité de la publication`, mapped: false },
        { element: `Conséquence`, mapped: false },
      ], feedback: `Qualification superficielle. Vous ne discutez pas l'argument de l'association sur l'insuffisance de la mention. Une analyse fine aurait examiné si une mention est insuffisante par lacune ou par imprécision, et la portée de chaque hypothèse.` },
      conclusion: { score: 4, explicit: true, justified: false, nuanced: false, feedback: `Conclusion erronée. La jurisprudence Czabaj impose un délai raisonnable d'un an même en l'absence de mention — donc 78 jours laisse la place à la recevabilité si l'insuffisance est démontrée. Conclusion alternative attendue.` },
      overall: { score: 14, topMistake: `Méconnaissance de la jurisprudence Czabaj (CE 13 juill. 2016) qui est pourtant le pivot du contentieux des délais en REP depuis 2016.`, strength: `Identification correcte des articles applicables et de la nature du débat (opposabilité du délai).` },
      gradedAt: isoDaysAgo(DEFAULT_ANCHOR, 6),
    }))(),
  },

  // ─── Syllogisme — Responsabilité délictuelle (graded, 24/30) ───
  {
    id: 'demo-syll-resp-delictuelle-1',
    type: 'syllogisme',
    daysAgo: 3,
    state: 'graded',
    task: ((): SyllogismeTask => ({
      theme: 'Responsabilité délictuelle',
      difficulty: 'intermediate',
      scenario: `Lors d'un match de football amateur, M. Allard, joueur de l'équipe locale, donne un coup de coude à un adversaire pour s'imposer dans un duel aérien. L'adversaire chute lourdement et subit une fracture du nez avec ITT de 30 jours. Le geste, non sanctionné par l'arbitre, est cependant qualifié de « violent » dans le rapport d'arbitrage.`,
      question: `M. Allard peut-il être condamné à indemniser son adversaire ?`,
      sourceArticles: [
        { articleNum: '1240', codeName: 'Code civil', text: `Tout fait quelconque de l'homme, qui cause à autrui un dommage, oblige celui par la faute duquel il est arrivé à le réparer.` },
        { articleNum: '1241', codeName: 'Code civil', text: `Chacun est responsable du dommage qu'il a causé non seulement par son fait, mais encore par sa négligence ou par son imprudence.` },
      ],
      modelSyllogisme: {
        majeure: { article: 'Art. 1240 et 1241 C. civ.', rule: `La responsabilité délictuelle suppose la réunion d'une faute, d'un dommage et d'un lien de causalité ; en matière sportive, seule la faute caractérisée par une violation des règles du jeu engage la responsabilité.`, elements: [`Faute caractérisée — violation des règles sportives`, `Dommage corporel certain`, `Lien de causalité direct`, `Acceptation des risques inhérents au sport (limite)`] },
        mineure: { factMappings: [
          { element: `Faute caractérisée`, fact: `Le coup de coude qualifié de violent excède les risques normaux du jeu.` },
          { element: `Dommage corporel certain`, fact: `Fracture du nez avec ITT de 30 jours.` },
          { element: `Lien de causalité direct`, fact: `Le geste est la cause directe et exclusive de la chute et de la fracture.` },
          { element: `Acceptation des risques (limite)`, fact: `L'acceptation des risques sportifs ne couvre pas les actes de violence excédant les règles du jeu (Cass. 2e civ., 4 nov. 2010).` },
        ] },
        conclusion: { answer: `M. Allard engage sa responsabilité délictuelle et doit indemniser le préjudice corporel de son adversaire.`, justification: `La faute caractérisée par la violation des règles sportives, le dommage et le lien de causalité sont établis ; la théorie de l'acceptation des risques ne couvre pas la violence intentionnelle.` },
      },
      generatedAt: isoDaysAgo(DEFAULT_ANCHOR, 3),
    }))(),
    submission: ((): SyllogismeSubmission => ({
      majeure: `Les articles 1240 et 1241 du Code civil posent les conditions générales de la responsabilité délictuelle : faute, dommage et lien de causalité. En matière sportive, la jurisprudence exige une faute caractérisée par la violation des règles du jeu (Cass. 2e civ., 4 nov. 2010). La théorie de l'acceptation des risques sportifs constitue un tempérament mais ne couvre pas les actes de violence dépassant le cadre normal du jeu.`,
      mineure: `Le coup de coude porté par M. Allard, qualifié de violent dans le rapport d'arbitrage, constitue une violation des règles du football. Le dommage est certain : fracture du nez avec ITT de 30 jours. Le lien de causalité entre le geste et la blessure est direct. L'acceptation des risques ne peut être invoquée pour couvrir une violence excédant les règles.`,
      conclusion: `M. Allard engage sa responsabilité délictuelle sur le fondement de l'article 1240 du Code civil. Il doit indemniser son adversaire des préjudices subis (préjudice corporel, douleurs endurées, pretium doloris).`,
      submittedAt: isoDaysAgo(DEFAULT_ANCHOR, 3),
    }))(),
    grading: ((): SyllogismeGrading => ({
      majeure: { score: 8, articleCorrect: true, elementsIdentified: [
        { element: `Faute caractérisée`, found: true },
        { element: `Dommage corporel certain`, found: true },
        { element: `Lien de causalité direct`, found: true },
        { element: `Acceptation des risques (limite)`, found: true },
      ], feedback: `Très bonne maîtrise des conditions classiques. La référence jurisprudentielle (2e civ., 4 nov. 2010) est pertinente. Vous auriez pu enrichir avec la jurisprudence sur la garde collective d'une chose en mouvement (Cass. ass. plén., 2 juill. 1991, Boucher).` },
      mineure: { score: 8, mappings: [
        { element: `Faute caractérisée`, mapped: true },
        { element: `Dommage`, mapped: true },
        { element: `Causalité`, mapped: true },
        { element: `Acceptation des risques`, mapped: true },
      ], feedback: `Qualification claire et complète. Vous mobilisez les bons éléments. Une discussion sur la qualification éventuellement pénale du geste (violences volontaires, art. 222-13 C. pén.) aurait élargi l'analyse.` },
      conclusion: { score: 8, explicit: true, justified: true, nuanced: true, feedback: `Conclusion bien construite avec extension à la nature des préjudices. Vous auriez pu ajouter la possibilité d'une action récursoire de l'assureur du club si l'adversaire a été pris en charge.` },
      overall: { score: 24, topMistake: `Champ d'application restreint à la responsabilité civile sans envisager la qualification pénale (violences) qui aurait pourtant été pertinente vu l'ITT de 30 jours.`, strength: `Maîtrise solide de la jurisprudence sportive et de l'articulation entre acceptation des risques et faute caractérisée.` },
      gradedAt: isoDaysAgo(DEFAULT_ANCHOR, 3),
    }))(),
  },

  // ─── Plan détaillé — La responsabilité du fait des choses (graded, 23/30) ───
  {
    id: 'demo-plan-resp-fait-choses-1',
    type: 'plan-detaille',
    daysAgo: 17,
    state: 'graded',
    task: ((): PlanTask => ({
      question: `La responsabilité du fait des choses`,
      themeLabel: `Droit des obligations`,
      sourceArticles: [
        { articleNum: '1242', codeName: 'Code civil', text: `On est responsable non seulement du dommage que l'on cause par son propre fait, mais encore de celui qui est causé par le fait des personnes dont on doit répondre, ou des choses que l'on a sous sa garde.` },
      ],
      modelPlan: {
        problematique: `Comment la jurisprudence et le droit positif ont-ils transformé l'article 1242 alinéa 1, conçu comme une simple introduction, en un régime autonome et général de responsabilité du fait des choses, au point d'occulter en pratique l'exigence de faute ?`,
        I: { title: `L'élaboration jurisprudentielle d'une responsabilité autonome`, IA: `L'arrêt fondateur Teffaine (Cass. civ., 16 juin 1896) consacre la responsabilité du fait des choses comme principe général ; l'arrêt Jand'heur (Cass. ch. réunies, 13 fév. 1930) impose la présomption irréfragable de responsabilité.`, IB: `Les conditions du régime — fait actif ou passif de la chose, garde de la chose (CE 1er juill. 1969), causalité avec le dommage. La distinction garde de la structure / garde du comportement (Cass. 2e civ., 5 janv. 1956).` },
        II: { title: `Une responsabilité tempérée par les causes d'exonération`, IIA: `Les causes d'exonération classiques — force majeure (extériorité, imprévisibilité, irrésistibilité), fait du tiers, faute de la victime. Régime restrictif — la faute partielle de la victime exonère partiellement (Cass. 2e civ., 21 juill. 1982, Desmares).`, IIB: `Les évolutions récentes — extension aux choses immobilières (Cass. 2e civ., 17 mars 1965), précision sur le rôle actif requis (Cass. 2e civ., 24 fév. 2005), articulation avec la responsabilité du fait des produits défectueux (art. 1245 et s.).` },
        transitions: { intro_to_I: `Si l'article 1242 alinéa 1 du Code civil n'avait pas vocation initiale à fonder une responsabilité autonome, la jurisprudence l'a progressivement érigé en régime général.`, I_to_II: `Une fois posé le principe d'une responsabilité de plein droit, le régime juridique a dû organiser ses limites pour préserver l'équilibre entre indemnisation et responsabilisation.` },
        anchors: { IA: `Cass. civ. 16 juin 1896 Teffaine ; Cass. ch. réunies 13 fév. 1930 Jand'heur.`, IB: `Art. 1242 al. 1 ; Cass. 2e civ. 5 janv. 1956 Trichard.`, IIA: `Art. 1218 ; Cass. 2e civ. 21 juill. 1982 Desmares.`, IIB: `Cass. 2e civ. 17 mars 1965 ; Cass. 2e civ. 24 fév. 2005 ; art. 1245 et s.` },
      },
      commonPitfalls: [`Confondre garde matérielle et garde juridique de la chose.`, `Oublier la distinction garde de la structure / garde du comportement.`, `Réduire le régime à la seule responsabilité automobile alors que le sujet est général.`],
      generatedAt: isoDaysAgo(DEFAULT_ANCHOR, 17),
    }))(),
    submission: ((): PlanSubmission => ({
      problematique: `Dans quelle mesure la responsabilité du fait des choses, fondée sur l'article 1242 alinéa 1 du Code civil, constitue-t-elle un régime autonome et général, et comment ses conditions et limites s'articulent-elles ?`,
      I: { title: `Un principe général de responsabilité dégagé par la jurisprudence`, IA: `La consécration jurisprudentielle — arrêt Teffaine (Cass. civ., 16 juin 1896) puis arrêt Jand'heur (Cass. ch. réunies, 13 fév. 1930) qui transforme la simple introduction de l'article 1384 ancien en régime autonome.`, IB: `Les conditions d'application — chose, garde, fait causal. La distinction garde de la structure / garde du comportement (Trichard, 1956).` },
      II: { title: `Un régime tempéré par les exonérations`, IIA: `Les causes classiques d'exonération — force majeure, fait d'un tiers, faute de la victime, avec un régime strict.`, IIB: `Les extensions et limites contemporaines — extension aux choses immobilières, articulation avec la responsabilité du fait des produits défectueux.` },
      submittedAt: isoDaysAgo(DEFAULT_ANCHOR, 17),
    }))(),
    grading: ((): PlanGrading => ({
      axes: [
        { axis: 'problematique', label: 'Problématique', score: 4, feedback: `Problématique correcte mais qui pourrait gagner en relief en interrogeant la légitimité de l'évolution jurisprudentielle.` },
        { axis: 'opposition', label: 'Opposition I/II', score: 4, feedback: `Opposition principe / tempéraments classique et bien construite. Le titre du II (« Un régime tempéré par les exonérations ») est précis.` },
        { axis: 'equilibre', label: 'Équilibre', score: 4, feedback: `I.A nettement plus dense que les autres sous-parties. I.B et II.A mériteraient d'être davantage développés.` },
        { axis: 'chevauchement', label: 'Absence de chevauchement', score: 4, feedback: `La distinction garde structure/comportement aurait pu apparaître en I.B plutôt qu'être laissée implicite.` },
        { axis: 'couverture', label: 'Couverture', score: 4, feedback: `Couverture solide. La jurisprudence Desmares (1982) est absente — pourtant centrale sur la faute de la victime. La responsabilité du fait des produits défectueux mériterait davantage qu'une mention.` },
        { axis: 'transitions', label: 'Transitions', score: 3, feedback: `Transitions absentes de la soumission. Pensez à les rédiger explicitement, surtout entre I et II.` },
      ],
      overall: { score: 23, topMistake: `Absence de jurisprudence Desmares (Cass. 2e civ. 21 juill. 1982) sur la faute partielle de la victime — c'est un manque significatif sur le sujet de l'exonération.`, strength: `Plan solide avec les arrêts fondateurs (Teffaine, Jand'heur, Trichard) clairement positionnés. Bonne maîtrise de la chronologie jurisprudentielle.` },
      gradedAt: isoDaysAgo(DEFAULT_ANCHOR, 17),
    }))(),
  },

  // ─── Plan détaillé — L'erreur en droit des contrats (graded, 21/30) ───
  {
    id: 'demo-plan-erreur-1',
    type: 'plan-detaille',
    daysAgo: 11,
    state: 'graded',
    task: ((): PlanTask => ({
      question: `L'erreur en droit des contrats`,
      themeLabel: `Droit des obligations`,
      sourceArticles: [
        { articleNum: '1132', codeName: 'Code civil', text: `L'erreur de droit ou de fait, à moins qu'elle ne soit inexcusable, est une cause de nullité du contrat lorsqu'elle porte sur les qualités essentielles de la prestation due ou sur celles du cocontractant.` },
        { articleNum: '1133', codeName: 'Code civil', text: `Les qualités essentielles de la prestation sont celles qui ont été expressément ou tacitement convenues et en considération desquelles les parties ont contracté.` },
        { articleNum: '1135', codeName: 'Code civil', text: `L'erreur sur un simple motif, étranger aux qualités essentielles de la prestation due ou du cocontractant, n'est pas une cause de nullité, à moins que les parties n'en aient fait expressément un élément déterminant de leur consentement.` },
      ],
      modelPlan: {
        problematique: `Comment l'ordonnance du 10 février 2016, en codifiant les solutions jurisprudentielles tout en maintenant l'erreur dans le giron de la nullité relative, a-t-elle redéfini le périmètre du vice et les conditions de son admission ?`,
        I: { title: `Une erreur définie par son objet`, IA: `L'erreur sur les qualités essentielles de la prestation (art. 1132-1133) — qualités convenues expressément ou tacitement, en considération desquelles les parties ont contracté.`, IB: `L'erreur sur les qualités essentielles du cocontractant et l'erreur sur les motifs (art. 1132 al. 1 et 1135) — distinction fondatrice entre cause de nullité et simple intuition contractuelle.` },
        II: { title: `Une erreur sanctionnée selon ses conditions`, IIA: `Les conditions cumulatives — caractère déterminant, caractère excusable, charge de la preuve. La jurisprudence Poussin (Cass. 1re civ., 22 fév. 1978) sur la connaissance du caractère essentiel.`, IIB: `Les sanctions — nullité relative (art. 1131), confirmation possible, prescription quinquennale (art. 2224). Articulation avec d'autres vices et avec la garantie des vices cachés.` },
        transitions: { intro_to_I: `Définir l'erreur, c'est d'abord en circonscrire l'objet — les qualités sur lesquelles peut porter le vice. La codification de 2016 a précisé ce périmètre en s'appuyant sur la jurisprudence antérieure.`, I_to_II: `Mais la définition de l'erreur ne suffit pas — encore faut-il qu'elle réunisse les conditions de son admission et qu'elle conduise à une sanction adaptée.` },
        anchors: { IA: `Art. 1132-1133 C. civ.`, IB: `Art. 1132 al. 1 et 1135 C. civ.`, IIA: `Cass. 1re civ. 22 fév. 1978 Poussin.`, IIB: `Art. 1131, 2224 C. civ.` },
      },
      commonPitfalls: [`Traiter l'erreur sans distinguer son objet de ses conditions d'admission.`, `Confondre erreur et dol — l'erreur est spontanée, le dol est provoqué.`, `Oublier l'articulation avec les vices cachés (art. 1641) en matière de vente.`],
      generatedAt: isoDaysAgo(DEFAULT_ANCHOR, 11),
    }))(),
    submission: ((): PlanSubmission => ({
      problematique: `Dans quelle mesure le régime de l'erreur en droit des contrats, codifié à l'article 1132 du Code civil, parvient-il à concilier la protection du consentement et la sécurité juridique ?`,
      I: { title: `L'objet de l'erreur — les qualités essentielles`, IA: `L'erreur sur les qualités essentielles de la prestation (art. 1132 et 1133 C. civ.) — qualités convenues expressément ou tacitement.`, IB: `L'erreur sur les qualités essentielles du cocontractant (art. 1134) et l'exclusion de l'erreur sur les motifs (art. 1135).` },
      II: { title: `Les conditions et sanctions de l'erreur`, IIA: `Les conditions de l'erreur — déterminante, excusable. Référence à l'arrêt Poussin (Cass. 1re civ., 22 fév. 1978).`, IIB: `La sanction — nullité relative (art. 1131), prescription de cinq ans (art. 2224).` },
      submittedAt: isoDaysAgo(DEFAULT_ANCHOR, 11),
    }))(),
    grading: ((): PlanGrading => ({
      axes: [
        { axis: 'problematique', label: 'Problématique', score: 3, feedback: `Problématique trop large et déconnectée du plan — vous n'opposez pas vraiment protection du consentement et sécurité juridique dans le développement.` },
        { axis: 'opposition', label: 'Opposition I/II', score: 4, feedback: `L'opposition objet/conditions est valable mais la frontière est parfois floue — par exemple, le caractère déterminant relève autant de l'objet que des conditions.` },
        { axis: 'equilibre', label: 'Équilibre', score: 4, feedback: `Bon équilibre I/II. Les sous-parties ont des longueurs comparables.` },
        { axis: 'chevauchement', label: 'Absence de chevauchement', score: 3, feedback: `Le caractère déterminant chevauche entre I.A (objet) et II.A (conditions). À mieux articuler.` },
        { axis: 'couverture', label: 'Couverture', score: 4, feedback: `Couverture correcte mais l'articulation avec d'autres vices (dol notamment) et avec la garantie des vices cachés est absente. La jurisprudence Poussin est citée mais pas exploitée.` },
        { axis: 'transitions', label: 'Transitions', score: 3, feedback: `Transitions absentes. Le passage I → II n'est pas justifié dans la soumission.` },
      ],
      overall: { score: 21, topMistake: `Problématique trop générale qui ne reflète pas le plan ; chevauchement entre la condition « caractère déterminant » présente dans les deux parties.`, strength: `Maîtrise des articles fondateurs et bonne identification de l'arrêt Poussin comme jurisprudence clé.` },
      gradedAt: isoDaysAgo(DEFAULT_ANCHOR, 11),
    }))(),
  },

  // ─── Fiche d'arrêt — Cass. com. 17 janv. 2018 (graded, 22/25) ───
  {
    id: 'demo-fiche-cass-com-2018-1',
    type: 'fiche-arret',
    daysAgo: 21,
    state: 'graded',
    task: ((): FicheTask => ({
      decision: {
        id: 'demo-decision-cass-com-2018',
        chamber: 'Chambre commerciale',
        reference: 'Cass. com., 17 janvier 2018, n° 16-26.835',
        breadcrumb: 'Cour de cassation — Chambre commerciale — 17 janvier 2018',
        text: `Attendu, selon l'arrêt attaqué, que la société X a vendu à la société Y un véhicule professionnel qui s'est révélé affecté de défauts cachés ; que la société Y a assigné la société X en responsabilité contractuelle pour défaut de conformité et, subsidiairement, en garantie des vices cachés ; que la cour d'appel a déclaré l'action recevable sur les deux fondements ;

Sur le moyen unique :

Vu les articles 1641 et suivants du Code civil ;

Attendu qu'il résulte de ces textes que la mise en œuvre de la garantie des vices cachés, fondée sur l'existence d'un vice antérieur à la vente, n'exclut pas l'action en responsabilité contractuelle pour défaut de conformité aux stipulations du contrat ;

Et attendu que c'est à bon droit que la cour d'appel a admis le cumul des deux actions, le défaut de conformité et le vice caché reposant sur des faits distincts et donnant lieu à des sanctions différentes ;

PAR CES MOTIFS : REJETTE le pourvoi.`,
      },
      generatedAt: isoDaysAgo(DEFAULT_ANCHOR, 21),
    }))(),
    submission: ((): FicheSubmission => ({
      faits: `La société X vend à la société Y un véhicule professionnel. Le véhicule présente des défauts cachés. La société Y agit contre la société X en responsabilité contractuelle pour défaut de conformité et, à titre subsidiaire, en garantie des vices cachés.`,
      procedure: `La cour d'appel déclare l'action recevable sur les deux fondements. La société X forme un pourvoi en cassation.`,
      moyens: `La société X soutient que les deux actions sont incompatibles — la garantie des vices cachés (art. 1641) exclurait l'action en responsabilité contractuelle pour défaut de conformité.`,
      questionDeDroit: `L'action en garantie des vices cachés exclut-elle l'action en responsabilité contractuelle pour défaut de conformité, ou les deux actions peuvent-elles se cumuler ?`,
      solutionEtPortee: `La chambre commerciale rejette le pourvoi en posant que les deux actions reposent sur des faits distincts (vice antérieur à la vente vs. défaut de conformité aux stipulations) et donnent lieu à des sanctions différentes. Le cumul est donc admis. La portée est importante : l'arrêt clarifie un débat doctrinal et conforte la position du créancier face à un défaut multiforme.`,
      submittedAt: isoDaysAgo(DEFAULT_ANCHOR, 21),
    }))(),
    grading: ((): FicheGrading => ({
      axes: [
        { axis: 'faits', label: 'Faits', score: 4, feedback: `Faits clairs et bien hiérarchisés. Vous identifiez correctement les parties et l'objet du litige.` },
        { axis: 'procedure', label: 'Procédure', score: 4, feedback: `Procédure correctement reconstituée. La mention du pourvoi de la société X est précise.` },
        { axis: 'moyens', label: 'Moyens', score: 4, feedback: `Moyen identifié avec justesse. Vous auriez pu préciser que le moyen invoque l'incompatibilité des fondements (et non leur identité).` },
        { axis: 'questionDeDroit', label: 'Question de droit', score: 5, feedback: `Question de droit parfaitement formulée — alternative claire entre exclusion et cumul.` },
        { axis: 'solutionEtPortee', label: 'Solution et portée', score: 5, feedback: `Solution exacte et portée bien identifiée. Vous mettez en lumière l'apport réel : distinction des fondements par l'objet et la sanction.` },
      ],
      overall: { score: 22, topMistake: `Précision manquante sur les moyens — l'argumentation de la société X gagne à être restituée plus finement.`, strength: `Question de droit et portée traitées avec une qualité remarquable.` },
      gradedAt: isoDaysAgo(DEFAULT_ANCHOR, 21),
    }))(),
  },

  // ─── Fiche d'arrêt — Cass. soc. 23 sept. 2009 (graded, 19/25) ───
  {
    id: 'demo-fiche-cass-soc-1',
    type: 'fiche-arret',
    daysAgo: 15,
    state: 'graded',
    task: ((): FicheTask => ({
      decision: {
        id: 'demo-decision-cass-soc-2009',
        chamber: 'Chambre sociale',
        reference: 'Cass. soc., 23 septembre 2009, n° 08-42.415',
        breadcrumb: 'Cour de cassation — Chambre sociale — 23 septembre 2009',
        text: `Sur le moyen unique :

Vu l'article L1232-1 du Code du travail ;

Attendu que pour débouter le salarié de sa demande, l'arrêt énonce que les fautes invoquées dans la lettre de licenciement constituent une cause réelle et sérieuse ;

Attendu cependant que la lettre de licenciement fixe les limites du litige ; qu'il en résulte que le juge ne peut prendre en considération des faits non énoncés dans la lettre ;

Qu'en se déterminant ainsi, alors que la lettre de licenciement ne mentionnait que des manquements généraux non datés, sans énonciation de faits matériels précis et vérifiables, la cour d'appel a violé le texte susvisé ;

PAR CES MOTIFS : CASSE ET ANNULE.`,
      },
      generatedAt: isoDaysAgo(DEFAULT_ANCHOR, 15),
    }))(),
    submission: ((): FicheSubmission => ({
      faits: `Un salarié est licencié pour cause réelle et sérieuse. La lettre de licenciement mentionne des « manquements généraux » sans dates ni faits précis.`,
      procedure: `Le salarié conteste son licenciement. La cour d'appel valide le licenciement. Le salarié forme un pourvoi en cassation.`,
      moyens: `Le salarié soutient que la lettre de licenciement, faute de mention de faits précis, ne fixe pas valablement les limites du litige.`,
      questionDeDroit: `La lettre de licenciement, en l'absence d'énonciation de faits précis, peut-elle constituer une cause réelle et sérieuse de licenciement ?`,
      solutionEtPortee: `La chambre sociale casse l'arrêt d'appel. La lettre fixe les limites du litige et doit énoncer des faits matériels précis et vérifiables. À défaut, la cause réelle et sérieuse n'est pas caractérisée. La portée est forte : confirmation de la rigueur formelle exigée de l'employeur.`,
      submittedAt: isoDaysAgo(DEFAULT_ANCHOR, 15),
    }))(),
    grading: ((): FicheGrading => ({
      axes: [
        { axis: 'faits', label: 'Faits', score: 3, feedback: `Faits trop succincts — l'identification du salarié, du contexte de l'entreprise, des fonctions exercées manque. Densifiez.` },
        { axis: 'procedure', label: 'Procédure', score: 4, feedback: `Procédure correctement résumée.` },
        { axis: 'moyens', label: 'Moyens', score: 4, feedback: `Moyen identifié, mais l'argumentation aurait gagné à être présentée plus finement (« la lettre fixe les limites du litige »).` },
        { axis: 'questionDeDroit', label: 'Question de droit', score: 4, feedback: `Question correcte. Pour atteindre l'excellence, formulez-la de manière strictement neutre : « Une lettre de licenciement peut-elle, en l'absence de faits matériels précis et vérifiables, fixer valablement les limites du litige ? »` },
        { axis: 'solutionEtPortee', label: 'Solution et portée', score: 4, feedback: `Solution claire. La portée mérite d'être nuancée — précisez la jurisprudence antérieure (Cass. soc., 26 oct. 1999) et l'évolution.` },
      ],
      overall: { score: 19, topMistake: `Faits trop pauvres — la fiche d'arrêt est avant tout un exercice de restitution complète et hiérarchisée.`, strength: `Solution et portée correctement restituées avec identification de l'apport principal.` },
      gradedAt: isoDaysAgo(DEFAULT_ANCHOR, 15),
    }))(),
  },

  // ─── Fiche d'arrêt — Cass. crim. 11 juin 2013 (graded, 23/25) ───
  {
    id: 'demo-fiche-cass-crim-1',
    type: 'fiche-arret',
    daysAgo: 10,
    state: 'graded',
    task: ((): FicheTask => ({
      decision: {
        id: 'demo-decision-cass-crim-2013',
        chamber: 'Chambre criminelle',
        reference: 'Cass. crim., 11 juin 2013, n° 12-83.218',
        breadcrumb: 'Cour de cassation — Chambre criminelle — 11 juin 2013',
        text: `Sur le moyen unique :

Vu l'article 29 alinéa 1 de la loi du 29 juillet 1881 ;

Attendu qu'un journaliste, poursuivi pour diffamation à raison d'un article mettant en cause un élu local, peut s'exonérer en démontrant la bonne foi, laquelle s'apprécie au regard de quatre critères cumulatifs : la légitimité du but poursuivi, l'absence d'animosité personnelle, le sérieux de l'enquête et la prudence dans l'expression ;

Attendu que la cour d'appel, pour relaxer le journaliste, a retenu que les quatre critères de la bonne foi étaient réunis, le sujet relevant d'un débat d'intérêt général, l'enquête ayant été conduite avec sérieux et la formulation étant mesurée ;

Qu'en l'état de ces constatations, la cour d'appel a fait l'exacte application des textes susvisés ;

PAR CES MOTIFS : REJETTE le pourvoi.`,
      },
      generatedAt: isoDaysAgo(DEFAULT_ANCHOR, 10),
    }))(),
    submission: ((): FicheSubmission => ({
      faits: `Un journaliste publie un article mettant en cause un élu local dans une affaire présentée comme relevant du débat d'intérêt général. L'élu engage des poursuites pour diffamation sur le fondement de l'article 29 alinéa 1 de la loi du 29 juillet 1881.`,
      procedure: `La cour d'appel relaxe le journaliste, considérant que les quatre critères jurisprudentiels de la bonne foi sont réunis. L'élu local forme un pourvoi en cassation.`,
      moyens: `L'élu soutient que la bonne foi du journaliste ne peut être retenue dans les conditions où elle l'a été — il conteste l'appréciation des critères par la cour d'appel.`,
      questionDeDroit: `Les quatre critères cumulatifs de la bonne foi journalistique (légitimité du but, absence d'animosité, sérieux de l'enquête, prudence dans l'expression) suffisent-ils à exonérer le journaliste de sa responsabilité pour diffamation lorsque le sujet relève d'un débat d'intérêt général ?`,
      solutionEtPortee: `La chambre criminelle rejette le pourvoi en confirmant la formule des quatre critères cumulatifs. L'arrêt fait synthèse de la jurisprudence antérieure et fournit une grille d'analyse stable. La portée est considérable : conforte la liberté d'expression journalistique et offre un cadre prévisible aux praticiens.`,
      submittedAt: isoDaysAgo(DEFAULT_ANCHOR, 10),
    }))(),
    grading: ((): FicheGrading => ({
      axes: [
        { axis: 'faits', label: 'Faits', score: 5, feedback: `Faits clairs et bien hiérarchisés. La référence au débat d'intérêt général est restituée avec précision.` },
        { axis: 'procedure', label: 'Procédure', score: 5, feedback: `Procédure parfaitement restituée — relaxe en appel, pourvoi de l'élu.` },
        { axis: 'moyens', label: 'Moyens', score: 4, feedback: `Moyen identifié mais l'argumentation pourrait être plus précise.` },
        { axis: 'questionDeDroit', label: 'Question de droit', score: 5, feedback: `Question de droit excellente — articulation entre les quatre critères et le débat d'intérêt général.` },
        { axis: 'solutionEtPortee', label: 'Solution et portée', score: 4, feedback: `Solution claire ; pour la portée, vous gagneriez à mentionner l'arrêt Lingens c/ Autriche (CEDH, 1986) et le rôle des juges du fond dans l'appréciation in concreto.` },
      ],
      overall: { score: 23, topMistake: `Portée insuffisamment articulée à la jurisprudence européenne (CEDH Lingens, Bladet Tromsø).`, strength: `Faits, procédure et question de droit traités avec rigueur.` },
      gradedAt: isoDaysAgo(DEFAULT_ANCHOR, 10),
    }))(),
  },

  // ─── Fiche d'arrêt — Cass. 1re civ. 28 mai 2008 (graded, 17/25) ───
  {
    id: 'demo-fiche-cass-civ-2008-1',
    type: 'fiche-arret',
    daysAgo: 5,
    state: 'graded',
    task: ((): FicheTask => ({
      decision: {
        id: 'demo-decision-cass-civ-2008',
        chamber: 'Première chambre civile',
        reference: 'Cass. 1re civ., 3 avril 2002, n° 00-12.932',
        breadcrumb: 'Cour de cassation — Première chambre civile — 3 avril 2002',
        text: `Sur le moyen unique :

Vu l'article 1112 du Code civil ;

Attendu que pour écarter le moyen tiré de la violence économique, l'arrêt attaqué retient que la victime n'établit pas avoir été placée dans une situation telle qu'elle aurait dû céder à des conditions manifestement déséquilibrées ;

Attendu cependant que seule l'exploitation abusive d'une situation de dépendance économique, faite pour tirer profit de la crainte d'un mal menaçant directement les intérêts légitimes de la personne, peut vicier de violence son consentement ;

Qu'en se déterminant ainsi, sans rechercher si la situation économique invoquée résultait d'une telle exploitation abusive par le cocontractant, la cour d'appel a privé sa décision de base légale ;

PAR CES MOTIFS : CASSE ET ANNULE.`,
      },
      generatedAt: isoDaysAgo(DEFAULT_ANCHOR, 5),
    }))(),
    submission: ((): FicheSubmission => ({
      faits: `Une partie invoque la violence économique pour faire annuler un contrat conclu dans une situation de dépendance.`,
      procedure: `La cour d'appel rejette le moyen. Pourvoi en cassation.`,
      moyens: `La partie soutient que la dépendance économique a vicié son consentement.`,
      questionDeDroit: `La violence économique peut-elle vicier le consentement ?`,
      solutionEtPortee: `La Cour casse en posant que seule l'exploitation abusive de la dépendance économique constitue une violence. L'arrêt fonde la consécration jurisprudentielle de la violence économique en droit français.`,
      submittedAt: isoDaysAgo(DEFAULT_ANCHOR, 5),
    }))(),
    grading: ((): FicheGrading => ({
      axes: [
        { axis: 'faits', label: 'Faits', score: 2, feedback: `Faits trop pauvres. Précisez les parties, le contexte, le type de contrat. Une fiche d'arrêt n'est pas un résumé d'une ligne.` },
        { axis: 'procedure', label: 'Procédure', score: 3, feedback: `Procédure indigente. Restituez les arguments précis du juge d'appel.` },
        { axis: 'moyens', label: 'Moyens', score: 3, feedback: `Moyen trop succinct.` },
        { axis: 'questionDeDroit', label: 'Question de droit', score: 4, feedback: `Question correcte mais trop générale. Affinez : « la simple dépendance économique suffit-elle à vicier le consentement, ou faut-il caractériser une exploitation abusive ? »` },
        { axis: 'solutionEtPortee', label: 'Solution et portée', score: 5, feedback: `Solution et portée correctement identifiées — c'est le point fort de la fiche.` },
      ],
      overall: { score: 17, topMistake: `Fiche trop superficielle dans les sections faits/procédure/moyens — vous ne pouvez pas vous contenter d'une ligne par section.`, strength: `La solution et la portée sont vues avec justesse, ce qui montre une compréhension de l'apport.` },
      gradedAt: isoDaysAgo(DEFAULT_ANCHOR, 5),
    }))(),
  },

  // ─── Fiche d'arrêt EN COURS (in-progress) — pour test du Reprendre ───
  {
    id: 'demo-fiche-cass-3eme-civ-in-progress',
    type: 'fiche-arret',
    daysAgo: 1,
    state: 'in-progress',
    task: ((): FicheTask => ({
      decision: {
        id: 'demo-decision-cass-3eme-civ',
        chamber: 'Troisième chambre civile',
        reference: 'Cass. 3e civ., 13 juillet 2016, n° 15-19.984',
        breadcrumb: 'Cour de cassation — Troisième chambre civile — 13 juillet 2016',
        text: `Sur le moyen unique :

Vu les articles 15 et 15-1 de la loi du 6 juillet 1989 ;

Attendu qu'aux termes de ces textes, le bailleur qui souhaite donner congé pour vente doit, à peine de nullité, mentionner dans le congé le prix et les conditions de la vente projetée ;

Attendu que la cour d'appel, pour valider le congé, a retenu que la mention « prix de marché » suffisait à informer le locataire ;

Qu'en se déterminant ainsi, alors que la mention « prix de marché » ne permet pas au locataire d'apprécier l'opportunité de l'exercice de son droit de préemption, la cour d'appel a violé les textes susvisés ;

PAR CES MOTIFS : CASSE ET ANNULE.`,
      },
      generatedAt: isoDaysAgo(DEFAULT_ANCHOR, 1),
    }))(),
    submission: ((): FicheSubmission => ({
      faits: `Un bailleur donne congé pour vente à son locataire. Le congé mentionne « prix de marché » sans chiffre précis. Le locataire conteste la validité du congé.`,
      procedure: `La cour d'appel valide le congé. Le locataire forme un pourvoi en cassation.`,
      moyens: ``,
      questionDeDroit: ``,
      solutionEtPortee: ``,
      submittedAt: isoDaysAgo(DEFAULT_ANCHOR, 1),
    }))(),
    // No grading — in progress
  },

  // ─── Commentaire d'arrêt — Cass. ch. mixte 21 déc. 2007 (graded, 24/25) ───
  {
    id: 'demo-comm-cass-mixte-2007',
    type: 'commentaire-arret',
    daysAgo: 23,
    state: 'graded',
    task: ((): CommentaireTask => ({
      decision: {
        id: 'demo-decision-cass-mixte-2007',
        chamber: 'Chambre mixte',
        reference: 'Cass. ch. mixte, 21 décembre 2007, n° 06-11.343',
        breadcrumb: 'Cour de cassation — Chambre mixte — 21 décembre 2007',
        text: `Sur le moyen unique :

Vu l'article 1116 ancien du Code civil ;

Attendu que la réticence dolosive, lorsqu'elle est établie, rend toujours excusable l'erreur provoquée ;

Attendu que pour rejeter la demande en nullité du contrat fondée sur la réticence dolosive, l'arrêt retient que l'acquéreur, professionnel averti, ne pouvait ignorer les défauts du bien ;

Qu'en se déterminant ainsi, alors qu'elle constatait que le vendeur avait délibérément dissimulé une information dont il connaissait le caractère déterminant, la cour d'appel a violé le texte susvisé ;

PAR CES MOTIFS : CASSE ET ANNULE.`,
      },
      generatedAt: isoDaysAgo(DEFAULT_ANCHOR, 23),
    }))(),
    submission: ((): CommentaireSubmission => ({
      introduction: `« La bonne foi est l'âme des conventions » — l'adage romain résonne aujourd'hui dans la jurisprudence consacrant la réticence dolosive comme vice du consentement. L'arrêt rendu par la chambre mixte de la Cour de cassation le 21 décembre 2007 occupe une place capitale dans cette construction. En posant que la réticence dolosive rend toujours excusable l'erreur provoquée, la chambre mixte met fin à une opposition entre chambres et pose un principe général qui sera ensuite codifié à l'article 1137 alinéa 2 du Code civil par l'ordonnance du 10 février 2016.

Les faits sont classiques : un acquéreur professionnel, après l'achat d'un bien, découvre que le vendeur a délibérément dissimulé une information dont il connaissait le caractère déterminant. La cour d'appel rejette la demande en nullité au motif que l'acquéreur, professionnel averti, aurait dû découvrir les défauts. La chambre mixte casse en s'appuyant sur l'article 1116 ancien du Code civil.

L'intérêt de l'arrêt est triple : il met fin à une opposition jurisprudentielle, il consacre une protection accrue de la victime du dol, et il anticipe la codification de 2016. La problématique se pose alors en ces termes : la qualité de professionnel de l'acquéreur peut-elle faire obstacle à l'invocation de la réticence dolosive ?

Pour répondre, nous étudierons d'abord la consécration d'un principe général de la réticence dolosive (I), avant d'envisager ses conséquences sur la protection du consentement (II).`,
      I: { title: `La consécration d'un principe général de la réticence dolosive`, IA: `Une opposition jurisprudentielle antérieure tranchée. Avant 2007, la première chambre civile retenait l'inexcusabilité de l'erreur du professionnel quand la chambre commerciale était plus souple. La chambre mixte tranche en faveur de la protection systématique de la victime du dol.`, IB: `Une formulation absolue — « rend toujours excusable l'erreur provoquée ». La force du « toujours » exclut toute distinction selon la qualité du contractant et inscrit la solution dans une logique de moralisation des relations contractuelles.` },
      II: { title: `Les conséquences sur la protection du consentement`, IIA: `Une articulation renouvelée avec l'article 1112-1 (devoir d'information). L'arrêt préfigure le devoir précontractuel d'information codifié en 2016 — celui qui détient une information déterminante doit la transmettre, sans pouvoir s'abriter derrière la qualité de l'autre partie.`, IIB: `Une protection renforcée de la victime du dol. La sanction est la nullité relative (art. 1131 nouveau C. civ.), assortie possiblement de dommages-intérêts (art. 1240). La codification de 2016 pérennise cette protection à l'article 1137 alinéa 2.` },
      submittedAt: isoDaysAgo(DEFAULT_ANCHOR, 23),
    }))(),
    grading: ((): CommentaireGrading => ({
      axes: [
        { axis: 'accroche', label: 'Accroche', score: 5, feedback: `Accroche élégante et pertinente — l'adage latin annonce parfaitement le sujet et donne le ton.` },
        { axis: 'interet', label: 'Intérêt de l\'arrêt', score: 5, feedback: `Intérêt clairement formulé en trois points (opposition, protection, codification). Synthèse efficace.` },
        { axis: 'problematique', label: 'Problématique', score: 5, feedback: `Problématique précise et bien articulée à l'apport central de l'arrêt.` },
        { axis: 'plan', label: 'Plan', score: 5, feedback: `Plan I/II solide. L'opposition consécration / conséquences est claire et chacune des sous-parties traite un aspect distinct.` },
        { axis: 'articulation', label: 'Articulation', score: 4, feedback: `Articulation entre I et II logique. Vous gagneriez à formuler une transition explicite entre les deux parties.` },
      ],
      overall: { score: 24, topMistake: `Transition I/II implicite — un commentaire d'arrêt vit aussi par l'enchaînement formel.`, strength: `Maîtrise méthodologique exemplaire de l'introduction et structuration claire du raisonnement.` },
      gradedAt: isoDaysAgo(DEFAULT_ANCHOR, 23),
    }))(),
  },

  // ─── Commentaire d'arrêt — Cass. soc. (graded, 21/25) ───
  {
    id: 'demo-comm-cass-soc-1',
    type: 'commentaire-arret',
    daysAgo: 18,
    state: 'graded',
    task: ((): CommentaireTask => ({
      decision: {
        id: 'demo-decision-cass-soc-2017',
        chamber: 'Chambre sociale',
        reference: 'Cass. soc., 22 mars 2017, n° 15-22.073',
        breadcrumb: 'Cour de cassation — Chambre sociale — 22 mars 2017',
        text: `Sur le moyen unique :

Vu les articles L1232-1 et L1232-6 du Code du travail ;

Attendu que la lettre de licenciement fixe les limites du litige ; qu'à défaut d'énonciation de motifs précis et matériellement vérifiables, le licenciement est sans cause réelle et sérieuse ;

Attendu que pour valider le licenciement, l'arrêt retient que les motifs énoncés permettent de comprendre les griefs de l'employeur ;

Qu'en statuant ainsi, alors que la lettre de licenciement énonçait des manquements généraux non datés et non rattachés à des situations factuelles précises, la cour d'appel a violé les textes susvisés ;

PAR CES MOTIFS : CASSE ET ANNULE.`,
      },
      generatedAt: isoDaysAgo(DEFAULT_ANCHOR, 18),
    }))(),
    submission: ((): CommentaireSubmission => ({
      introduction: `« La motivation est l'âme du licenciement » — la formule trouve sa pleine résonance dans l'arrêt rendu le 22 mars 2017 par la chambre sociale de la Cour de cassation. Cet arrêt, qui s'inscrit dans une jurisprudence ancienne sur les exigences formelles du licenciement, rappelle avec force que la lettre de licenciement fixe les limites du litige et doit énoncer des motifs précis et matériellement vérifiables.

Les faits sont simples : un salarié est licencié, la lettre énonce des manquements généraux. La cour d'appel valide le licenciement en estimant que les motifs « permettent de comprendre les griefs ». La Cour de cassation casse en posant l'exigence d'énonciation précise.

L'intérêt est double : confirmation d'une jurisprudence constante et précision sur le contrôle formel du licenciement. Comment articuler la liberté de gestion de l'employeur et l'exigence de précision dans la motivation ?

Nous étudierons d'abord la fonction de la lettre de licenciement (I), puis la sanction du défaut de motivation (II).`,
      I: { title: `La lettre de licenciement, instrument de fixation du litige`, IA: `La fonction de cadrage — la lettre détermine les motifs invocables devant le juge. Tout motif non énoncé sera réputé absent.`, IB: `L'exigence de précision — manquements datés, rattachés à des situations factuelles précises. La généralité des motifs équivaut à l'absence de motivation.` },
      II: { title: `La sanction du défaut de motivation`, IIA: `Une cause réelle et sérieuse écartée — le licenciement devient sans cause, ouvrant droit à indemnisation.`, IIB: `Une indemnisation encadrée — depuis l'ordonnance du 22 sept. 2017, les barèmes Macron déterminent l'indemnité (art. L1235-3).` },
      submittedAt: isoDaysAgo(DEFAULT_ANCHOR, 18),
    }))(),
    grading: ((): CommentaireGrading => ({
      axes: [
        { axis: 'accroche', label: 'Accroche', score: 4, feedback: `Accroche correcte mais la formule « la motivation est l'âme du licenciement » est un peu artificielle. Préférez une référence à un texte ou à une jurisprudence emblématique.` },
        { axis: 'interet', label: 'Intérêt', score: 4, feedback: `Intérêt énoncé mais pourrait être plus précis. La référence à la jurisprudence antérieure (Cass. soc., 26 oct. 1999) renforcerait l'analyse.` },
        { axis: 'problematique', label: 'Problématique', score: 4, feedback: `Problématique recevable mais générale. Plus précisément : « le défaut d'énonciation de faits matériellement vérifiables emporte-t-il à lui seul la qualification d'absence de cause réelle et sérieuse ? »` },
        { axis: 'plan', label: 'Plan', score: 5, feedback: `Plan clair, articulé sur la fonction de la lettre et la sanction. Bonne progression.` },
        { axis: 'articulation', label: 'Articulation', score: 4, feedback: `Bonne articulation entre I et II. Une transition explicite renforcerait l'ensemble.` },
      ],
      overall: { score: 21, topMistake: `Accroche et problématique trop générales — le commentaire d'arrêt ne doit pas paraître écrit pour n'importe quel arrêt social.`, strength: `Plan structuré et compréhension correcte de l'apport de l'arrêt.` },
      gradedAt: isoDaysAgo(DEFAULT_ANCHOR, 18),
    }))(),
  },

  // ─── Cas pratique — Obligations (graded, 14/20) ───
  {
    id: 'demo-cas-pratique-obligations-1',
    type: 'cas-pratique',
    daysAgo: 22,
    state: 'graded',
    task: ((): CasPratiqueTask => ({
      specialty: 'obligations' as never,
      specialtyLabel: 'Droit des obligations',
      duration: 180,
      scenario: `Madame Garnier, gérante d'une PME, a conclu il y a deux ans un contrat de fourniture de matériel informatique avec la société TechPlus pour un montant total de 45 000 €. Le contrat prévoit une garantie contractuelle de 36 mois et une clause limitant la responsabilité de TechPlus à hauteur de 5 000 € en cas de défaillance du matériel.

Six mois après la livraison, le matériel tombe en panne plusieurs fois, paralysant l'activité de la PME pendant 12 jours au total. Mme Garnier estime son préjudice à 38 000 € (perte d'exploitation + frais de remplacement provisoire). TechPlus invoque la clause limitative et propose un dédommagement de 5 000 €.

En outre, Mme Garnier découvre que TechPlus, lors de la conclusion du contrat, n'avait pas révélé qu'un litige était en cours avec son fournisseur principal sur la conformité de certains composants utilisés dans le matériel livré.

Mme Garnier vous consulte. Établissez un mémorandum identifiant les actions possibles, leurs fondements juridiques, leurs chances de succès et les stratégies envisageables.`,
      modelAnswer: `Trois axes d'action peuvent être envisagés : (1) responsabilité contractuelle pour inexécution avec contestation de la clause limitative, (2) action pour réticence dolosive, (3) résolution du contrat avec restitutions et dommages-intérêts. Voir développements ci-dessous.`,
      legalIssues: [`Validité de la clause limitative au regard de l'article 1170 (Chronopost)`, `Caractérisation de la réticence dolosive (art. 1137 al. 2)`, `Articulation responsabilité contractuelle / nullité pour vice du consentement`, `Évaluation et imputation du préjudice (art. 1231-3)`, `Stratégie procédurale — alternative entre actions`],
      groundingPool: [],
      generatedAt: isoDaysAgo(DEFAULT_ANCHOR, 22),
    }))(),
    submission: ((): CasPratiqueSubmission => ({
      answer: `**Mémorandum à l'attention de Madame Garnier**

**Question 1 — La clause limitative est-elle opposable ?**

L'article 1170 du Code civil dispose que « toute clause qui prive de sa substance l'obligation essentielle du débiteur est réputée non écrite ». La jurisprudence Chronopost (Cass. com., 22 oct. 1996) avait déjà posé le principe.

En l'espèce, la clause limite la responsabilité à 5 000 € pour un contrat de 45 000 €, alors que le préjudice subi atteint 38 000 €. La clause apparaît comme privant de sa substance l'obligation essentielle de TechPlus de fournir un matériel fonctionnel.

Vous pouvez donc demander que la clause soit réputée non écrite et obtenir une réparation intégrale.

**Question 2 — La responsabilité contractuelle peut-elle être engagée ?**

Sur le fondement des articles 1217 et 1231-1 du Code civil, vous pouvez engager la responsabilité contractuelle de TechPlus pour inexécution. Conditions : inexécution (défaillance du matériel), préjudice (38 000 €), mise en demeure préalable.

**Question 3 — La réticence dolosive ?**

L'article 1137 alinéa 2 du Code civil consacre la réticence dolosive. TechPlus n'a pas révélé le litige avec son fournisseur, alors que cette information était déterminante pour Madame Garnier. La nullité du contrat peut être demandée (art. 1131), avec restitutions réciproques.

**Conclusion** — Je préconise une action principale en responsabilité contractuelle avec contestation de la clause limitative, et subsidiairement une action en nullité pour réticence dolosive. La voie la plus rapide est la première.`,
      submittedAt: isoDaysAgo(DEFAULT_ANCHOR, 22),
    }))(),
    grading: ((): CasPratiqueGrading => ({
      axes: [
        { axis: 'identification', label: 'Identification des questions', score: 3, max: 4, feedback: `Trois questions identifiées sur cinq attendues. Vous oubliez l'évaluation/imputation du préjudice (art. 1231-3 sur la prévisibilité) et la stratégie procédurale alternative.` },
        { axis: 'syllogisme', label: 'Rigueur du syllogisme', score: 3, max: 5, feedback: `Le syllogisme est présent mais souvent superficiel. Sur la clause limitative, vous citez Chronopost mais sans détailler les conditions actuelles depuis la codification (1170 vs. 1171). Sur la réticence dolosive, vous n'examinez pas le caractère déterminant de l'information.` },
        { axis: 'regles', label: 'Maîtrise des règles', score: 3, max: 4, feedback: `Articles cités correctement mais sans toujours les exploiter. L'article 1231-3 sur la prévisibilité du dommage est absent — pourtant central pour fixer le quantum.` },
        { axis: 'application', label: 'Application aux faits', score: 2, max: 3, feedback: `Application trop rapide. Vous ne discutez pas la qualification précise du préjudice (perte d'exploitation, dommage prévisible vs. imprévisible).` },
        { axis: 'redaction', label: 'Rédaction', score: 2, max: 2, feedback: `Rédaction claire et structurée. Format du mémorandum approprié.` },
        { axis: 'conseil', label: 'Conseil opérationnel', score: 1, max: 2, feedback: `Conseil final correct sur le principal/subsidiaire mais trop laconique. Pas de discussion sur les coûts, délais, risques de chaque action.` },
      ],
      overall: { score: 14, topMistake: `Stratégie procédurale insuffisamment développée — le cas pratique attend un véritable conseil, pas seulement une identification des fondements.`, strength: `Identification correcte des trois principaux fondements et bonne maîtrise de la jurisprudence Chronopost.`, identifiedIssues: [0, 1, 2], missedIssues: [3, 4] },
      gradedAt: isoDaysAgo(DEFAULT_ANCHOR, 22),
    }))(),
  },

  // ─── Cas pratique — Social (graded, 16/20) ───
  {
    id: 'demo-cas-pratique-social-1',
    type: 'cas-pratique',
    daysAgo: 13,
    state: 'graded',
    task: ((): CasPratiqueTask => ({
      specialty: 'social' as never,
      specialtyLabel: 'Droit social',
      duration: 180,
      scenario: `M. Olivier, salarié depuis 8 ans dans une entreprise de 250 salariés en tant que cadre commercial, est convoqué à un entretien préalable pour faute grave. Sont reprochés : (1) refus répété d'effectuer des déplacements clientèle, (2) baisse significative du chiffre d'affaires, (3) attitude agressive envers une collègue.

Lors de l'entretien, M. Olivier explique que les déplacements interviennent souvent en dehors des plages horaires contractuelles et que la baisse du CA tient à des conditions de marché documentées. Sur l'altercation, il reconnaît une discussion vive mais conteste la qualification d'agression.

Trois jours après l'entretien, l'employeur notifie le licenciement pour faute grave, mentionnant uniquement « comportement incompatible avec le maintien dans l'entreprise ».

Conseillez M. Olivier sur les actions possibles et leurs chances de succès.`,
      modelAnswer: `Trois axes : (1) contestation de la motivation insuffisante de la lettre, (2) requalification de la faute grave en cause réelle et sérieuse simple, (3) éventuelle absence de cause réelle et sérieuse.`,
      legalIssues: [`Suffisance de la motivation (art. L1232-6)`, `Distinction faute grave / cause réelle et sérieuse (L1232-1, L1234-1)`, `Qualification des faits — refus de déplacements (modification du contrat ?)`, `Insuffisance professionnelle vs. faute (Cass. soc. 13 nov. 2008)`, `Indemnisation et barèmes Macron (L1235-3)`],
      groundingPool: [],
      generatedAt: isoDaysAgo(DEFAULT_ANCHOR, 13),
    }))(),
    submission: ((): CasPratiqueSubmission => ({
      answer: `**Mémorandum à l'attention de Monsieur Olivier**

**Question 1 — La lettre de licenciement est-elle suffisamment motivée ?**

L'article L1232-6 du Code du travail impose que la lettre de licenciement énonce des motifs précis et matériellement vérifiables. La jurisprudence Cass. soc. 22 mars 2017 confirme cette exigence.

En l'espèce, la mention « comportement incompatible avec le maintien dans l'entreprise » est manifestement générale et ne renvoie à aucun fait précis. La motivation est insuffisante — premier moyen de contestation.

**Question 2 — La faute grave est-elle caractérisée ?**

La faute grave (art. L1234-1) suppose un manquement rendant impossible le maintien du salarié, même pendant le préavis. Trois griefs sont invoqués :

1. Refus de déplacements : si les déplacements sortent du cadre contractuel, le refus est légitime et ne constitue pas une faute. La jurisprudence Cass. soc. 10 juill. 1996 sur la modification du contrat protège le salarié.

2. Baisse du CA : ce n'est pas une faute disciplinaire mais une éventuelle insuffisance professionnelle (Cass. soc. 13 nov. 2008). Distinction fondamentale.

3. Attitude agressive : la qualification dépend de la preuve. Une simple discussion vive ne constitue pas une faute grave.

**Question 3 — Quelles indemnités ?**

Si le licenciement est requalifié en cause réelle et sérieuse simple, M. Olivier conserve indemnité de préavis (2 mois) et indemnité de licenciement (¼ × 8 = 2 mois de salaire). Si le licenciement est jugé sans cause, ajouter indemnité barémée Macron : 3 à 8 mois pour 8 ans d'ancienneté (art. L1235-3).

**Conclusion** — Action prud'homale recommandée. Stratégie : contester d'abord la motivation, puis subsidiairement la qualification de faute grave, puis subsidiairement la cause réelle et sérieuse.`,
      submittedAt: isoDaysAgo(DEFAULT_ANCHOR, 13),
    }))(),
    grading: ((): CasPratiqueGrading => ({
      axes: [
        { axis: 'identification', label: 'Identification', score: 4, max: 4, feedback: `Toutes les questions identifiées. Vous voyez bien la distinction faute / insuffisance et la question de la modification du contrat.` },
        { axis: 'syllogisme', label: 'Syllogisme', score: 4, max: 5, feedback: `Bons syllogismes pour chaque question. La distinction faute grave / cause simple est bien posée. La référence à l'arrêt du 13 nov. 2008 est précieuse.` },
        { axis: 'regles', label: 'Règles', score: 3, max: 4, feedback: `Bonne maîtrise des articles L1232-1, L1232-6, L1234-1, L1235-3. L'article L1226-2 sur le reclassement aurait pu être évoqué pour distinguer du licenciement pour inaptitude.` },
        { axis: 'application', label: 'Application', score: 2, max: 3, feedback: `Application solide mais l'analyse de l'altercation gagnerait à être plus poussée — preuves, témoins, contexte.` },
        { axis: 'redaction', label: 'Rédaction', score: 2, max: 2, feedback: `Mémorandum bien structuré.` },
        { axis: 'conseil', label: 'Conseil', score: 1, max: 2, feedback: `Stratégie en cascade correcte, mais le conseil sur les coûts (procédure prud'homale, délais) et les chances objectives par moyen manque.` },
      ],
      overall: { score: 16, topMistake: `Conseil opérationnel insuffisant — vous identifiez bien les moyens mais ne quantifiez pas leurs chances de succès.`, strength: `Excellente identification des questions et maîtrise précise des distinctions doctrinales (faute/insuffisance, modification/refus).`, identifiedIssues: [0, 1, 2, 3, 4], missedIssues: [] },
      gradedAt: isoDaysAgo(DEFAULT_ANCHOR, 13),
    }))(),
  },

  // ─── Cas pratique — Pénal (graded, 12/20) ───
  {
    id: 'demo-cas-pratique-penal-1',
    type: 'cas-pratique',
    daysAgo: 4,
    state: 'graded',
    task: ((): CasPratiqueTask => ({
      specialty: 'penal' as never,
      specialtyLabel: 'Droit pénal',
      duration: 180,
      scenario: `M. Belmont, gérant d'une SARL en difficulté financière, présente à sa banque un bilan présentant des chiffres d'affaires fictifs sur les 18 derniers mois afin d'obtenir une ligne de crédit de 200 000 €. La banque accorde le crédit. Quelques mois plus tard, la société est mise en liquidation judiciaire. La banque, ayant découvert la falsification, dépose plainte.

Au cours de l'enquête, il apparaît que M. Belmont a également utilisé une partie de la trésorerie sociale pour des dépenses personnelles à hauteur de 35 000 € (achat d'un véhicule, voyages).

Conseillez M. Belmont, qui craint d'être poursuivi.`,
      modelAnswer: `Quatre qualifications possibles : escroquerie (art. 313-1), abus de biens sociaux (art. L241-3 4° C. com.), banqueroute (L654-2), faux et usage de faux. Stratégie de défense.`,
      legalIssues: [`Escroquerie (313-1) — manœuvres frauduleuses + remise + préjudice`, `Abus de biens sociaux (L241-3 4° C. com.)`, `Banqueroute (L654-2 C. com.)`, `Faux et usage de faux (441-1)`, `Stratégie de défense — circonstances atténuantes`],
      groundingPool: [],
      generatedAt: isoDaysAgo(DEFAULT_ANCHOR, 4),
    }))(),
    submission: ((): CasPratiqueSubmission => ({
      answer: `**Mémorandum à l'attention de Monsieur Belmont**

**Question 1 — L'escroquerie est-elle caractérisée ?**

L'article 313-1 du Code pénal sanctionne « le fait, soit par l'usage d'un faux nom ou d'une fausse qualité, soit par l'abus d'une qualité vraie, soit par l'emploi de manœuvres frauduleuses, de tromper une personne physique ou morale et de la déterminer ainsi à remettre des fonds ».

En l'espèce, M. Belmont a présenté un bilan falsifié — manœuvres frauduleuses. La banque a remis 200 000 €. L'escroquerie est constituée. Peine encourue : 5 ans d'emprisonnement et 375 000 € d'amende.

**Question 2 — L'abus de biens sociaux ?**

L'article L241-3 4° du Code de commerce sanctionne le gérant qui utilise les biens de la société à des fins personnelles. L'utilisation de 35 000 € de trésorerie pour des dépenses personnelles constitue manifestement un abus. Peine : 5 ans et 375 000 €.

**Conclusion** — M. Belmont s'expose à de lourdes poursuites. Stratégie de défense limitée : reconnaissance des faits éventuelle, plaidoirie sur les difficultés financières, restitution des sommes pour atténuer la peine.`,
      submittedAt: isoDaysAgo(DEFAULT_ANCHOR, 4),
    }))(),
    grading: ((): CasPratiqueGrading => ({
      axes: [
        { axis: 'identification', label: 'Identification', score: 2, max: 4, feedback: `Seules deux qualifications identifiées sur quatre. Vous oubliez la banqueroute (art. L654-2 C. com.) — pourtant centrale dès lors que la société est en liquidation. Vous oubliez aussi le faux et usage de faux (art. 441-1).` },
        { axis: 'syllogisme', label: 'Syllogisme', score: 3, max: 5, feedback: `Syllogismes corrects pour les deux qualifications traitées. L'escroquerie aurait gagné à discuter le caractère intentionnel et le préjudice de la banque. L'ABS méritait davantage sur le critère de l'intérêt social.` },
        { axis: 'regles', label: 'Règles', score: 2, max: 4, feedback: `Connaissance des articles 313-1 et L241-3 4°. Manque la banqueroute (L654-2) et le faux (441-1). Erreur de quantum sur l'ABS — la peine est de 5 ans / 375 000 €, exact, mais avec aggravation possible si le préjudice est important.` },
        { axis: 'application', label: 'Application', score: 2, max: 3, feedback: `Application correcte mais sommaire. Le lien entre les deux infractions n'est pas analysé.` },
        { axis: 'redaction', label: 'Rédaction', score: 2, max: 2, feedback: `Rédaction claire.` },
        { axis: 'conseil', label: 'Conseil', score: 1, max: 2, feedback: `Conseil très limité. La stratégie de défense réelle suppose d'évaluer chaque grief séparément, d'envisager une CRPC, des transactions civiles avec la banque, etc.` },
      ],
      overall: { score: 12, topMistake: `Identification incomplète — la banqueroute et le faux et usage de faux sont des infractions classiques dans ce type de scénario.`, strength: `Maîtrise correcte de l'escroquerie et de l'ABS.`, identifiedIssues: [0, 1], missedIssues: [2, 3, 4] },
      gradedAt: isoDaysAgo(DEFAULT_ANCHOR, 4),
    }))(),
  },

  // ─── Note de synthèse — Demo dossier 1 (graded, 13/20) ───
  {
    id: 'demo-note-synthese-1',
    type: 'note-synthese',
    daysAgo: 27,
    state: 'graded',
    task: ((): NoteSyntheseTask => ({
      dossierTitle: `La protection du logement familial`,
      problematique: `Comment le droit français concilie-t-il la liberté individuelle des époux et la protection du logement familial comme bien commun ?`,
      planSuggere: { I: 'Une protection patrimoniale impérative', IA: 'Cogestion et insaisissabilité', IB: 'Limites de la cogestion', II: 'Une protection étendue par la jurisprudence', IIA: 'Extension aux droits personnels', IIB: 'Tempéraments en présence de tiers' },
      documents: [
        { docNumber: 1, type: 'legislation', title: 'Article 215 du Code civil', sourceUrl: 'codes/code-civil', content: `Les époux s'obligent mutuellement à une communauté de vie. Ils ne peuvent l'un sans l'autre disposer des droits par lesquels est assuré le logement de la famille...` },
        { docNumber: 2, type: 'jurisprudence-cass', title: 'Cass. 1re civ., 4 octobre 2005, n° 02-20.598', sourceUrl: '', content: `Sur la protection du bail d'habitation lorsqu'il sert de logement familial...` },
        { docNumber: 3, type: 'doctrine', title: 'F. Terré, Y. Lequette, Droit civil — Les régimes matrimoniaux, n° 87 et s.', sourceUrl: '', content: `La protection du logement familial constitue l'un des piliers du régime primaire impératif...` },
      ],
      modelSynthesis: `Synthèse modèle de référence — non communiquée à l'étudiant pendant l'épreuve.`,
      rubric: { criteria: [{ criterion: 'Couverture des documents', points: 4 }, { criterion: 'Plan structuré', points: 4 }, { criterion: 'Problématique', points: 3 }, { criterion: 'Synthèse fidèle', points: 3 }, { criterion: 'Longueur (4 pages)', points: 2 }, { criterion: 'Rédaction', points: 2 }, { criterion: 'Neutralité', points: 1 }, { criterion: 'Équilibre', points: 1 }], totalPoints: 20, documentCoverageMap: { '1': 'I.A et I.B', '2': 'II.A', '3': 'I et II' } },
      generatedAt: isoDaysAgo(DEFAULT_ANCHOR, 27),
      practiceExamSessionId: 'demo-pratique-exam-synth-1',
    }))(),
    submission: ((): NoteSyntheseSubmission => ({
      text: `**La protection du logement familial**

L'article 215 du Code civil consacre, dans le régime primaire impératif, une protection particulière du logement de la famille. Cette protection s'inscrit dans la tension permanente entre liberté individuelle des époux et préservation du cadre commun.

**I. Une protection patrimoniale impérative**

A. La cogestion comme principe — l'article 215 alinéa 3 impose le consentement des deux époux pour les actes de disposition portant sur le logement familial. Cette règle protège indistinctement la propriété et le droit au bail.

B. Les limites de la cogestion — la doctrine (F. Terré) souligne les difficultés d'application en présence de tiers de bonne foi. La nullité de l'acte accompli unilatéralement reste relative et se prescrit par un an.

**II. Une protection étendue par la jurisprudence**

A. L'extension aux droits personnels — l'arrêt de la première chambre civile du 4 octobre 2005 étend la protection au bail d'habitation servant de logement familial. La protection couvre le droit au maintien dans les lieux.

B. Les tempéraments — face aux créanciers et acquéreurs de bonne foi, des aménagements existent.

**Conclusion** — la protection du logement familial illustre l'équilibre recherché par le législateur entre autonomie et solidarité conjugale.`,
      submittedAt: isoDaysAgo(DEFAULT_ANCHOR, 27),
    }))(),
    grading: ((): NoteSyntheseGrading => ({
      axes: [
        { axis: 'documents', label: 'Couverture des documents', score: 2, max: 4, feedback: `Vous citez les trois documents mais sans les exploiter en profondeur. Le document 3 (doctrine) est utilisé une seule fois alors qu'il offre une grille de lecture.` },
        { axis: 'plan', label: 'Plan', score: 3, max: 4, feedback: `Plan correct dans sa structure. La sous-partie I.B est maigre — elle devrait développer davantage les limites de la cogestion.` },
        { axis: 'problematique', label: 'Problématique', score: 2, max: 3, feedback: `Problématique annoncée en introduction mais non reprise dans le développement. Vous gagneriez à articuler chaque sous-partie à la problématique posée.` },
        { axis: 'qualite', label: 'Qualité de la synthèse', score: 2, max: 3, feedback: `Synthèse correcte mais superficielle. La protection du droit au bail (document 2) mérite plus de détails — c'est une extension importante.` },
        { axis: 'neutralite', label: 'Neutralité', score: 1, max: 1, feedback: `Bonne neutralité — pas d'apport personnel.` },
        { axis: 'longueur', label: 'Longueur', score: 1, max: 2, feedback: `Synthèse trop courte — vous êtes loin des 4 pages attendues. Plus c'est court, moins on couvre les documents.` },
        { axis: 'redaction', label: 'Rédaction', score: 1, max: 2, feedback: `Style juridique correct mais peu fluide. Trop de phrases courtes juxtaposées.` },
        { axis: 'equilibre', label: 'Équilibre', score: 1, max: 1, feedback: `Bon équilibre I/II.` },
      ],
      overall: { score: 13, topMistake: `Synthèse trop courte et peu fidèle aux documents — exploitez davantage les sources, structurez 4 pages.`, strength: `Plan logique et neutralité respectée.` },
      documentsCited: [1, 2, 3],
      documentsMissed: [],
      gradedAt: isoDaysAgo(DEFAULT_ANCHOR, 27),
    }))(),
  },
]

// ─── Legal fiches ────────────────────────────────────────────────

interface DemoLegalFiche {
  id: string
  theme: string
  themeId?: string
  matiere?: string
  source: 'theme' | 'cours' | 'custom'
  prompt: string
  daysAgo: number
  content: string
  groundingPool?: unknown[]
}

export const CRFPA_DEMO_LEGAL_FICHES: DemoLegalFiche[] = [
  {
    id: 'demo-fiche-resp-contractuelle',
    theme: 'Responsabilité contractuelle',
    themeId: 'resp-contractuelle',
    matiere: 'obligations',
    source: 'theme',
    prompt: 'Responsabilité contractuelle',
    daysAgo: 24,
    content: `# Responsabilité contractuelle

## Définition et fondement

La responsabilité contractuelle est l'obligation pour le débiteur d'une obligation contractuelle inexécutée, mal exécutée ou exécutée tardivement de réparer le préjudice qu'il cause au créancier.

Fondement légal : article 1231-1 du Code civil — *« Le débiteur est condamné, s'il y a lieu, au paiement de dommages et intérêts soit à raison de l'inexécution de l'obligation, soit à raison du retard dans l'exécution, s'il ne justifie pas que l'exécution a été empêchée par la force majeure. »*

L'ordonnance du 10 février 2016 a regroupé sous un même article (1217) l'éventail des sanctions de l'inexécution : exécution forcée, résolution, réduction du prix, dommages-intérêts, exception d'inexécution.

## Conditions d'engagement

Trois conditions cumulatives :

**1. Inexécution contractuelle** — Inexécution totale, partielle, mauvaise exécution, exécution tardive. La distinction obligation de moyens / obligation de résultat (Cass. 1re civ., 21 nov. 1911 — affaire Mayer) commande la charge de la preuve : sur le débiteur d'une obligation de résultat, présomption de faute ; sur le créancier d'une obligation de moyens, charge de prouver la négligence.

**2. Préjudice** — Dommage certain, direct, prévisible (art. 1231-3 C. civ. — sauf dol ou faute lourde, art. 1231-4). Sont indemnisables : la perte éprouvée (*damnum emergens*), le gain manqué (*lucrum cessans*), et le préjudice moral (Cass. ch. mixte, 27 fév. 1970, Lunus).

**3. Lien de causalité** — Causalité directe et certaine entre l'inexécution et le préjudice. La théorie de l'équivalence des conditions est généralement retenue, tempérée par celle de la causalité adéquate dans les hypothèses de pluralité de causes.

## Conditions d'exonération

Le débiteur s'exonère en démontrant la **force majeure** (art. 1218 C. civ.) — événement échappant à son contrôle, qui ne pouvait être raisonnablement prévu lors de la conclusion du contrat et dont les effets ne peuvent être évités par des mesures appropriées.

La **mise en demeure** est en principe nécessaire (art. 1231 C. civ.), sauf inexécution définitive ou clause contraire.

Les **clauses limitatives ou exclusives de responsabilité** sont admises mais leur portée est restreinte par la jurisprudence Chronopost (Cass. com., 22 oct. 1996) : la clause qui prive l'engagement essentiel de toute portée est réputée non écrite. La règle est désormais codifiée à l'article 1170 C. civ.

## Étendue de la réparation

Le principe est celui de la **réparation intégrale** (Cass. 2e civ., 28 oct. 1954) : restituer le créancier dans la situation où il se serait trouvé si le contrat avait été correctement exécuté.

Limites :
- L'article 1231-3 C. civ. limite la réparation aux dommages prévisibles à la conclusion du contrat (sauf dol ou faute lourde — art. 1231-4) ;
- Le créancier doit prendre les mesures raisonnables pour modérer son préjudice (Cass. 2e civ., 19 juin 2003) ;
- Les clauses pénales sont modérables par le juge si manifestement excessives ou dérisoires (art. 1231-5 C. civ.).

## Articulation avec d'autres responsabilités

**Responsabilité contractuelle vs. délictuelle** — Le principe du non-cumul (Cass. 1re civ., 11 janv. 1922) interdit au créancier d'une obligation contractuelle d'invoquer la responsabilité délictuelle envers son cocontractant. Exception : l'action contre le tiers complice de la violation du contrat, qui relève de la délictuelle (Cass. 1re civ., 17 oct. 2000).

**Responsabilité contractuelle vs. garantie des vices cachés** — Le contrat de vente connaît une responsabilité spéciale (art. 1641 et s. C. civ.) qui se cumule, en principe, avec la responsabilité contractuelle de droit commun (Cass. com., 17 janv. 2018).

## Repères jurisprudentiels essentiels

- **Cass. 1re civ., 21 nov. 1911 (Mayer)** : distinction obligation de moyens / obligation de résultat.
- **Cass. com., 22 oct. 1996 (Chronopost)** : clause limitative privant de substance l'obligation essentielle réputée non écrite.
- **Cass. ch. mixte, 22 avr. 2005 (Tabalica)** : préjudice moral réparable au titre de la responsabilité contractuelle.
- **Cass. com., 17 janv. 2018** : cumul de la responsabilité contractuelle et de la garantie des vices cachés.

## Pièges méthodologiques

- Bien qualifier le contrat avant d'invoquer la responsabilité — un contrat nul ou inexistant n'engage pas la responsabilité contractuelle.
- Vérifier l'existence d'une mise en demeure préalable lorsque l'obligation n'est pas définitivement inexécutée.
- Distinguer dommages-intérêts compensatoires (réparation) et clauses pénales (forfaitisation conventionnelle).
`,
    groundingPool: [
      { articleNum: '1231-1', codeName: 'Code civil', text: 'Le débiteur est condamné, s\'il y a lieu, au paiement de dommages et intérêts...' },
      { articleNum: '1217', codeName: 'Code civil', text: 'La partie envers laquelle l\'engagement n\'a pas été exécuté...' },
      { articleNum: '1218', codeName: 'Code civil', text: 'Il y a force majeure en matière contractuelle lorsqu\'un événement échappant au contrôle du débiteur...' },
    ],
  },
  {
    id: 'demo-fiche-vices-consentement',
    theme: 'Vices du consentement',
    themeId: 'vices-consentement',
    matiere: 'obligations',
    source: 'theme',
    prompt: 'Vices du consentement',
    daysAgo: 30,
    content: `# Vices du consentement

## Cadre général

Article 1130 C. civ. : « L'erreur, le dol et la violence vicient le consentement lorsqu'ils sont de telle nature que, sans eux, l'une des parties n'aurait pas contracté ou aurait contracté à des conditions substantiellement différentes. »

Sanction commune : nullité relative (art. 1131), prescription de 5 ans à compter de la découverte (art. 2224).

## L'erreur (art. 1132-1136)

**Conditions** : porter sur les qualités essentielles de la prestation ou du cocontractant (art. 1132) ; être déterminante du consentement ; être excusable.

**Exclusions** : erreur sur les motifs (art. 1135), sauf élément essentiel intégré au champ contractuel ; erreur sur la valeur (art. 1136), sauf erreur sur les qualités essentielles entraînant erreur sur la valeur.

**Jurisprudence** : Cass. 1re civ., 22 fév. 1978 (Poussin) — l'erreur du vendeur sur l'authenticité de la toile vicie son consentement.

## Le dol (art. 1137-1139)

**Définition** : manœuvres, mensonges ou réticence dolosive (dissimulation intentionnelle d'une information déterminante connue du cocontractant — art. 1137 al. 2).

**Conditions** : caractère déterminant ; émanation du cocontractant ou du tiers de connivence ; intention dolosive.

**Effet sur l'erreur provoquée** : la jurisprudence Cass. ch. mixte, 21 déc. 2007 pose que la réticence dolosive rend toujours excusable l'erreur. Codifié à l'article 1139.

## La violence (art. 1140-1143)

**Violence classique** : pression de nature à inspirer la crainte d'un mal considérable (art. 1140).

**Violence économique** : abus de l'état de dépendance, codifiée à l'art. 1143 — innovation de l'ordonnance 2016 inspirée de Cass. 1re civ., 3 avr. 2002 et Cass. 1re civ., 30 mai 2000 (Bordas).

## Sanctions et articulation

Nullité relative invocable par la victime (art. 1131). Cumul possible avec la responsabilité civile pour dommages-intérêts (art. 1240). Articulation avec la garantie des vices cachés en matière de vente (Cass. com., 17 janv. 2018 sur le cumul).

## Pièges méthodologiques

- Bien identifier le vice avant de discuter ses conditions (erreur ≠ dol).
- Ne pas oublier la condition d'excusabilité de l'erreur.
- Distinguer dol provoqué (manœuvres) et réticence dolosive (silence).
`,
    groundingPool: [
      { articleNum: '1130', codeName: 'Code civil', text: 'L\'erreur, le dol et la violence vicient le consentement...' },
      { articleNum: '1137', codeName: 'Code civil', text: 'Le dol est le fait pour un contractant d\'obtenir le consentement de l\'autre par des manœuvres ou des mensonges...' },
      { articleNum: '1143', codeName: 'Code civil', text: 'Il y a également violence lorsqu\'une partie, abusant de l\'état de dépendance dans lequel se trouve son cocontractant...' },
    ],
  },
  {
    id: 'demo-fiche-resp-fait-choses',
    theme: 'Responsabilité du fait des choses',
    themeId: 'resp-delictuelle',
    matiere: 'obligations',
    source: 'theme',
    prompt: 'Responsabilité du fait des choses',
    daysAgo: 25,
    content: `# Responsabilité du fait des choses

## Fondement

Article 1242 alinéa 1 C. civ. : « On est responsable... du dommage... causé par le fait des choses que l'on a sous sa garde. » Régime jurisprudentiellement autonome consacré par Cass. civ., 16 juin 1896 (Teffaine), généralisé par Cass. ch. réunies, 13 fév. 1930 (Jand'heur).

## Conditions

**1. Une chose** : toute chose mobilière ou immobilière, dotée ou non d'un dynamisme propre. Exclusions classiques : corps humain vivant, animaux (régime spécial art. 1243).

**2. Le fait de la chose** : participation matérielle de la chose au dommage. Le fait peut être actif (chose en mouvement) ou passif (chose inerte) — Cass. 2e civ., 24 fév. 2005 sur le rôle actif requis.

**3. La garde** : pouvoir de contrôle, de direction et d'usage sur la chose (Cass. ch. réunies, 2 déc. 1941, Franck). Distinction garde de la structure (vice interne — fabricant) / garde du comportement (utilisation — utilisateur), Cass. 2e civ., 5 janv. 1956 (Trichard, oxygène liquide).

## Régime

**Présomption irréfragable** de responsabilité du gardien (Jand'heur). Le gardien ne s'exonère qu'en démontrant une cause étrangère exonératoire :
- Force majeure (extériorité, imprévisibilité, irrésistibilité — art. 1218).
- Fait du tiers présentant les caractères de la force majeure.
- Faute de la victime — exonération totale si force majeure, partielle sinon (Cass. 2e civ., 21 juill. 1982, Desmares — abandonnée par Cass. 2e civ., 6 avril 1987 — modulation rétablie).

## Articulation avec d'autres régimes

- **Loi du 5 juillet 1985 (accidents de la circulation)** : régime spécial qui évince l'application de l'art. 1242 al. 1 pour les véhicules terrestres à moteur.
- **Responsabilité des produits défectueux** (art. 1245-1245-17, transposition directive 1985) : responsabilité du producteur, indépendante de la garde.

## Repères jurisprudentiels

- Cass. civ., 16 juin 1896 (Teffaine) — fondateur.
- Cass. ch. réunies, 13 fév. 1930 (Jand'heur) — consécration.
- Cass. ch. réunies, 2 déc. 1941 (Franck) — définition de la garde.
- Cass. 2e civ., 5 janv. 1956 (Trichard) — garde structure/comportement.
- Cass. 2e civ., 24 fév. 2005 — exigence du rôle actif pour les choses inertes.

## Pièges méthodologiques

- Vérifier qu'aucun régime spécial (loi 1985, défectuosité produit) n'évince le régime de droit commun.
- Ne pas confondre garde matérielle de fait et garde juridique.
- Bien distinguer le fait actif et le fait passif — la jurisprudence est exigeante sur le rôle actif des choses inertes.
`,
    groundingPool: [
      { articleNum: '1242', codeName: 'Code civil', text: 'On est responsable non seulement du dommage que l\'on cause par son propre fait...' },
      { articleNum: '1218', codeName: 'Code civil', text: 'Il y a force majeure en matière contractuelle...' },
    ],
  },
  {
    id: 'demo-fiche-garde-vue',
    theme: 'Garde à vue',
    themeId: 'procedure-penale-gav',
    matiere: 'procedure-penale',
    source: 'theme',
    prompt: 'Garde à vue',
    daysAgo: 20,
    content: `# Garde à vue

## Définition et conditions

Article 62-2 CPP : mesure de contrainte exercée à l'encontre d'une personne soupçonnée d'avoir commis ou tenté de commettre un crime ou un délit puni d'emprisonnement, sur décision et sous le contrôle d'un OPJ.

**Conditions** : raisons plausibles de soupçonner ; nécessité concrète d'investigations, de présentation au procureur, de protection des preuves ou des témoins ; appréciation in concreto (Cass. crim., 11 juill. 2017).

## Droits notifiés (art. 63-1 CPP)

Notification immédiate :
- Nature et date présumée de l'infraction.
- Durée de la mesure et conditions de prolongation.
- Droit de faire prévenir un proche et un employeur.
- Droit d'être examiné par un médecin.
- Droit de garder le silence.
- Droit à l'assistance d'un avocat (art. 63-3-1 et 63-4).
- Droit à un interprète.
- Droit limité de consulter le dossier (art. 63-4-1).

## Durée

**Régime de droit commun** : 24 heures, prolongation de 24 heures par autorisation écrite et motivée du procureur (art. 63 II), conditionnée à un délit puni d'au moins un an d'emprisonnement.

**Régimes spéciaux** : 96 heures pour la criminalité organisée, le trafic de stupéfiants (art. 706-88) ; 144 heures pour les crimes contre l'humanité et le terrorisme (art. 706-88-1).

## Sanctions

Nullité de la procédure (art. 171 CPP) en cas de violation, subordonnée à la démonstration d'un grief par celui qui l'invoque (Cass. crim., 19 sept. 2012).

Causes classiques : absence ou notification tardive des droits, absence d'avocat lors d'un interrogatoire, défaut de placement effectif, défaut de motivation de la prolongation.

## Articulation avec la CEDH

Article 6 § 3 CEDH : droit à un procès équitable et à l'assistance d'un avocat. Jurisprudence Salduz c/ Turquie (CEDH, 27 nov. 2008) à l'origine de la réforme française de 2011.

## Repères jurisprudentiels

- Cass. crim., 19 oct. 2010 — nullité des déclarations sans avocat.
- Cass. crim., 11 juill. 2017 — appréciation in concreto du placement.
- Cass. crim., 19 sept. 2012 — exigence du grief.

## Pièges méthodologiques

- La nullité n'est jamais automatique : il faut démontrer le grief.
- Distinguer notification (formelle) et exercice effectif (mise en œuvre) des droits.
- Bien identifier le régime applicable (droit commun vs. criminalité organisée).
`,
    groundingPool: [
      { articleNum: '62-2', codeName: 'Code de procédure pénale', text: 'La garde à vue est une mesure de contrainte...' },
      { articleNum: '63-1', codeName: 'Code de procédure pénale', text: 'La personne placée en garde à vue est immédiatement informée...' },
      { articleNum: '171', codeName: 'Code de procédure pénale', text: 'Il y a nullité lorsque la méconnaissance d\'une formalité substantielle prévue par une disposition du présent code...' },
    ],
  },
  {
    id: 'demo-fiche-legitime-defense',
    theme: 'Légitime défense',
    themeId: 'causes-irresponsabilite',
    matiere: 'penal',
    source: 'theme',
    prompt: 'Légitime défense',
    daysAgo: 18,
    content: `# Légitime défense

## Fondement légal

Article 122-5 du Code pénal : « N'est pas pénalement responsable la personne qui, devant une atteinte injustifiée envers elle-même ou autrui, accomplit, dans le même temps, un acte commandé par la nécessité de la légitime défense d'elle-même ou d'autrui, sauf s'il y a disproportion entre les moyens de défense employés et la gravité de l'atteinte. »

## Conditions

### Atteinte injustifiée
- Réelle ou imminente, dirigée contre la personne ou autrui.
- Injustifiée — atteinte non autorisée par la loi.
- Exclusion : agression en cours ou achevée, voie de fait passée.

### Réaction immédiate
- Concomitance entre l'atteinte et la défense.
- Exclusion de la riposte différée — relèverait de la vengeance, sanctionnable.

### Nécessité
- L'acte de défense est commandé par la nécessité — pas d'alternative raisonnable disponible.
- Possibilité de fuite n'évince pas systématiquement la nécessité (Cass. crim., 6 fév. 1991).

### Proportionnalité
- Adéquation entre moyens de défense et gravité de l'atteinte.
- Appréciation in concreto par le juge.

## Régime spécial — défense des biens (art. 122-5 al. 2)

Conditions plus strictes : doit être strictement nécessaire, ne peut consister en un homicide volontaire, doit être proportionnée aux moyens employés.

## Présomptions de légitime défense (art. 122-6)

Sont présumés agir en état de légitime défense ceux qui repoussent :
- L'auteur d'un crime ou délit contre les biens, exécuté avec violence ou ruse, en pénétrant dans un lieu habité.
- L'auteur de violences sur la personne d'autrui.

Présomption simple — peut être renversée par la preuve contraire.

## Sanctions et effets

Si la légitime défense est retenue :
- Cause d'irresponsabilité pénale — pas de condamnation.
- Effets sur la responsabilité civile : difficiles, jurisprudence nuancée (Cass. 2e civ., 22 mai 2003).

## Repères jurisprudentiels

- Cass. crim., 6 fév. 1991 — possibilité de fuite et nécessité.
- Cass. crim., 11 juill. 2007 — disproportion en matière d'arme.
- Cass. 2e civ., 22 mai 2003 — articulation civil/pénal.

## Pièges méthodologiques

- Vérifier les quatre conditions cumulatives.
- Distinguer la légitime défense des personnes (122-5 al. 1) de celle des biens (122-5 al. 2).
- Ne pas confondre avec l'état de nécessité (art. 122-7), qui suppose un péril non causé par autrui.
`,
    groundingPool: [
      { articleNum: '122-5', codeName: 'Code pénal', text: 'N\'est pas pénalement responsable la personne qui, devant une atteinte injustifiée...' },
      { articleNum: '122-6', codeName: 'Code pénal', text: 'Est présumé avoir agi en état de légitime défense...' },
    ],
  },
  {
    id: 'demo-fiche-baux-commerciaux',
    theme: 'Baux commerciaux',
    themeId: 'baux-commerciaux',
    matiere: 'affaires',
    source: 'theme',
    prompt: 'Baux commerciaux',
    daysAgo: 14,
    content: `# Baux commerciaux

## Régime spécial — la propriété commerciale

Articles L145-1 et s. C. com. (statut des baux commerciaux). Le bail commercial garantit au locataire un droit au renouvellement et, à défaut, une indemnité d'éviction — la « propriété commerciale ».

**Conditions d'application** :
- Local affecté à l'exercice d'une activité commerciale, industrielle ou artisanale.
- Inscription au RCS ou au répertoire des métiers.
- Exploitation effective dans les locaux loués depuis au moins trois ans.

## Durée et résiliation

**Durée minimale** : 9 ans (art. L145-4). Faculté triennale de résiliation pour le locataire, sauf clause contraire pour les baux portant sur des locaux à usage exclusif de bureaux ou monovalent.

**Résiliation par le bailleur** : difficile en cours de bail, soumise à des conditions strictes (clause résolutoire avec mise en demeure, défaut de paiement, etc.).

## Renouvellement

À l'expiration du bail, le locataire bénéficie du droit au renouvellement (art. L145-8). Mécanismes :
- Demande du locataire ou offre du bailleur.
- Acceptation tacite à défaut de réponse dans les 3 mois.
- Refus du bailleur ouvre droit à indemnité d'éviction (art. L145-14).

## Le loyer et son déplafonnement

Principe : le loyer du bail renouvelé est plafonné par référence à la variation de l'indice (art. L145-34). Exceptions au plafonnement (déplafonnement) :
- Modification notable des facteurs locaux de commercialité.
- Bail d'une durée supérieure à 9 ans.
- Local à usage exclusif de bureaux.

La loi Pinel du 18 juin 2014 a plafonné le déplafonnement à 10 % du loyer payé l'année précédente (lissage).

## Indemnité d'éviction

À défaut de renouvellement, l'indemnité couvre :
- Valeur marchande du fonds de commerce.
- Frais de réinstallation.
- Frais de licenciement éventuels du personnel.
- Indemnités de mutation et de remploi.

Calcul : généralement par référence à la valeur du fonds, déterminée selon les méthodes d'évaluation (chiffre d'affaires, bénéfice).

## Repères jurisprudentiels

- Cass. 3e civ., 9 juill. 2003 — exigence d'inscription effective au RCS.
- Cass. 3e civ., 19 nov. 1997 — appréciation des facteurs locaux de commercialité.
- Cass. 3e civ., 11 oct. 2018 — loi Pinel et déplafonnement.

## Pièges méthodologiques

- Vérifier l'application du statut (les locaux purement administratifs en sont exclus).
- Bien distinguer renouvellement et reconduction tacite.
- L'indemnité d'éviction se calcule au jour du départ effectif, pas du congé.
`,
    groundingPool: [
      { articleNum: 'L145-1', codeName: 'Code de commerce', text: 'Les dispositions du présent chapitre s\'appliquent aux baux des immeubles ou locaux dans lesquels un fonds est exploité...' },
      { articleNum: 'L145-14', codeName: 'Code de commerce', text: 'Le bailleur peut refuser le renouvellement du bail. Toutefois, le bailleur doit, sauf exceptions prévues...' },
    ],
  },
  {
    id: 'demo-fiche-abus-majorite',
    theme: 'Abus de majorité',
    themeId: 'societes-abus',
    matiere: 'affaires',
    source: 'theme',
    prompt: 'Abus de majorité',
    daysAgo: 11,
    content: `# Abus de majorité (et de minorité)

## Notion

L'abus de majorité est une décision sociale prise par les associés majoritaires au détriment des minoritaires et dans un but contraire à l'intérêt social. Construction jurisprudentielle (Cass. com., 18 avr. 1961, Schumann), pas de fondement textuel direct.

L'abus de minorité est l'attitude des minoritaires qui, par leur opposition, paralysent une décision essentielle à la vie de la société (Cass. com., 14 janv. 1992, Vitama).

## Conditions de l'abus de majorité

**1. Décision contraire à l'intérêt social** — la décision ne doit pas servir l'intérêt général de la société. Exemples : mise en réserve systématique sans justification, fusion à des conditions désavantageuses.

**2. Décision prise dans l'unique dessein de favoriser les majoritaires au détriment des minoritaires** — exigence d'intention discriminatoire.

**3. Rupture d'égalité entre associés** — les majoritaires reçoivent un avantage que les minoritaires ne reçoivent pas.

## Sanctions

- **Nullité de la décision** (art. L235-1 C. com. — pour les SA et SARL).
- **Dommages-intérêts** au profit des minoritaires lésés (responsabilité civile des majoritaires, art. 1240 C. civ.).
- **Action ut singuli** (art. L223-22 SARL, L225-252 SA) — l'associé peut agir au nom de la société.

## L'abus de minorité

**Conditions** : opposition contraire à l'intérêt social ET dans le but unique de favoriser les minoritaires (Cass. com., 9 mars 1993, Flandin).

**Sanction** : la jurisprudence Cass. com., 9 mars 1993 a rejeté l'idée d'un vote substitutif. Solution : désignation d'un mandataire ad hoc pour voter à la place du minoritaire (Cass. com., 5 avril 1994).

## Repères jurisprudentiels

- Cass. com., 18 avr. 1961 (Schumann) — fondateur de l'abus de majorité.
- Cass. com., 22 avr. 1976 — précisions sur la rupture d'égalité.
- Cass. com., 14 janv. 1992 (Vitama) — fondateur de l'abus de minorité.
- Cass. com., 9 mars 1993 (Flandin) — refus du vote substitutif.

## Articulation avec la responsabilité des dirigeants

L'abus de majorité concerne les associés ; la responsabilité des dirigeants relève d'un régime distinct (faute de gestion, art. L223-22 et L225-251). Cumul possible si le dirigeant est aussi associé majoritaire.

## Pièges méthodologiques

- Vérifier les trois conditions cumulatives — l'absence d'intérêt social ne suffit pas.
- Bien distinguer abus de majorité et infraction d'abus de biens sociaux (art. L241-3 4° C. com.).
- L'abus de minorité ne se sanctionne pas par un vote substitutif.
`,
    groundingPool: [
      { articleNum: 'L235-1', codeName: 'Code de commerce', text: 'La nullité d\'une société ou d\'un acte modifiant les statuts ne peut résulter que d\'une disposition expresse...' },
    ],
  },
  {
    id: 'demo-fiche-licenciement-perso',
    theme: 'Licenciement pour motif personnel',
    themeId: 'licenciement-personnel',
    matiere: 'social',
    source: 'theme',
    prompt: 'Licenciement pour motif personnel',
    daysAgo: 8,
    content: `# Licenciement pour motif personnel

## Cause réelle et sérieuse (art. L1232-1)

Triple exigence cumulative : **réelle** (existante, objective), **sérieuse** (gravité suffisante), **personnelle** (tirée du salarié, non économique).

L'absence de cause réelle et sérieuse ouvre droit à indemnisation (barèmes Macron, art. L1235-3, validés par Cass. soc., 11 mai 2022).

## Les motifs

### La faute du salarié

Trois degrés :
- **Faute simple** : justifie le licenciement, conserve indemnités de préavis et de licenciement.
- **Faute grave** (art. L1234-1) : rend impossible le maintien dans l'entreprise pendant le préavis. Privation des indemnités de préavis et de licenciement.
- **Faute lourde** : intention de nuire à l'employeur. Outre les sanctions précédentes, ouvre la responsabilité civile du salarié (Cass. soc., 22 oct. 2015).

### L'insuffisance professionnelle

Distincte de la faute (Cass. soc., 13 nov. 2008). Ne suppose pas de comportement répréhensible mais une incapacité objective à exécuter le travail.

### L'inaptitude médicale

Constatée par le médecin du travail. Obligation de reclassement préalable (art. L1226-2 et L1226-10). Licenciement possible seulement si le reclassement est impossible.

## La procédure

**Convocation** : par lettre remise contre décharge ou recommandée (art. L1232-2). Délai minimum de 5 jours ouvrables avant l'entretien.

**Entretien préalable** : le salarié peut être assisté d'un membre du personnel ou d'un conseiller (art. L1232-4).

**Notification** : lettre recommandée envoyée au moins 2 jours ouvrables après l'entretien (art. L1232-6). Doit énoncer des motifs précis et matériellement vérifiables (Cass. soc., 22 mars 2017).

**Précisions ex post** : l'employeur peut compléter les motifs dans les 15 jours suivant la notification (art. L1235-2 — depuis 2017).

## Conséquences pécuniaires

**Préavis** (sauf faute grave/lourde) : 1 mois (< 2 ans), 2 mois (≥ 2 ans).

**Indemnité légale** (art. L1234-9, R1234-2) : ¼ de mois × ancienneté jusqu'à 10 ans, ⅓ au-delà.

**Indemnité sans cause réelle et sérieuse** (barèmes Macron) : 0,5 à 20 mois selon ancienneté et taille de l'entreprise. Plancher en cas d'atteinte à une liberté fondamentale (Cass. soc., 11 mai 2022).

## Repères jurisprudentiels

- Cass. soc., 22 mars 2017 — exigence de faits matériellement vérifiables.
- Cass. soc., 13 nov. 2008 — distinction faute / insuffisance.
- Cass. soc., 11 mai 2022 — validation des barèmes Macron.

## Pièges méthodologiques

- Bien qualifier la faute (simple, grave, lourde) — la qualification commande la pénalité.
- Distinguer faute disciplinaire et insuffisance professionnelle.
- Pour l'inaptitude, ne jamais oublier l'obligation de reclassement.
`,
    groundingPool: [
      { articleNum: 'L1232-1', codeName: 'Code du travail', text: 'Tout licenciement pour motif personnel est motivé...' },
      { articleNum: 'L1234-1', codeName: 'Code du travail', text: 'Lorsque le licenciement n\'est pas motivé par une faute grave...' },
    ],
  },
  {
    id: 'demo-fiche-rep-administratif',
    theme: 'Recours pour excès de pouvoir',
    themeId: 'rep-rec-abus-pouvoir',
    matiere: 'administratif',
    source: 'theme',
    prompt: 'Recours pour excès de pouvoir',
    daysAgo: 5,
    content: `# Recours pour excès de pouvoir

## Définition

Recours objectif tendant à l'annulation d'un acte administratif unilatéral pour cause d'illégalité. Ouvert sans texte (CE, ass., 17 fév. 1950, Dame Lamotte). Vise le respect de la légalité, non la satisfaction de droits subjectifs.

## Conditions de recevabilité

**Acte attaquable** : décision administrative unilatérale faisant grief (effets juridiques). Exclusions : actes préparatoires, mesures d'ordre intérieur (sauf droits, CE 17 fév. 1995, Marie), circulaires non impératives.

**Intérêt à agir** : direct et personnel. Apprécié largement (CE 29 mars 1901, Casanova : contribuable communal).

**Délai** : 2 mois à compter de la publication ou notification (art. R421-1 CJA). Délai raisonnable d'un an en l'absence de mention des voies de recours (CE, ass., 13 juill. 2016, Czabaj).

## Moyens

### Légalité externe
- **Incompétence** — moyen d'ordre public.
- **Vice de forme** — défaut de motivation, signature, etc.
- **Vice de procédure** — sanctionné si influence sur la décision (CE, ass., 23 déc. 2011, Danthony).

### Légalité interne
- **Violation directe de la loi** — non-respect d'une règle applicable.
- **Erreur de droit** — fondement textuel inapplicable ou mal interprété.
- **Erreur de fait** — fondement factuel inexact.
- **Erreur manifeste d'appréciation** — limite minimale du contrôle.
- **Détournement de pouvoir** — but autre que celui prévu par le texte.

## Effets de l'annulation

Annulation **rétroactive** — l'acte est censé n'avoir jamais existé. Modulation possible si conséquences manifestement excessives (CE, ass., 11 mai 2004, AC !).

L'administration doit tirer les conséquences (retrait, abrogation des actes pris sur le fondement de l'acte annulé).

## Articulation avec d'autres recours

- **Recours de pleine juridiction** : recours subjectif, indemnisation possible.
- **Référé-suspension** (art. L521-1 CJA) : suspension provisoire, urgence et doute sérieux.
- **Référé-liberté** (art. L521-2) : urgence et atteinte grave à une liberté fondamentale.

En matière contractuelle, depuis CE, ass., 4 avr. 2014, Tarn-et-Garonne, le contentieux est largement passé du REP au recours de pleine juridiction.

## Repères jurisprudentiels

- CE, ass., 17 fév. 1950 — Dame Lamotte (REP ouvert sans texte).
- CE, ass., 11 mai 2004 — AC ! (modulation de l'annulation).
- CE, ass., 23 déc. 2011 — Danthony (vice de procédure).
- CE, ass., 13 juill. 2016 — Czabaj (délai raisonnable).

## Pièges méthodologiques

- Vérifier que l'acte fait grief — beaucoup d'actes ne sont pas attaquables.
- Bien identifier la nature du moyen (externe vs. interne) avant d'invoquer.
- Pour les contrats, privilégier le recours Tarn-et-Garonne et non plus le REP.
`,
    groundingPool: [
      { articleNum: 'R421-1', codeName: 'Code de justice administrative', text: 'La juridiction ne peut être saisie que par voie de recours formé contre une décision...' },
      { articleNum: 'L521-1', codeName: 'Code de justice administrative', text: 'Quand une décision administrative... fait l\'objet d\'une requête en annulation ou en réformation...' },
    ],
  },
  {
    id: 'demo-fiche-secret-pro',
    theme: 'Secret professionnel de l\'avocat',
    matiere: 'libertes',
    source: 'custom',
    prompt: 'Secret professionnel et déontologie',
    daysAgo: 1,
    content: `# Secret professionnel de l'avocat

## Sources

- **Article 66-5 de la loi du 31 décembre 1971** — affirmation du secret en toutes matières et tous domaines.
- **Article 226-13 du Code pénal** — sanction pénale (1 an + 15 000 €).
- **Articles 2 et 3 du RIN** — dispositions déontologiques.

## Étendue

**Caractère général** — toutes matières, tous domaines (conseil et défense), toutes pièces (correspondances, notes, consultations, dossier complet).

**Caractère absolu** — pas d'exception fondée sur l'opportunité ou l'intérêt général. Confirmation : Cass. crim., 14 nov. 2017.

**Caractère illimité dans le temps** — la fin du mandat ne lève pas le secret.

**Caractère d'ordre public** — le client ne peut délier l'avocat (Cass. crim., 6 mai 1992).

## Correspondances

**Correspondances confidentielles** : entre avocat et client, entre confrères. Insaisissables, inopposables. Ne peuvent être produites en justice.

**Correspondances officielles** : mention « officielle » apposée. Peuvent être produites. Servent à acter formellement des positions.

## Exceptions et tempéraments

### TRACFIN (lutte anti-blanchiment)

Activités spécifiques (transactions immobilières, gestion d'actifs, montage de sociétés) : obligation de déclaration de soupçon (art. L561-3 CMF). Exclusion : défense, conseil juridique, mandat ad hoc. Filtrage par le bâtonnier.

### Procédure pénale

Perquisitions au cabinet d'un avocat : présence du bâtonnier, contrôle du JLD (art. 56-1 CPP).

### Défense pénale

L'avocat peut faire état d'éléments communiqués par le client, dans le cadre du mandat et dans son intérêt.

## Sanctions

- **Pénales** (art. 226-13 C. pén.) — 1 an, 15 000 €.
- **Disciplinaires** — jusqu'à la radiation (art. 184 décret du 27 nov. 1991).
- **Civiles** — engagement de la responsabilité civile professionnelle.

## Tensions contemporaines

- Données numériques — sécurisation matérielle des communications.
- Transparence financière (Panama, Pandora Papers) — pression sur la confidentialité de certaines structurations.
- DAC 6 (directive UE) — obligations déclaratives pour certains avocats fiscalistes.

## Pièges méthodologiques

- Bien distinguer correspondance confidentielle / officielle (mention).
- TRACFIN ne s'applique pas à la défense.
- Le secret survit à la fin du mandat — illimité dans le temps.
`,
    groundingPool: [
      { articleNum: '66-5', codeName: 'Loi du 31 décembre 1971', text: 'En toutes matières, que ce soit dans le domaine du conseil ou dans celui de la défense...' },
      { articleNum: '226-13', codeName: 'Code pénal', text: 'La révélation d\'une information à caractère secret par une personne qui en est dépositaire...' },
    ],
  },
]

// ─── Conversations (Oracle chat) ─────────────────────────────────

interface DemoConversation {
  id: string
  title: string
  daysAgo: number
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
}

export const CRFPA_DEMO_CONVERSATIONS: DemoConversation[] = [
  {
    id: 'demo-convo-formation-contrat',
    title: 'Formation du contrat — conditions de validité',
    daysAgo: 26,
    messages: [
      {
        role: 'user',
        content: `Quelles sont les conditions de validité d'un contrat depuis la réforme de 2016 ?`,
      },
      {
        role: 'assistant',
        content: `Depuis l'ordonnance du 10 février 2016, les conditions de validité du contrat sont posées à l'**article 1128 du Code civil**, qui exige trois conditions cumulatives :

1. **Le consentement des parties** (art. 1128 1°) — réel et exempt de vices (erreur, dol, violence — art. 1130 et suivants).
2. **La capacité de contracter** (art. 1128 2°) — la capacité est la règle, l'incapacité l'exception (art. 1145).
3. **Un contenu licite et certain** (art. 1128 3°) — le contrat ne doit pas déroger à l'ordre public (art. 1162) et la prestation doit être possible et déterminée (art. 1163).

À noter : la **cause** a été supprimée comme condition autonome, mais ses fonctions sont reprises par les articles 1162 (but illicite ou contraire à l'ordre public) et 1169 (contrepartie illusoire ou dérisoire dans les contrats à titre onéreux).

L'absence d'une condition emporte **nullité** :
- **Relative** lorsque la règle protège un intérêt particulier (vices du consentement, incapacité).
- **Absolue** lorsque la règle protège l'intérêt général (illicéité, ordre public).

Voulez-vous que j'approfondisse l'une de ces conditions ?`,
      },
      {
        role: 'user',
        content: `Comment distinguer la nullité absolue et la nullité relative en pratique ?`,
      },
      {
        role: 'assistant',
        content: `Les deux régimes diffèrent sur quatre points pratiques :

**1. Qualité pour agir**
- **Relative** (art. 1181) : seule la partie protégée peut invoquer la nullité.
- **Absolue** (art. 1180) : toute personne justifiant d'un intérêt peut agir, et le ministère public d'office.

**2. Confirmation possible**
- **Relative** (art. 1182) : peut être confirmée par la partie protégée — par acte exprès ou tacite (exécution du contrat en connaissance du vice).
- **Absolue** : ne peut être confirmée — l'ordre public n'est pas à la disposition des parties.

**3. Prescription**
- Les deux : 5 ans (art. 2224).
- **Relative** : court à compter de la découverte du vice (vices du consentement) ou de la cessation de l'incapacité.
- **Absolue** : court à compter du jour où le titulaire du droit a connu ou aurait dû connaître les faits.

**4. Effets de l'annulation**
Identiques : effet rétroactif, restitutions réciproques (art. 1352 et s.). La distinction porte donc sur l'accès à la sanction, non sur ses conséquences.

**Application pratique** : si votre client veut faire annuler un contrat conclu sous l'empire d'un dol, c'est une **nullité relative** — il devra agir dans les 5 ans à compter de la découverte du dol et lui seul peut le faire.`,
      },
    ],
  },
  {
    id: 'demo-convo-garde-vue-droits',
    title: 'Garde à vue — droits et nullités',
    daysAgo: 17,
    messages: [
      {
        role: 'user',
        content: `Si l'avocat n'est pas présent lors de la première heure de garde à vue, les déclarations sont-elles automatiquement nulles ?`,
      },
      {
        role: 'assistant',
        content: `Non, la nullité n'est pas automatique. Le régime exige la **démonstration d'un grief** par celui qui invoque la nullité (art. 171 du Code de procédure pénale).

**Le principe** : depuis la loi du 14 avril 2011 et les arrêts CEDH Salduz c/ Turquie (27 nov. 2008) et Cass. crim., 19 oct. 2010, l'absence d'avocat lors d'un interrogatoire en garde à vue constitue une violation des droits de la défense (art. 6 § 3 CEDH ; art. 63-3-1 et 63-4 CPP).

**La condition du grief** : la chambre criminelle pose constamment qu'il faut, en plus de la violation, démontrer un grief — c'est-à-dire une atteinte concrète aux droits de la défense (Cass. crim., 19 sept. 2012, n° 12-83.527).

**En pratique** :
- Si la personne a fait des **déclarations auto-incriminantes** sans avocat → grief facile à démontrer, nullité probable.
- Si la personne a **gardé le silence** pendant l'interrogatoire → le grief est moins évident.
- Si l'avocat est arrivé tard mais avant la fin de la GAV → il faut examiner le contenu des actes accomplis hors sa présence.

**Sanction** : les déclarations recueillies en violation des droits de la défense sont **écartées du dossier** (Cass. crim., 19 oct. 2010, n° 10-82.902). Le reste de la procédure peut subsister selon le principe de la nullité partielle.

**Conseil pratique** : toujours vérifier l'horodatage de la première intervention de l'avocat, le contenu des PV d'audition, et la chronologie des actes accomplis.`,
      },
    ],
  },
  {
    id: 'demo-convo-obligations-moyens-resultat',
    title: 'Obligation de moyens vs. obligation de résultat',
    daysAgo: 12,
    messages: [
      {
        role: 'user',
        content: `Quelle est la différence concrète entre obligation de moyens et obligation de résultat, et comment cela affecte la charge de la preuve ?`,
      },
      {
        role: 'assistant',
        content: `La distinction entre **obligation de moyens** et **obligation de résultat** commande la charge de la preuve en cas d'inexécution contractuelle.

**Origine** : la distinction est jurisprudentielle (Cass. 1re civ., 21 nov. 1911, Mayer) et n'est pas codifiée. Elle vise à concilier les régimes dissemblables imposés par les contrats spéciaux.

**Obligation de moyens** :
- Le débiteur doit fournir les diligences nécessaires sans garantir un résultat précis.
- Exemple : médecin, avocat (sauf clauses particulières), conseil financier.
- **Charge de la preuve** : sur le **créancier**, qui doit démontrer la **faute** du débiteur (négligence, imprudence, défaut de diligence).
- L'inexécution ne se présume pas — le simple échec du résultat ne suffit pas.

**Obligation de résultat** :
- Le débiteur s'engage à atteindre un résultat précis.
- Exemple : transporteur (livraison à destination), vendeur (transfert de propriété), entreprise de travaux pour un ouvrage.
- **Charge de la preuve** : présomption de **faute du débiteur** dès lors que le résultat n'est pas atteint. Le créancier n'a qu'à démontrer l'inexécution.
- Le débiteur ne s'exonère qu'en démontrant la **force majeure** (art. 1218 C. civ.) — extériorité, imprévisibilité, irrésistibilité.

**Critères de qualification** :
- **Aléa du résultat** : si le résultat dépend de circonstances échappant au contrôle du débiteur, on est en obligation de moyens.
- **Volonté des parties** : la rédaction du contrat peut imposer un résultat (clause de garantie de réussite).
- **Pratique du secteur** : usage et réglementation peuvent qualifier la nature de l'obligation.

**Application pratique** : si vous représentez la victime d'un accident lors d'une intervention chirurgicale, l'obligation est de **moyens** — vous devez prouver une faute médicale, ce qui justifie souvent une expertise. Si le grief porte sur un transport de marchandises non livrées, l'obligation est de **résultat** — le transporteur est présumé responsable.

**Évolutions** : la jurisprudence multiplie les **obligations intermédiaires** (obligation de moyens renforcée, obligation de résultat atténuée) — par exemple en matière médicale pour les interventions à risque limité (Cass. 1re civ., 4 avr. 2006).`,
      },
    ],
  },
  {
    id: 'demo-convo-vices-caches-vente',
    title: 'Vices cachés et garantie de conformité',
    daysAgo: 7,
    messages: [
      {
        role: 'user',
        content: `Mon client a acheté un véhicule d'occasion à un particulier. Il découvre 4 mois plus tard un défaut moteur grave. Quels recours ?`,
      },
      {
        role: 'assistant',
        content: `Plusieurs fondements peuvent être invoqués selon la nature du défaut et les circonstances de la vente. Je vous présente les options principales et leur articulation.

**1. Garantie des vices cachés (art. 1641 et s. C. civ.)**

C'est le fondement le plus adapté en présence d'un défaut grave et caché.

**Conditions** (cumulatives) :
- Vice **caché** — non apparent au moment de la vente.
- **Antérieur** à la vente — le défaut existait déjà à la conclusion.
- Vice **rendant la chose impropre à l'usage** auquel on la destine.

**Délai d'action** : 2 ans à compter de la **découverte** du vice (art. 1648).

**Sanctions** : choix de l'acheteur entre :
- L'**action rédhibitoire** (rendre la chose, récupérer le prix).
- L'**action estimatoire** (garder la chose et obtenir réduction du prix).
- En cas de mauvaise foi du vendeur : dommages-intérêts (art. 1645).

**Charge de la preuve** : sur l'acheteur, mais facilitée par expertise.

**2. Erreur ou dol (art. 1130 et s. C. civ.)**

Si le défaut affecte une qualité essentielle du véhicule (kilométrage, accident antérieur, etc.) :
- **Erreur** sur les qualités essentielles (art. 1132) — nullité relative.
- **Dol** ou **réticence dolosive** si le vendeur a dissimulé l'information (art. 1137).

**Délai** : 5 ans à compter de la découverte (art. 2224).

**3. Garantie de conformité (art. L217-3 C. consommation)**

⚠️ Ce régime ne s'applique **pas** ici — il est réservé aux ventes par un **professionnel à un consommateur**. Votre client a acheté à un **particulier**.

**Stratégie**

Pour une **panne moteur grave** :
- **Action principale** : garantie des vices cachés (art. 1641) — délai de 2 ans, choix entre rédhibitoire et estimatoire.
- **Action subsidiaire** : nullité pour vice du consentement si le vendeur connaissait le défaut.

**Conseils pratiques** :
1. Faire **expertiser** le véhicule rapidement pour établir l'antériorité du vice.
2. **Mise en demeure** au vendeur (lettre recommandée).
3. **Cumul possible** garantie des vices cachés + dommages-intérêts si mauvaise foi (Cass. com., 17 janv. 2018).

Le délai d'action court à compter de la découverte — votre client est dans les temps.`,
      },
    ],
  },
  {
    id: 'demo-convo-rep-administratif',
    title: 'Recours administratif — délai et Czabaj',
    daysAgo: 3,
    messages: [
      {
        role: 'user',
        content: `Un arrêté municipal a été publié il y a 4 mois sans mention des voies de recours. Mon client peut-il encore l'attaquer ?`,
      },
      {
        role: 'assistant',
        content: `Possiblement, oui. La jurisprudence **Czabaj** (CE, ass., 13 juill. 2016, n° 387763) a transformé le régime des délais en l'absence de mention des voies de recours.

**Régime classique** : l'article R421-5 CJA prévoit que le délai de 2 mois (art. R421-1) n'est opposable qu'à condition que la notification ou la publication mentionne les voies et délais de recours.

**Avant Czabaj** : en l'absence de mention, le délai était **inopposable indéfiniment** — la décision pouvait être attaquée sans limite de temps.

**Après Czabaj** : le Conseil d'État a posé un **délai raisonnable d'un an** à compter de la connaissance de l'acte par l'intéressé, applicable même en l'absence de mention. Le but : préserver la sécurité juridique.

**Application à votre cas** :
- Publication il y a 4 mois → bien en deçà du délai d'un an.
- Absence de mention des voies de recours → délai de 2 mois inopposable.
- Conclusion : le recours est **recevable**, à condition de respecter le délai raisonnable d'un an et de démontrer un intérêt à agir.

**Précisions importantes** :
1. Le délai d'un an est un **délai maximal** — il peut être réduit selon les circonstances (Cass. soc., 8 fév. 2017 sur la prescription du licenciement, par analogie).
2. En matière de **REP**, le délai raisonnable est généralement strict d'un an (CE, 31 mars 2017, Krupa).
3. En matière de **plein contentieux**, la jurisprudence est plus souple (CE, 13 juill. 2016, Czabaj même : pas de délai raisonnable systématique).

**Stratégie procédurale** :
- Vérifier le **point de départ du délai d'un an** : à partir de quand votre client a-t-il eu connaissance de l'acte ? Publication officielle, mais aussi connaissance personnelle.
- **Recours préalable** facultatif : recours gracieux auprès de l'auteur de l'acte ou recours hiérarchique. Cela proroge le délai.
- **Référé-suspension** (art. L521-1 CJA) en parallèle si urgence et doute sérieux.

**Conseil** : agir rapidement — plus le temps passe, plus l'argument de la sécurité juridique sera opposable. Préparez le dossier dans les semaines qui viennent.`,
      },
    ],
  },
]

// ─── Library reads ───────────────────────────────────────────────

export const CRFPA_DEMO_LIBRARY_READS: Array<{
  libraryEntryId: string
  status: 'reading' | 'read'
  daysAgo: number
}> = [
  // Library entry IDs follow the manifest pattern: <category>/<slug>
  { libraryEntryId: 'codes/code-civil', status: 'reading', daysAgo: 1 },
  { libraryEntryId: 'codes/code-penal', status: 'read', daysAgo: 5 },
  { libraryEntryId: 'codes/code-procedure-civile', status: 'read', daysAgo: 11 },
  { libraryEntryId: 'codes/code-procedure-penale', status: 'reading', daysAgo: 3 },
  { libraryEntryId: 'codes/code-travail', status: 'read', daysAgo: 8 },
  { libraryEntryId: 'codes/code-commerce', status: 'read', daysAgo: 13 },
  { libraryEntryId: 'codes/code-justice-administrative', status: 'read', daysAgo: 6 },
  { libraryEntryId: 'codes/code-consommation', status: 'reading', daysAgo: 4 },
  { libraryEntryId: 'textes/constitution', status: 'read', daysAgo: 22 },
  { libraryEntryId: 'textes/grands-arrets', status: 'reading', daysAgo: 2 },
  { libraryEntryId: 'textes/deontologie', status: 'read', daysAgo: 1 },
  { libraryEntryId: 'textes/crfpa-official', status: 'read', daysAgo: 28 },
  { libraryEntryId: 'pdfs/crfpa/rin-2026', status: 'reading', daysAgo: 7 },
  { libraryEntryId: 'pdfs/crfpa/sujet-2024-obligations', status: 'read', daysAgo: 30 },
  { libraryEntryId: 'pdfs/crfpa/grille-2025-civil', status: 'read', daysAgo: 25 },
]

// ─── Daily study logs (last 14 days) ─────────────────────────────

interface DemoDailyLog {
  daysAgo: number       // 0 = today
  totalMinutes: number  // 0 means rest day
  questionsAnswered: number
  questionsCorrect: number
}

export const CRFPA_DEMO_DAILY_LOGS: DemoDailyLog[] = [
  // 14 days of varied study patterns. Roughly 18-20h/week with 2 rest days.
  { daysAgo: 0, totalMinutes: 95, questionsAnswered: 4, questionsCorrect: 3 },
  { daysAgo: 1, totalMinutes: 175, questionsAnswered: 8, questionsCorrect: 6 },
  { daysAgo: 2, totalMinutes: 0, questionsAnswered: 0, questionsCorrect: 0 },
  { daysAgo: 3, totalMinutes: 140, questionsAnswered: 6, questionsCorrect: 5 },
  { daysAgo: 4, totalMinutes: 200, questionsAnswered: 9, questionsCorrect: 7 },
  { daysAgo: 5, totalMinutes: 110, questionsAnswered: 5, questionsCorrect: 4 },
  { daysAgo: 6, totalMinutes: 165, questionsAnswered: 7, questionsCorrect: 5 },
  { daysAgo: 7, totalMinutes: 80, questionsAnswered: 3, questionsCorrect: 3 },
  { daysAgo: 8, totalMinutes: 0, questionsAnswered: 0, questionsCorrect: 0 },
  { daysAgo: 9, totalMinutes: 220, questionsAnswered: 10, questionsCorrect: 8 },
  { daysAgo: 10, totalMinutes: 130, questionsAnswered: 6, questionsCorrect: 4 },
  { daysAgo: 11, totalMinutes: 155, questionsAnswered: 7, questionsCorrect: 6 },
  { daysAgo: 12, totalMinutes: 100, questionsAnswered: 4, questionsCorrect: 3 },
  { daysAgo: 13, totalMinutes: 185, questionsAnswered: 8, questionsCorrect: 6 },
]

// ─── Wipe ────────────────────────────────────────────────────────

/**
 * Deletes all profile-scoped child rows except the profile itself,
 * its subjects, chapters, topics, and subtopics. Idempotent.
 */
export async function wipeCrfpaProfileData(profileId: string): Promise<void> {
  // Conversations have child chatMessages keyed by conversationId, not examProfileId.
  // Collect ids first, delete children, then conversations.
  const convoIds = (await db.conversations.where('examProfileId').equals(profileId).toArray()).map(c => c.id)
  if (convoIds.length > 0) {
    await db.chatMessages.where('conversationId').anyOf(convoIds).delete()
  }

  // Profile-scoped tables to wipe
  const tables = [
    db.documents, db.documentChunks, db.documentFiles,
    db.coachingSessions, db.legalFiches,
    db.conversations, db.chatFeedback,
    db.libraryReadStatus, db.dailyStudyLogs,
    db.exercises, db.examSources, db.exerciseAttempts,
    db.masterySnapshots, db.pdfHighlights,
    db.conceptCards, db.flashcards, db.flashcardDecks,
    db.studySessions, db.questionResults,
    db.notifications, db.practiceExamSessions, db.generatedQuestions,
    db.revisionFiches, db.examDNA,
    db.misconceptions, db.sessionInsights, db.conversationSummaries,
    db.assignments,
    db.chunkEmbeddings, db.topicEmbeddings,
    db.agentRuns, db.agentInsights,
    db.studyPlans, db.studyPlanDays,
    db.achievements,
  ]
  await Promise.all(tables.map(t => t.where('examProfileId').equals(profileId).delete()))
}

// ─── Install ─────────────────────────────────────────────────────

export interface InstallCrfpaDemoOptions {
  profileId: string
  /** Anchor date for all relative timestamps. Defaults to today. */
  anchorDate?: string
  /** If true, wipe profile-scoped data before installing. */
  wipeFirst?: boolean
}

export interface InstallCrfpaDemoReport {
  documents: number
  documentChunks: number
  coachingSessions: number
  legalFiches: number
  conversations: number
  chatMessages: number
  libraryReads: number
  dailyLogs: number
}

/**
 * Installs the deterministic CRFPA demo dataset into the given profile.
 * Subjects/chapters/topics MUST already exist (from profile creation).
 */
export async function installCrfpaDemo(opts: InstallCrfpaDemoOptions): Promise<InstallCrfpaDemoReport> {
  const { profileId } = opts
  const anchor = opts.anchorDate ?? DEFAULT_ANCHOR

  if (opts.wipeFirst) {
    await wipeCrfpaProfileData(profileId)
  }

  // ─── Documents + chunks ──────────────────────────────────
  const documents: Document[] = []
  const documentChunks: DocumentChunk[] = []

  for (const doc of CRFPA_DEMO_DOCUMENTS) {
    const createdAt = isoDaysAgo(anchor, doc.daysAgo)
    const chunks = chunkText(doc.content, 400)
    documents.push({
      id: doc.id,
      examProfileId: profileId,
      title: doc.title,
      sourceType: doc.sourceType,
      category: doc.category,
      originalContent: doc.content,
      chunkCount: chunks.length,
      wordCount: doc.content.split(/\s+/).length,
      sourceUrl: doc.sourceUrl,
      tags: doc.tags ? JSON.stringify(doc.tags) : undefined,
      createdAt,
    })
    chunks.forEach((c, i) => {
      documentChunks.push({
        id: `${doc.id}:chunk${i}`,
        documentId: doc.id,
        examProfileId: profileId,
        content: c,
        chunkIndex: i,
        keywords: computeKeywords(c),
      })
    })
  }
  if (documents.length > 0) await db.documents.bulkPut(documents)
  if (documentChunks.length > 0) await db.documentChunks.bulkPut(documentChunks)

  // ─── Coaching sessions ────────────────────────────────────
  const coachingSessions: CoachingSession[] = CRFPA_DEMO_COACHING_SESSIONS.map(s => ({
    id: s.id,
    examProfileId: profileId,
    type: s.type,
    task: JSON.stringify(s.task),
    submission: s.submission ? JSON.stringify(s.submission) : undefined,
    grading: s.grading ? JSON.stringify(s.grading) : undefined,
    createdAt: isoDaysAgo(anchor, s.daysAgo),
    completedAt: s.state === 'graded' ? isoDaysAgo(anchor, s.daysAgo) : undefined,
  }))
  if (coachingSessions.length > 0) await db.coachingSessions.bulkPut(coachingSessions)

  // ─── Legal fiches ─────────────────────────────────────────
  const legalFiches: LegalFiche[] = CRFPA_DEMO_LEGAL_FICHES.map(f => {
    const ts = isoDaysAgo(anchor, f.daysAgo)
    return {
      id: f.id,
      examProfileId: profileId,
      theme: f.theme,
      themeId: f.themeId,
      matiere: f.matiere,
      source: f.source,
      prompt: f.prompt,
      content: f.content,
      groundingPool: JSON.stringify(f.groundingPool ?? []),
      userSourceChunks: JSON.stringify([]),
      userAnnotations: JSON.stringify({}),
      actualiteStatus: 'not-needed',
      version: 1,
      createdAt: ts,
      updatedAt: ts,
    }
  })
  if (legalFiches.length > 0) await db.legalFiches.bulkPut(legalFiches)

  // ─── Conversations + messages ─────────────────────────────
  const conversations: Conversation[] = []
  const chatMessages: ChatMessage[] = []
  for (const c of CRFPA_DEMO_CONVERSATIONS) {
    const ts = isoDaysAgo(anchor, c.daysAgo)
    conversations.push({
      id: c.id,
      examProfileId: profileId,
      title: c.title,
      createdAt: ts,
      updatedAt: ts,
    })
    c.messages.forEach((m, i) => {
      chatMessages.push({
        id: `${c.id}:msg${i}`,
        conversationId: c.id,
        role: m.role,
        content: m.content,
        // Stagger messages by 30s within the conversation
        timestamp: new Date(new Date(ts).getTime() + i * 30000).toISOString(),
      })
    })
  }
  if (conversations.length > 0) await db.conversations.bulkPut(conversations)
  if (chatMessages.length > 0) await db.chatMessages.bulkPut(chatMessages)

  // ─── Library reads ────────────────────────────────────────
  const libraryReads: LibraryReadStatus[] = CRFPA_DEMO_LIBRARY_READS.map(r => ({
    id: `${profileId}:${r.libraryEntryId}`,
    examProfileId: profileId,
    libraryEntryId: r.libraryEntryId,
    status: r.status,
    lastOpenedAt: isoDaysAgo(anchor, r.daysAgo),
  }))
  if (libraryReads.length > 0) await db.libraryReadStatus.bulkPut(libraryReads)

  // ─── Daily study logs ─────────────────────────────────────
  const dailyLogs: DailyStudyLog[] = CRFPA_DEMO_DAILY_LOGS.map(l => {
    const date = dateDaysAgo(anchor, l.daysAgo)
    return {
      id: `${profileId}:${date}`,
      examProfileId: profileId,
      date,
      totalSeconds: l.totalMinutes * 60,
      subjectBreakdown: [],
      questionsAnswered: l.questionsAnswered,
      questionsCorrect: l.questionsCorrect,
    }
  })
  if (dailyLogs.length > 0) await db.dailyStudyLogs.bulkPut(dailyLogs)

  return {
    documents: documents.length,
    documentChunks: documentChunks.length,
    coachingSessions: coachingSessions.length,
    legalFiches: legalFiches.length,
    conversations: conversations.length,
    chatMessages: chatMessages.length,
    libraryReads: libraryReads.length,
    dailyLogs: dailyLogs.length,
  }
}
