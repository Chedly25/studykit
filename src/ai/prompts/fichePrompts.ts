/**
 * Prompt for generating a fiche de révision — a topic-level revision sheet.
 * One fiche per topic. Structured Markdown+LaTeX.
 */

export interface FichePromptConfig {
  topicName: string
  subjectName: string
  examName: string
  mastery: number  // 0-1
  courseContent: string  // Joined document chunks
  conceptCards: Array<{ title: string; content: string; mastery: number }>
  personalMistakes: string[]
  language: 'fr' | 'en'
}

export function buildFicheGenerationPrompt(config: FichePromptConfig): { system: string; user: string } {
  const isFr = config.language === 'fr'

  const system = isFr
    ? `Tu es un professeur agrégé expert en pédagogie. Tu rédiges des FICHES DE RÉVISION complètes et structurées pour des étudiants préparant ${config.examName}.

Une fiche de révision est un document de 1-2 pages qui synthétise TOUT ce qu'un étudiant doit savoir sur un sujet. C'est ce que les étudiants collent au mur, emportent à la bibliothèque, relisent la veille de l'examen.

## RÈGLES
- Utilise le contenu du cours fourni comme source principale — ne pas inventer des théorèmes ou résultats qui n'y figurent pas
- Si des fiches de concepts existent déjà (ci-dessous), les intégrer et les enrichir
- Les erreurs personnelles de l'étudiant (issues de ses examens blancs) DOIVENT apparaître dans la section "Erreurs fréquentes"
- Format : Markdown avec LaTeX ($..$ et $$..$$)
- Sois concis mais exhaustif — chaque ligne doit être utile
- Pas de bavardage, pas d'introduction, pas de conclusion — que du contenu`

    : `You are an expert teacher writing REVISION SHEETS for students preparing ${config.examName}.

A revision sheet is a 1-2 page document that synthesizes EVERYTHING a student needs to know about a topic. It's what students pin to their wall, carry to the library, reread the night before the exam.

## RULES
- Use the provided course content as the primary source — don't invent theorems or results not present in it
- If concept cards already exist (below), integrate and enrich them
- The student's personal mistakes (from practice exams) MUST appear in the "Common Mistakes" section
- Format: Markdown with LaTeX ($..$ and $$..$$)
- Be concise but exhaustive — every line must be useful
- No filler, no introduction, no conclusion — just content`

  const mistakesBlock = config.personalMistakes.length > 0
    ? `\n${isFr ? 'ERREURS PERSONNELLES (issues de vos examens blancs)' : 'PERSONAL MISTAKES (from your practice exams)'}:\n${config.personalMistakes.map(m => `- ${m}`).join('\n')}`
    : ''

  const cardsBlock = config.conceptCards.length > 0
    ? `\n${isFr ? 'CONCEPTS DÉJÀ TRAVAILLÉS' : 'CONCEPTS ALREADY STUDIED'}:\n${config.conceptCards.map(c => `- ${c.title} (${Math.round(c.mastery * 100)}% ${isFr ? 'maîtrisé' : 'mastered'})`).join('\n')}`
    : ''

  const sections = isFr
    ? `## Définitions
## Théorèmes clés
(énoncé précis avec conditions d'application — utiliser ★ pour les théorèmes les plus importants)
## Démonstrations à connaître
(les étapes clés seulement, pas la preuve complète)
## Méthodes
(comment aborder les exercices types — utiliser → pour chaque méthode)
## Erreurs fréquentes ⚠️
(inclure les erreurs personnelles de l'étudiant ci-dessous${config.personalMistakes.length > 0 ? ' — OBLIGATOIRE' : ''})
## Exercices types
(3-5 exercices classiques avec piste de résolution en 1-2 lignes)`
    : `## Definitions
## Key Theorems
(precise statement with conditions — use ★ for the most important ones)
## Proofs to Know
(key steps only, not full proofs)
## Methods
(how to approach typical exercises — use → for each method)
## Common Mistakes ⚠️
(include the student's personal mistakes below${config.personalMistakes.length > 0 ? ' — MANDATORY' : ''})
## Typical Exercises
(3-5 classic exercises with 1-2 line solution hints)`

  const user = `${isFr ? 'SUJET' : 'TOPIC'}: ${config.topicName} (${config.subjectName})
${isFr ? 'NIVEAU ACTUEL' : 'CURRENT LEVEL'}: ${Math.round(config.mastery * 100)}%

${config.courseContent ? `${isFr ? 'CONTENU DU COURS (extraits)' : 'COURSE CONTENT (excerpts)'}:\n${config.courseContent}\n` : ''}${cardsBlock}${mistakesBlock}

${isFr ? 'Rédige la fiche de révision avec ces sections' : 'Write the revision sheet with these sections'}:
${sections}

${isFr ? 'Commence directement par le titre' : 'Start directly with the title'}: # ${config.topicName}`

  return { system, user }
}
