/**
 * CPGE MP/MP* seed data — complete programme officiel.
 * Creates a fully populated profile with all subjects, chapters, and topics
 * for the 2-year CPGE scientific track (filière MP).
 *
 * Usage: import { seedCPGE_MP } from './cpgeMP'; await seedCPGE_MP(db);
 */
import { db } from '..'
import type { ExamProfile, Subject, Chapter, Topic, TutorPreferences, StudentModel } from '../schema'

const PROFILE_ID = 'cpge-mp-seed'
const TODAY = () => new Date().toISOString().slice(0, 10)
const NOW = () => new Date().toISOString()

const COLORS = ['#7A1F2B', '#5B4A82', '#3B5879', '#A66A2C', '#4F6B3F', '#7B3F5C', '#3F5B47', '#4A4A55', '#A04D58', '#6B6759']

// ─── Programme officiel CPGE MP ──────────────────────────────

interface SeedChapter {
  name: string
  topics: string[]
}

interface SeedSubject {
  name: string
  weight: number
  color: string
  chapters: SeedChapter[]
}

export const SUBJECTS: SeedSubject[] = [
  {
    name: 'Mathématiques',
    weight: 35,
    color: COLORS[0],
    chapters: [
      {
        name: 'Algèbre linéaire',
        topics: [
          'Espaces vectoriels et sous-espaces',
          'Applications linéaires et matrices',
          'Déterminants',
          'Réduction des endomorphismes (diagonalisation)',
          'Trigonalisation et théorème de Cayley-Hamilton',
          'Espaces préhilbertiens et projection orthogonale',
          'Endomorphismes symétriques et théorème spectral',
          'Formes bilinéaires et formes quadratiques',
          'Dualité',
        ],
      },
      {
        name: 'Analyse',
        topics: [
          'Suites et séries numériques',
          'Séries de fonctions et convergence uniforme',
          'Séries entières et rayon de convergence',
          'Séries de Fourier',
          'Intégrales à paramètre',
          'Intégrales généralisées (convergence, calcul)',
          'Fonctions de plusieurs variables (continuité, différentiabilité)',
          'Calcul différentiel et extrema',
          'Équations différentielles linéaires',
          'Équations différentielles non linéaires et Cauchy-Lipschitz',
          'Topologie des espaces métriques (ouverts, fermés, compacité)',
          'Espaces vectoriels normés et applications continues',
          'Théorème du point fixe',
        ],
      },
      {
        name: 'Probabilités',
        topics: [
          'Espaces probabilisés et événements',
          'Variables aléatoires discrètes',
          'Variables aléatoires à densité',
          'Espérance, variance, moments',
          'Couples de variables aléatoires',
          'Convergences et loi des grands nombres',
          'Fonctions génératrices',
        ],
      },
      {
        name: 'Algèbre générale',
        topics: [
          'Groupes (définition, morphismes, sous-groupes)',
          'Anneaux et corps',
          'Polynômes et fractions rationnelles',
          'Arithmétique dans Z',
        ],
      },
    ],
  },
  {
    name: 'Physique',
    weight: 25,
    color: COLORS[1],
    chapters: [
      {
        name: 'Mécanique',
        topics: [
          'Cinématique du point et du solide',
          'Dynamique newtonienne',
          'Mécanique du solide (moment cinétique, énergie)',
          'Mécanique des fluides (statique et dynamique)',
          'Mécanique analytique (Lagrangien)',
        ],
      },
      {
        name: 'Thermodynamique',
        topics: [
          'Premier principe et bilans énergétiques',
          'Second principe et entropie',
          'Machines thermiques et cycles',
          'Transitions de phase et diagrammes',
          'Diffusion thermique',
        ],
      },
      {
        name: 'Électromagnétisme',
        topics: [
          'Électrostatique (champ E, potentiel, Gauss)',
          'Magnétostatique (champ B, Ampère)',
          'Équations de Maxwell',
          'Ondes électromagnétiques dans le vide',
          'Ondes dans les milieux (réflexion, transmission)',
          'Rayonnement dipolaire',
        ],
      },
      {
        name: 'Optique',
        topics: [
          'Optique géométrique (lentilles, miroirs)',
          'Interférences (Young, Michelson)',
          'Diffraction (Fraunhofer)',
        ],
      },
      {
        name: 'Électronique et signaux',
        topics: [
          'Circuits linéaires (régime sinusoïdal, filtres)',
          'Amplificateur opérationnel',
          'Conversion analogique-numérique',
          'Analyse de Fourier des signaux',
        ],
      },
      {
        name: 'Physique quantique',
        topics: [
          'Fonction d\'onde et équation de Schrödinger',
          'Puits de potentiel et effet tunnel',
          'Oscillateur harmonique quantique',
          'Atome d\'hydrogène',
        ],
      },
    ],
  },
  {
    name: 'Chimie',
    weight: 10,
    color: COLORS[2],
    chapters: [
      {
        name: 'Chimie des solutions',
        topics: [
          'Équilibres acido-basiques',
          'Équilibres de complexation',
          'Équilibres de précipitation',
          'Oxydoréduction et piles',
          'Diagrammes potentiel-pH (Pourbaix)',
        ],
      },
      {
        name: 'Chimie organique',
        topics: [
          'Stéréochimie et isomérie',
          'Mécanismes réactionnels (SN, E, addition)',
          'Réactions en chimie organique',
        ],
      },
      {
        name: 'Thermodynamique chimique',
        topics: [
          'Enthalpie et loi de Hess',
          'Cinétique chimique (ordres, mécanismes)',
        ],
      },
    ],
  },
  {
    name: 'Informatique',
    weight: 15,
    color: COLORS[3],
    chapters: [
      {
        name: 'Algorithmique',
        topics: [
          'Complexité algorithmique',
          'Algorithmes de tri',
          'Récursivité et programmation dynamique',
          'Algorithmes sur les graphes (BFS, DFS, Dijkstra)',
          'Diviser pour régner',
        ],
      },
      {
        name: 'Structures de données',
        topics: [
          'Listes, piles, files',
          'Arbres binaires et arbres binaires de recherche',
          'Tables de hachage',
          'Graphes (représentation, parcours)',
        ],
      },
      {
        name: 'Programmation',
        topics: [
          'Programmation en Python (types, fonctions, modules)',
          'Programmation en OCaml (types, pattern matching)',
          'Bases de données et SQL',
          'Logique propositionnelle et prédicats',
        ],
      },
    ],
  },
  {
    name: 'Sciences de l\'Ingénieur',
    weight: 10,
    color: COLORS[4],
    chapters: [
      {
        name: 'Modélisation des systèmes',
        topics: [
          'Modélisation cinématique des mécanismes',
          'Modélisation des actions mécaniques (statique)',
          'Modélisation dynamique et PFD appliqué',
          'Modélisation des systèmes asservis',
        ],
      },
      {
        name: 'Automatique',
        topics: [
          'Systèmes linéaires continus (fonction de transfert)',
          'Réponse fréquentielle (Bode, Nyquist)',
          'Stabilité et marges de stabilité',
          'Correcteurs (P, PI, PID)',
        ],
      },
      {
        name: 'Conception et dimensionnement',
        topics: [
          'Résistance des matériaux (traction, flexion, torsion)',
          'Chaîne d\'énergie et rendement',
          'Chaîne d\'information et capteurs',
        ],
      },
    ],
  },
  {
    name: 'Français / Philosophie',
    weight: 5,
    color: COLORS[5],
    chapters: [
      {
        name: 'Thème annuel',
        topics: [
          'Dissertation sur le thème de l\'année',
          'Résumé de texte',
          'Analyse d\'œuvres au programme',
        ],
      },
    ],
  },
]

