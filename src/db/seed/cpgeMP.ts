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

const COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ef4444', '#14b8a6']

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

const SUBJECTS: SeedSubject[] = [
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
    languageLevel: 'advanced',
    language: 'fr',
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

  return PROFILE_ID
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
