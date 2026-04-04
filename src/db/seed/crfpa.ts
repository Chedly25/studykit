/**
 * CRFPA starter exercises — seeded when a french-bar exam profile is created.
 * These are AI-generated placeholder exercises for review before shipping.
 * Each covers a core legal topic from the CRFPA syllabus.
 */

export interface SeedExercise {
  text: string
  solutionText: string
  difficulty: number
  topicName: string // matched against profile topics by name
}

export const CRFPA_EXERCISES: SeedExercise[] = [
  // ── Droit des obligations ────────────────────────────────
  {
    text: "Monsieur Dupont a commandé un meuble sur mesure chez un artisan. Après livraison, il constate que les dimensions ne correspondent pas au devis signé. L'artisan refuse toute modification, arguant que le meuble est conforme « aux usages du métier ». Quels sont les fondements juridiques permettant à M. Dupont d'obtenir soit la mise en conformité, soit la résolution du contrat ?",
    solutionText: "M. Dupont peut invoquer l'inexécution contractuelle (art. 1217 C. civ.) pour obtenir l'exécution forcée en nature (art. 1221) ou la résolution (art. 1224). Le devis signé constitue le contenu obligationnel du contrat (art. 1103). L'artisan ne peut se prévaloir des usages si les stipulations contractuelles sont claires (art. 1188). En cas de résolution, M. Dupont peut également demander des dommages-intérêts pour le préjudice subi (art. 1231-1).",
    difficulty: 2,
    topicName: "Obligations",
  },
  {
    text: "Un vendeur professionnel vend un véhicule d'occasion avec un compteur kilométrique falsifié. L'acheteur, un particulier, découvre la fraude six mois après la vente. Analysez les actions possibles de l'acheteur sur le fondement des vices du consentement.",
    solutionText: "L'acheteur peut agir en nullité pour dol (art. 1137-1138 C. civ.). La falsification du compteur constitue une manœuvre dolosive déterminante du consentement. Le dol émane du cocontractant, ce qui facilite la preuve. L'action se prescrit par 5 ans à compter de la découverte du vice (art. 1144). L'acheteur peut aussi exercer l'action en garantie des vices cachés (art. 1641 C. civ.) dans un délai de 2 ans à compter de la découverte. Le cumul des deux fondements est possible (Cass. com., 17 janv. 2018).",
    difficulty: 3,
    topicName: "Obligations",
  },
  {
    text: "Marie confie la rénovation de son appartement à une entreprise de bâtiment. Pendant les travaux, un ouvrier de l'entreprise casse accidentellement une canalisation, provoquant un dégât des eaux chez le voisin du dessous. Sur quels fondements le voisin peut-il agir et contre qui ?",
    solutionText: "Le voisin peut agir : 1) Contre l'entreprise en responsabilité du fait de ses préposés (art. 1242 al. 5 C. civ.) — l'ouvrier a agi dans les fonctions auxquelles il était employé ; 2) Contre Marie en responsabilité du fait des choses si la canalisation cassée relève de sa garde (art. 1242 al. 1) ; 3) Sur le fondement des troubles anormaux de voisinage (jurisprudence constante). L'entreprise peut appeler en garantie son assurance responsabilité civile professionnelle.",
    difficulty: 3,
    topicName: "Responsabilité civile",
  },

  // ── Droit des contrats spéciaux ──────────────────────────
  {
    text: "Pierre loue un appartement à Sophie par bail d'habitation. Après un an, Pierre souhaite vendre l'immeuble à un tiers. Quelles sont les obligations du bailleur à l'égard de la locataire en matière de congé pour vente et de droit de préemption ?",
    solutionText: "Le bailleur doit : 1) Donner congé au locataire au moins 6 mois avant le terme du bail (art. 15 loi du 6 juillet 1989) ; 2) Notifier le congé par LRAR ou acte d'huissier ; 3) Mentionner le prix et les conditions de vente car le congé vaut offre de vente au locataire (droit de préemption légal, art. 15 II). Le locataire dispose de 2 mois pour accepter. À défaut de respect de ces formalités, le congé est nul (Cass. 3e civ., 13 juill. 2016).",
    difficulty: 2,
    topicName: "Contrats spéciaux",
  },
  {
    text: "Un mandat immobilier exclusif est conclu pour 3 mois entre un propriétaire et une agence. Avant l'expiration du délai, le propriétaire vend directement le bien à un acheteur trouvé par ses propres moyens. L'agence réclame le paiement de sa commission. A-t-elle raison ?",
    solutionText: "Oui, dans le cadre d'un mandat exclusif, le mandant s'interdit de traiter directement (art. 6 loi Hoguet et art. 78 décret du 20 juillet 1972). La vente directe pendant la période d'exclusivité constitue une violation du mandat et ouvre droit à la commission contractuellement prévue, sous réserve que le mandat respecte les conditions de forme (écrit, durée déterminée, clause pénale proportionnée). Le juge peut toutefois modérer la clause pénale si elle est manifestement excessive (art. 1231-5 C. civ.).",
    difficulty: 3,
    topicName: "Contrats spéciaux",
  },

  // ── Libertés et droits fondamentaux ──────────────────────
  {
    text: "Un employeur interdit à ses salariés le port de tout signe religieux visible dans l'entreprise, y compris le voile islamique. Une salariée conteste cette interdiction. Analysez la légalité de cette mesure au regard des libertés fondamentales.",
    solutionText: "L'analyse porte sur l'articulation entre la liberté de religion (art. 9 CEDH, art. 10 DDHC) et le pouvoir de direction de l'employeur. Depuis la loi El Khomri (art. L.1321-2-1 C. trav.), le règlement intérieur peut contenir une clause de neutralité restreignant la manifestation des convictions religieuses, à condition que la restriction soit : 1) justifiée par les nécessités de bon fonctionnement de l'entreprise ; 2) proportionnée au but recherché ; 3) applicable à tous les signes sans discrimination. La CJUE (arrêt Achbita, 14 mars 2017) a validé ce type de clause sous ces conditions.",
    difficulty: 4,
    topicName: "Libertés fondamentales",
  },
  {
    text: "Un journaliste est poursuivi pour diffamation après avoir publié un article mettant en cause un élu local dans une affaire de favoritisme. Quels sont les moyens de défense dont dispose le journaliste ?",
    solutionText: "Le journaliste peut invoquer : 1) L'exception de vérité (art. 35 loi du 29 juillet 1881) — prouver la véracité des faits allégués par des éléments antérieurs à la publication ; 2) La bonne foi journalistique (critères : légitimité du but poursuivi, absence d'animosité personnelle, prudence et mesure dans l'expression, sérieux de l'enquête — Cass. crim., 11 juin 2013) ; 3) Le débat d'intérêt général (CEDH, Lingens c/ Autriche) — la critique d'un élu relève du débat démocratique avec une protection renforcée de la liberté d'expression. Le délai de prescription est de 3 mois (art. 65 loi de 1881).",
    difficulty: 4,
    topicName: "Libertés fondamentales",
  },

  // ── Procédure civile ─────────────────────────────────────
  {
    text: "Après un jugement de première instance le condamnant à payer 15 000 € de dommages-intérêts, le défendeur souhaite faire appel. Le jugement mentionne l'exécution provisoire de droit. Peut-il empêcher l'exécution du jugement pendant la procédure d'appel ?",
    solutionText: "Depuis la réforme du 1er janvier 2020, l'exécution provisoire est de droit pour les jugements de première instance (art. 514 CPC). Le défendeur peut : 1) Demander l'arrêt de l'exécution provisoire au premier président de la cour d'appel (art. 514-3 CPC), en démontrant qu'elle risque d'entraîner des conséquences manifestement excessives ; 2) Solliciter un aménagement (consignation, garantie — art. 521 CPC). Le simple appel ne suspend plus l'exécution. La demande d'arrêt est examinée en référé et nécessite de justifier de moyens sérieux de réformation.",
    difficulty: 3,
    topicName: "Procédure civile",
  },
  {
    text: "Un créancier obtient une ordonnance d'injonction de payer pour une créance de 8 000 €. Le débiteur n'a pas formé opposition dans le délai d'un mois. Six mois plus tard, il apprend que le titre est revêtu de la formule exécutoire. Quels recours lui restent-ils ?",
    solutionText: "Passé le délai d'opposition d'un mois (art. 1416 CPC), les recours sont limités : 1) Si la signification est irrégulière (vice de forme ou de fond), le débiteur peut contester la validité de la signification et demander la nullité de l'ordonnance ; 2) Le pourvoi en cassation est ouvert si l'ordonnance est rendue en dernier ressort (créance < 5 000 €), mais ici la créance est de 8 000 €, donc l'appel serait possible s'il était encore dans les délais ; 3) La contestation devant le JEX de la mesure d'exécution forcée (art. L.213-6 COJ) ; 4) En dernier recours, le recours en révision (art. 593 CPC) si une fraude est démontrée.",
    difficulty: 4,
    topicName: "Procédure civile",
  },

  // ── Droit pénal (souvent présent au CRFPA) ───────────────
  {
    text: "Lors d'une garde à vue, l'officier de police judiciaire omet de notifier au gardé à vue son droit de consulter un avocat dans la première heure. L'interrogatoire a lieu sans avocat. Les déclarations obtenues sont-elles recevables ?",
    solutionText: "Non, les déclarations sont susceptibles d'être annulées. Le droit à l'assistance d'un avocat en garde à vue est garanti par les articles 63-3-1 et 63-4 CPP. La notification tardive du droit à l'avocat constitue une violation des droits de la défense (art. 6 §3 CEDH). La chambre de l'instruction peut prononcer la nullité des actes accomplis en méconnaissance de cette garantie (art. 171 CPP), à condition que le grief soit démontré (Cass. crim., 19 sept. 2012). En l'espèce, l'absence totale de notification et l'interrogatoire sans avocat caractérisent un grief suffisant.",
    difficulty: 3,
    topicName: "Procédure pénale",
  },

  // ── Droit des sociétés ───────────────────────────────────
  {
    text: "Le gérant d'une SARL conclut un bail commercial au nom de la société pour un loyer annuel représentant 40% du chiffre d'affaires. Un associé minoritaire estime que cette convention est préjudiciable aux intérêts sociaux. Quels recours sont ouverts ?",
    solutionText: "L'associé peut : 1) Invoquer la procédure des conventions réglementées (art. L.223-19 C. com.) si le gérant est partie au bail (ex : propriétaire des murs) — le commissaire aux comptes ou les associés doivent en être informés ; 2) Exercer l'action sociale ut singuli au nom de la société (art. L.223-22 al. 3) pour faute de gestion ; 3) Si le loyer est excessif, invoquer l'abus de majorité si la décision a été approuvée par l'assemblée au détriment de l'intérêt social (critères : Cass. com., 18 avril 1961) ; 4) En cas de dissimulation, qualifier l'acte de convention interdite (art. L.223-21).",
    difficulty: 4,
    topicName: "Droit des sociétés",
  },
]