// ─── Seed Function ───────────────────────────────────────────

/**
 * Seed a complete CPGE MP profile into IndexedDB.
 * Idempotent — deletes existing seed profile first if present.
 * If no userId is passed, it auto-detects from the Clerk session in the DOM.
 */
export async function seedCPGE_MP(userId?: string): Promise<string> {
  // Clean up previous seed if it exists
  const existing = await db.examProfiles.get(PROFILE_ID)
  if (existing) {
    // Delete all associated data
    await Promise.all([
      db.subjects.where('examProfileId').equals(PROFILE_ID).delete(),
      db.chapters.where('examProfileId').equals(PROFILE_ID).delete(),
      db.topics.where('examProfileId').equals(PROFILE_ID).delete(),
      db.tutorPreferences.where('examProfileId').equals(PROFILE_ID).delete(),
      db.studentModels.where('examProfileId').equals(PROFILE_ID).delete(),
    ])
    await db.examProfiles.delete(PROFILE_ID)
  }

  const now = NOW()
  const today = TODAY()

  // Exam date: ~3 months from now (concours are in April-May)
  const examDate = new Date()
  examDate.setMonth(examDate.getMonth() + 3)
  const examDateStr = examDate.toISOString().slice(0, 10)

  // Auto-detect userId from Clerk if not provided
  const effectiveUserId = userId
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ?? (window as any).__clerk_frontend_api?.session?.userId
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ?? (window as any).Clerk?.user?.id
    ?? 'local'

  // ── Profile ──
  const profile: ExamProfile = {
    id: PROFILE_ID,
    name: 'Concours CPGE MP — Mines-Ponts',
    examType: 'professional-exam',
    examDate: examDateStr,
    isActive: true,
    passingThreshold: 70,
    weeklyTargetHours: 25,
    createdAt: now,
    userId: effectiveUserId,
    profileMode: 'study',
  }

  // ── Subjects, Chapters, Topics ──
  const subjects: Subject[] = []
  const chapters: Chapter[] = []
  const topics: Topic[] = []

  for (let si = 0; si < SUBJECTS.length; si++) {
    const seed = SUBJECTS[si]
    const subjectId = `${PROFILE_ID}:s${si}`

    subjects.push({
      id: subjectId,
      examProfileId: PROFILE_ID,
      name: seed.name,
      weight: seed.weight,
      mastery: 0,
      color: seed.color,
      order: si,
    })

    for (let ci = 0; ci < seed.chapters.length; ci++) {
      const ch = seed.chapters[ci]
      const chapterId = `${PROFILE_ID}:s${si}:c${ci}`

      chapters.push({
        id: chapterId,
        subjectId,
        examProfileId: PROFILE_ID,
        name: ch.name,
        order: ci,
      })

      for (let ti = 0; ti < ch.topics.length; ti++) {
        topics.push({
          id: `${PROFILE_ID}:s${si}:c${ci}:t${ti}`,
          subjectId,
          examProfileId: PROFILE_ID,
          chapterId,
          name: ch.topics[ti],
          mastery: 0,
          confidence: 0,
          questionsAttempted: 0,
          questionsCorrect: 0,
          easeFactor: 2.5,
          interval: 0,
          repetitions: 0,
          nextReviewDate: today,
        })
      }
    }
  }

  // ── Tutor Preferences ──
  const tutorPrefs: TutorPreferences = {
    id: `${PROFILE_ID}:tutor`,
    examProfileId: PROFILE_ID,
    teachingStyle: 'detailed',
    explanationApproach: 'step-by-step',
    feedbackTone: 'encouraging',
    languageLevel: 'expert',
  }

  // ── Student Model ──
  const studentModel: StudentModel = {
    id: `${PROFILE_ID}:model`,
    examProfileId: PROFILE_ID,
    learningStyle: JSON.stringify({ visual: true, formal: true }),
    commonMistakes: JSON.stringify([
      'Oubli de vérifier les hypothèses avant d\'appliquer un théorème',
      'Confusion entre convergence simple et uniforme',
      'Erreurs de signe dans les calculs d\'intégrales',
    ]),
    personalityNotes: JSON.stringify([
      'Étudiant en MP*, prépare Mines-Ponts et Centrale',
      'Bon niveau en algèbre, plus faible en analyse et probabilités',
      'Préfère les explications rigoureuses avec preuves complètes',
    ]),
    preferredExplanations: JSON.stringify([
      'Démonstrations détaillées avec chaque étape justifiée',
      'Exemples concrets avant la théorie abstraite',
      'Liens entre chapitres différents',
    ]),
    motivationTriggers: JSON.stringify([
      'Progression visible sur les sujets de concours',
      'Résolution de problèmes difficiles',
    ]),
    updatedAt: now,
  }

  // ── Write to DB ──
  await db.transaction('rw',
    [db.examProfiles, db.subjects, db.chapters, db.topics, db.tutorPreferences, db.studentModels],
    async () => {
      await db.examProfiles.put(profile)
      await db.subjects.bulkPut(subjects)
      await db.chapters.bulkPut(chapters)
      await db.topics.bulkPut(topics)
      await db.tutorPreferences.put(tutorPrefs)
      await db.studentModels.put(studentModel)
    }
  )

  // ── Seed Documents + Chunks ──
  await seedDocuments(PROFILE_ID, now)

  return PROFILE_ID
}

// ─── Document Seed Data ──────────────────────────────────────

interface SeedDoc {
  title: string
  category: 'course' | 'exam'
  content: string
}

const SEED_DOCUMENTS: SeedDoc[] = [
  {
    title: 'Précis de Mécanique — CPGE MP',
    category: 'course',
    content: `Chapitre 1 — Mécanique

1.1 Rappels de mécanique du point

1.1.1 Référentiel galiléen
Un référentiel est galiléen s'il vérifie le principe d'inertie. Tout référentiel en translation rectiligne uniforme par rapport à un référentiel galiléen est aussi galiléen.

Référentiel de Copernic : A pour origine le centre de masse du système solaire et ses axes sont dirigés vers des étoiles très éloignées. Très bon galiléen.

Référentiel héliocentrique : Le centre de masse du système solaire est confondu avec le centre du soleil (qui représente 99% de la masse, tout de même).

Référentiel terrestre : Mêmes axes mais centré sur la terre. Or la terre est en translation elliptique dans le référentiel de Copernic. Cependant, les accélérations sont faibles étant donné la période de révolution. C'est donc un bon galiléen.

1.1.2 Principe fondamental de la dynamique
On note p = mv la quantité de mouvement ou impulsion d'une masse ponctuelle M(m).
dp/dt = F où F est la résultante des forces appliquées en M.

1.1.3 Théorème du moment cinétique
On note L_O = OM ∧ p le moment cinétique en O du point M et M_O = OM ∧ F le moment en O de la résultante des forces appliquées en M. A condition que O soit fixe dans le référentiel, on dispose du théorème du moment cinétique :
dL_O/dt = M_O

1.1.4 Référentiel non galiléen
Soit R2 un référentiel en mouvement quelconque par rapport à R1.
(dA/dt)_R2 = (dA/dt)_R1 + ω_{R1/R2} ∧ A

On en déduit la loi de composition des vitesses d'un point M :
v(M)_{R1} = v(M)_{R2} + v_e

La loi de composition des accélérations s'écrit :
a(M)_{R1} = a(M)_{R2} + a_e + a_c

où a_e et a_c sont les accélérations respectivement d'entraînement et de Coriolis :
a_c = 2ω_{R2/R1} ∧ v(M)_{R2}

Il ne faut pas oublier les forces d'inertie d'entraînement et de Coriolis quand on applique le PFD ou le TMC dans un référentiel non galiléen.

1.2 Étude énergétique

1.2.1 Travail, puissance, énergie cinétique
Le travail élémentaire et la puissance d'une force sont δW = F · dr et P = F · v.
L'énergie cinétique d'une masse m est donnée par Ec = ½mv².

1.2.2 Théorème de la puissance cinétique
dEc/dt = P_int + P_ext

1.2.3 Énergie potentielle
Une force F dérive du potentiel Ep si elle est à circulation conservative. δW = F · dOM = -dEp et F = -grad(Ep).

1.2.4 Énergie mécanique
L'énergie mécanique est définie par Em = Ec + Ep. Le théorème de l'énergie mécanique affirme qu'une variation de l'énergie mécanique est due au travail des forces non conservatives.

1.3 Forces centrales conservatives
Une force centrale est de la forme F(r) = f(r)u_r. On s'intéresse tout particulièrement à une force coulombienne : F = -grad(k/r).
Les conséquences sont nombreuses : dL/dt = 0, L = mr²θ' = mC.
Le mouvement est plan car OM et v sont orthogonaux à L_O. C est la constante des aires ou deuxième loi de Kepler.

1.4 Mécanique du solide

1.4.1 Propriétés des solides
Torseur cinétique : p_S = Σp_i = ∫∫∫_S v(M)dm et L_A(S) = Σ L_A(M_i)

1.4.2 Formule fondamentale de la cinématique du solide
v(B ∈ S) = v(A ∈ S) + BA ∧ Ω_S

1.4.6 Moment d'inertie
Le moment cinétique du solide en rotation à vitesse angulaire ω est L_Δ = J_Δ ω.
Moments d'inertie classiques : Cylindre creux mR², Cylindre plein ½mR², Boule ⅖mR², Tige ⅓ml².

1.4.7 Théorème de Huyghens
J_{Δ',A} = J_{Δ,G} + m(AG)²`,
  },
  {
    title: 'Cours d\'Électromagnétisme — CPGE MP',
    category: 'course',
    content: `Chapitre 2 — Électromagnétisme

2.1 Analyse vectorielle

2.1.1 Flux, circulation d'un champ
Φ = ∫∫_S W · dS (flux d'un champ vectoriel à travers une surface)
C = ∫_Γ W · dl (circulation d'un champ vectoriel le long d'une courbe)

2.1.2 Gradient
df = grad(f) · dl
∫_A^B grad(f) · dl = f(B) - f(A)
Un champ W est à circulation conservative si il dérive d'un champ scalaire (ou potentiel) : W = -grad(f).

2.1.3 Divergent
Formule d'Ostrogradsky : ∫∫∫_V div(W)dV = ∮∮_S W · dS
Les champs de divergence nulle sont donc à flux conservatif.

2.1.4 Rotationnel
Formule de Stokes : ∫∫_S rot(W) · dS = ∮_Γ W · dl
Les champs de rotationnel nul sont à circulation conservative.

2.2 Les sources du champ électromagnétique
Ce sont les charges électriques, fixes (distribution de charges) ou mobiles (distribution de courants). La charge électrique est quantifiée (multiple entier de e), et se mesure en Coulombs.

2.2.1 Densité de charge
Densité volumique : dq = ρdτ ; surfacique : dq = σdS ; linéique : dq = λdl.

2.2.2 Densité de courant
j = ρ_m × v (vecteur densité de courant)

2.2.3 Conservation de la charge
div(j) + ∂ρ/∂t = 0 (équation de continuité)

2.3 Équations de Maxwell dans le vide
Maxwell-Thomson : div(B) = 0
Maxwell-Gauss : div(E) = ρ/ε₀
Maxwell-Faraday : rot(E) = -∂B/∂t
Maxwell-Ampère : rot(B) = μ₀(j + j_D) avec j_D = ε₀∂E/∂t

Les équations de Maxwell sont linéaires : le principe de superposition s'applique.

2.4 Relations de passage
Lors de la traversée d'une surface S de densité de charge σ ou de densité de courants surfaciques j_S :
E₂ - E₁ = σ/ε₀ × n (composante normale)
B₂ - B₁ = μ₀j_S ∧ n (composante tangentielle)

2.5 Force de Lorentz
Une particule de charge q soumise à un champ électromagnétique (E, B) subit une force de Lorentz : F = q(E + v ∧ B)

2.7 Électrostatique

2.7.1 Théorème de Gauss
∮∮_S E · dS = Q_int/ε₀

2.7.2 Équation de Poisson et solution
ΔV + ρ/ε₀ = 0
V(M) = 1/(4πε₀) ∫∫∫ ρ(P)/(PM) dτ

Loi de Coulomb : E(M) = 1/(4πε₀) ∫∫∫ ρ(P)PM/(PM³) dτ
Cas particulier d'une charge q à l'origine : V(M) = q/(4πε₀r) et E(M) = q/(4πε₀r²) u_r

2.8 Magnétostatique
Théorème d'Ampère : ∮ B · dl = μ₀ I_enlacé
Champ créé par un fil infini : B = μ₀I/(2πr) u_θ`,
  },
  {
    title: 'Chimie des Solutions Aqueuses — Oxydoréduction',
    category: 'course',
    content: `Réactions d'oxydoréduction en solution aqueuse : aspect thermodynamique

I. RAPPELS SUR LES RÉACTIONS D'OXYDORÉDUCTION

1. Réactions d'oxydoréduction
Définitions :
- Oxydo-réduction = échange d'électrons entre espèces chimiques
- Oxydant = capteur d'électrons
- Réducteur = donneur d'électrons
- Oxydation = perte d'électrons
- Réduction = gain d'électrons
- Couple redox = ensemble de deux espèces chimiques contenant un élément commun, tel que l'une soit oxydante et l'autre réductrice
- ox + n.e⁻ ⇌ red

Amphotère redox = espèce chimique à la fois oxydante et réductrice (dismutation / amphotérisation)

2. Nombres d'oxydation
Le nombre d'oxydation (N.O.) d'un élément dans une espèce chimique est le nombre algébrique d'électrons cédés par un atome pour passer de l'état neutre à l'état de l'atome dans l'espèce chimique considérée.

Règles de calcul :
- Si l'élément est sous forme d'atome : N.O. = 0
- Si l'élément est sous forme d'ion simple : N.O. = nombre de charges de l'ion
- N.O.(H lié) = +I ; N.O.(O lié) = -II

II. CELLULES ÉLECTROCHIMIQUES

1. Demi-pile et électrode
Une demi-pile est un système physicochimique siège d'une demi-réaction redox.
- Anode = électrode correspondant au compartiment où se produit une oxydation
- Cathode = électrode correspondant au compartiment où se produit une réduction
- Cellule électrochimique = association de deux demi-piles reliées par une jonction électrolytique

2. Potentiel d'électrode, potentiel redox
E(ox/red) = V_métal - V_solution
Si ε est la fem de la pile constituée d'une électrode standard à hydrogène (ESH) et de l'électrode étudiée, alors ε = E(ox/red)

III. ÉTUDE THERMODYNAMIQUE DES RÉACTIONS REDOX

Formule de Nernst : E_i = E°_i + (RT)/(n_i F) ln(a_ox/a_red) = E°_i + 0.059/n_i log(a_ox/a_red)

ΔrG = -n₁n₂F·ε et ΔrG° = -n₁n₂F·ε°`,
  },
  {
    title: 'Algorithmique et Structures de Données — CPGE MP',
    category: 'course',
    content: `Cours d'Informatique MP — Algorithmique

1. Complexité algorithmique
La complexité d'un algorithme mesure les ressources (temps, mémoire) nécessaires à son exécution en fonction de la taille n de l'entrée.

Notations asymptotiques :
- O(f(n)) : borne supérieure asymptotique (worst case)
- Ω(f(n)) : borne inférieure asymptotique (best case)
- Θ(f(n)) : encadrement asymptotique (average case)

Complexités classiques : O(1) constante, O(log n) logarithmique, O(n) linéaire, O(n log n) quasi-linéaire, O(n²) quadratique, O(2ⁿ) exponentielle.

2. Algorithmes de tri
Tri par insertion : O(n²) en moyenne et au pire, O(n) au meilleur. Stable, en place.
Tri par sélection : O(n²) dans tous les cas. En place mais non stable.
Tri fusion (merge sort) : O(n log n) dans tous les cas. Stable mais non en place (O(n) mémoire).
Tri rapide (quicksort) : O(n log n) en moyenne, O(n²) au pire. En place, non stable.

Théorème : Tout algorithme de tri par comparaison a une complexité au pire en Ω(n log n).

3. Récursivité et programmation dynamique
Un algorithme récursif est un algorithme qui s'appelle lui-même. La récursivité est l'analogue algorithmique de la récurrence en mathématiques.

Programmation dynamique : technique d'optimisation pour les problèmes avec sous-structure optimale et chevauchement des sous-problèmes. On mémorise les résultats des sous-problèmes pour éviter les recalculs.

Exemples classiques :
- Suite de Fibonacci : passage de O(2ⁿ) récursif naïf à O(n) avec mémoïsation
- Plus longue sous-suite commune (LCS) : O(nm) par programmation dynamique
- Problème du sac à dos : O(nW) pseudo-polynomial

4. Algorithmes sur les graphes
Un graphe G = (V, E) est un ensemble de sommets V et d'arêtes E.

Parcours en largeur (BFS) : explore les sommets par distance croissante à la source. Utilise une file (FIFO). Complexité O(|V| + |E|). Calcule les plus courts chemins en nombre d'arêtes.

Parcours en profondeur (DFS) : explore un chemin aussi loin que possible avant de revenir en arrière. Utilise une pile (LIFO) ou la récursion. Complexité O(|V| + |E|). Détecte les cycles, calcule les composantes connexes.

Algorithme de Dijkstra : plus courts chemins depuis une source avec poids positifs. Complexité O((|V| + |E|) log |V|) avec un tas binaire.

5. Structures de données
Listes chaînées : insertion/suppression en O(1), accès en O(n).
Piles (LIFO) : push/pop en O(1). Applications : évaluation d'expressions, parcours DFS.
Files (FIFO) : enqueue/dequeue en O(1). Applications : BFS, gestion de tâches.
Arbres binaires de recherche : insertion/recherche/suppression en O(h) où h est la hauteur.
Tables de hachage : insertion/recherche en O(1) amorti, O(n) au pire.

6. Bases de données et SQL
Modèle relationnel : données organisées en tables (relations) avec des attributs (colonnes) et des tuples (lignes).
Clé primaire : identifiant unique d'un tuple.
Clé étrangère : référence vers la clé primaire d'une autre table.

Requêtes SQL essentielles :
SELECT colonnes FROM table WHERE condition
JOIN : INNER JOIN, LEFT JOIN, RIGHT JOIN
GROUP BY + fonctions d'agrégation (COUNT, SUM, AVG, MIN, MAX)
ORDER BY, LIMIT, DISTINCT
Sous-requêtes et requêtes imbriquées`,
  },
  {
    title: 'Mines-Ponts 2025 — Mathématiques 1 MP',
    category: 'exam',
    content: `Concours Mines-Ponts 2025 — Épreuve de Mathématiques 1 — Filière MP
Durée : 3 heures

Ce sujet est un sujet de concours officiel. Il teste les connaissances en analyse et algèbre du programme de MP. Les candidats doivent traiter toutes les parties. La qualité de la rédaction et la rigueur des démonstrations sont prises en compte dans l'évaluation.

Note : Ce document est un placeholder pour le sujet complet. Le PDF original est disponible dans corrections/sujets-mines-ponts-mp/2025-maths-mp-1.pdf.`,
  },
  {
    title: 'Mines-Ponts 2024 — Mathématiques 1 MP',
    category: 'exam',
    content: `Concours Mines-Ponts 2024 — Épreuve de Mathématiques 1 — Filière MP
Durée : 3 heures

Sujet de concours officiel Mines-Ponts 2024. Le PDF original est disponible dans corrections/sujets-mines-ponts-mp/2024-maths-mp-1.pdf.`,
  },
]

async function seedDocuments(profileId: string, now: string) {
  const { chunkText, computeKeywords } = await import('../../lib/sources')

  const documents: import('../schema').Document[] = []
  const chunks: import('../schema').DocumentChunk[] = []

  for (let di = 0; di < SEED_DOCUMENTS.length; di++) {
    const doc = SEED_DOCUMENTS[di]
    const docId = `${profileId}:doc${di}`
    const textChunks = chunkText(doc.content, 400)

    documents.push({
      id: docId,
      examProfileId: profileId,
      title: doc.title,
      sourceType: 'text',
      category: doc.category,
      originalContent: doc.content,
      chunkCount: textChunks.length,
      wordCount: doc.content.split(/\s+/).length,
      createdAt: now,
    })

    for (let ci = 0; ci < textChunks.length; ci++) {
      chunks.push({
        id: `${docId}:chunk${ci}`,
        documentId: docId,
        examProfileId: profileId,
        content: textChunks[ci],
        chunkIndex: ci,
        keywords: computeKeywords(textChunks[ci]),
      })
    }
  }

  await db.documents.bulkPut(documents)
  await db.documentChunks.bulkPut(chunks)
}

/** Quick stats about the seeded data */
export function getCPGE_MP_Stats() {
  let totalTopics = 0
  for (const s of SUBJECTS) {
    for (const c of s.chapters) {
      totalTopics += c.topics.length
    }
  }
  return {
    subjects: SUBJECTS.length,
    chapters: SUBJECTS.reduce((sum, s) => sum + s.chapters.length, 0),
    topics: totalTopics,
    subjectNames: SUBJECTS.map(s => s.name),
  }
}
