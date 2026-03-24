/**
 * Document exam grading workflow — Type B (CPGE concours-style).
 *
 * 3-step pipeline:
 * 1. Grade each question against model answer + marking scheme (LLM)
 * 2. Generate overall feedback (LLM)
 * 3. Update session with scores (local)
 *
 * Unlike the standard grading workflow which works on GeneratedQuestion rows,
 * this reads/writes JSON fields on PracticeExamSession:
 * - documentAnswers → student answers
 * - documentModelAnswers → model answers + rubrics
 * - documentGrading → per-question grading results
 */
import { db } from '../../db'
import { localStep } from '../orchestrator/steps'
import type { WorkflowDefinition, WorkflowContext } from '../orchestrator/types'
import { streamChat } from '../client'

export interface DocumentGradingConfig {
  sessionId: string
}

interface GradeResult {
  questionNumber: number
  earned: number
  max: number
  feedback: string
}

async function llmMain(prompt: string, system: string, ctx: WorkflowContext, maxTokens = 16384): Promise<string> {
  const response = await streamChat({
    messages: [{ role: 'user', content: prompt }],
    system,
    tools: [],
    maxTokens,
    authToken: ctx.authToken,
    signal: ctx.signal,
  })
  return response.content
    .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
    .map(c => c.text)
    .join('')
}

export function createDocumentExamGradingWorkflow(config: DocumentGradingConfig): WorkflowDefinition<void> {
  return {
    id: 'document-exam-grading',
    name: 'Grade Document Exam',
    steps: [
      // ── Step 1: Grade each question ─────────────────────────────
      {
        id: 'gradeQuestions',
        name: 'Grading your answers',
        async execute(_input: unknown, ctx: WorkflowContext): Promise<Record<number, GradeResult>> {
          const session = await db.practiceExamSessions.get(config.sessionId)
          if (!session) throw new Error('Session not found')

          const answers: Record<number, string> = session.documentAnswers
            ? JSON.parse(session.documentAnswers)
            : {}

          const modelAnswers: Array<{
            questionNumber: number
            modelAnswer: string
            markingScheme?: { fullMarks: number; criteria: Array<{ criterion: string; points: number }>; commonErrors?: Array<{ error: string; deduction: number }> }
          }> = session.documentModelAnswers
            ? JSON.parse(session.documentModelAnswers)
            : []

          if (modelAnswers.length === 0) {
            // No model answers available — give 0 for everything
            const results: Record<number, GradeResult> = {}
            for (const [num] of Object.entries(answers)) {
              results[Number(num)] = { questionNumber: Number(num), earned: 0, max: 0, feedback: 'Model answers not available for grading.' }
            }
            return results
          }

          // Build grading context — only send answered questions to LLM
          const allQuestions = modelAnswers.map(ma => ({
            questionNumber: ma.questionNumber,
            studentAnswer: answers[ma.questionNumber]?.trim() || null,
            modelAnswer: ma.modelAnswer,
            markingScheme: ma.markingScheme,
          }))
          const answeredQuestions = allQuestions.filter(q => q.studentAnswer)
          const unansweredQuestions = allQuestions.filter(q => !q.studentAnswer)

          // Grade unanswered questions locally (0 points, no LLM needed)
          const localResults: Record<number, GradeResult> = {}
          for (const q of unansweredQuestions) {
            localResults[q.questionNumber] = {
              questionNumber: q.questionNumber,
              earned: 0,
              max: q.markingScheme?.fullMarks ?? 0,
              feedback: 'Non répondu.',
            }
          }

          // If no questions were answered, skip LLM entirely
          if (answeredQuestions.length === 0) {
            await db.practiceExamSessions.update(config.sessionId, {
              documentGrading: JSON.stringify(localResults),
            })
            return localResults
          }

          const system = `Tu es un correcteur agrégé de concours CPGE. Tu corriges la copie d'un candidat avec rigueur et bienveillance.

Règles de correction :
- Attribue les points critère par critère selon le barème fourni
- Le crédit partiel est possible : un raisonnement juste avec une erreur de calcul mérite des points
- "Non répondu" = 0 points, pas de pénalité
- Sois précis dans le feedback : indique exactement ce qui manque ou ce qui est faux
- Le feedback doit être en français`

          const prompt = `Corrige les réponses suivantes selon le barème.

${answeredQuestions.map(q => {
  const schemeText = q.markingScheme
    ? `Barème (${q.markingScheme.fullMarks} pts) :\n${q.markingScheme.criteria.map(c => `  - ${c.criterion} : ${c.points} pt(s)`).join('\n')}${q.markingScheme.commonErrors ? `\nErreurs courantes :\n${q.markingScheme.commonErrors.map(e => `  - ${e.error} : -${e.deduction} pt(s)`).join('\n')}` : ''}`
    : 'Barème non disponible'

  return `**Question ${q.questionNumber}**
${schemeText}
Corrigé : ${q.modelAnswer}
Réponse du candidat : ${q.studentAnswer ?? '(Non répondu)'}`
}).join('\n\n---\n\n')}

Retourne UNIQUEMENT un tableau JSON :
[
  {
    "questionNumber": 1,
    "earned": 2,
    "max": 3,
    "feedback": "Explication concise de la note attribuée"
  }
]

Couvre TOUTES les questions, y compris celles non répondues (earned = 0).`

          ctx.updateProgress?.('Grading answers...')
          const raw = await llmMain(prompt, system, ctx, 16384)

          // Parse JSON response
          let grades: GradeResult[] = []
          try {
            const jsonStart = raw.indexOf('[')
            const jsonEnd = raw.lastIndexOf(']')
            if (jsonStart >= 0 && jsonEnd > jsonStart) {
              let jsonStr = raw.slice(jsonStart, jsonEnd + 1)
              try {
                grades = JSON.parse(jsonStr)
              } catch {
                // Try to repair truncated JSON
                const lastBrace = jsonStr.lastIndexOf('}')
                if (lastBrace > 0) {
                  jsonStr = jsonStr.slice(0, lastBrace + 1) + ']'
                  grades = JSON.parse(jsonStr)
                }
              }
            }
          } catch {
            // Fallback: give 0 for all
            grades = modelAnswers.map(ma => ({
              questionNumber: ma.questionNumber,
              earned: 0,
              max: ma.markingScheme?.fullMarks ?? 0,
              feedback: 'Grading failed — please review manually.',
            }))
          }

          // Merge LLM grades with local unanswered grades
          const results: Record<number, GradeResult> = { ...localResults }
          for (const g of grades) {
            results[g.questionNumber] = g
          }

          // Fill in any missing questions from model answers
          for (const ma of modelAnswers) {
            if (!results[ma.questionNumber]) {
              results[ma.questionNumber] = {
                questionNumber: ma.questionNumber,
                earned: 0,
                max: ma.markingScheme?.fullMarks ?? 0,
                feedback: 'Not graded.',
              }
            }
          }

          // Persist immediately
          await db.practiceExamSessions.update(config.sessionId, {
            documentGrading: JSON.stringify(results),
          })

          return results
        },
      },

      // ── Step 2: Generate overall feedback ───────────────────────
      {
        id: 'generateFeedback',
        name: 'Generating performance feedback',
        async execute(_input: unknown, ctx: WorkflowContext): Promise<string> {
          const grading = ctx.results['gradeQuestions'].data as Record<number, GradeResult>
          const grades = Object.values(grading)

          const totalEarned = grades.reduce((s, g) => s + g.earned, 0)
          const totalMax = grades.reduce((s, g) => s + g.max, 0)
          const percentage = totalMax > 0 ? Math.round((totalEarned / totalMax) * 100) : 0
          const answeredCount = grades.filter(g => g.feedback !== 'Non répondu.' && g.earned >= 0).length

          const system = 'Tu es un professeur bienveillant mais honnête. Donne un retour concis en 2-3 phrases en français.'

          const prompt = `Un candidat a obtenu ${totalEarned}/${totalMax} points (${percentage}%) à une épreuve de concours CPGE.
${answeredCount}/${grades.length} questions répondues.

Détail par question :
${grades.map(g => `Q${g.questionNumber}: ${g.earned}/${g.max} — ${g.feedback}`).join('\n')}

Donne un retour global en 2-3 phrases : points forts, points faibles, et un conseil concret pour progresser. Retourne UNIQUEMENT le texte du feedback, pas de JSON.`

          const feedback = await llmMain(prompt, system, ctx, 1024)
          return feedback.trim()
        },
      },

      // ── Step 3: Update session with final scores ────────────────
      localStep('updateSession', 'Finalizing results', async (ctx) => {
        const grading = ctx.results['gradeQuestions'].data as Record<number, GradeResult>
        const feedback = ctx.results['generateFeedback']?.data as string | undefined
        const grades = Object.values(grading)

        const totalScore = grades.reduce((s, g) => s + g.earned, 0)
        const maxScore = grades.reduce((s, g) => s + g.max, 0)

        await db.practiceExamSessions.update(config.sessionId, {
          phase: 'graded',
          totalScore,
          maxScore,
          overallFeedback: feedback ?? undefined,
          completedAt: new Date().toISOString(),
        })

        return { totalScore, maxScore }
      }),
    ],

    async aggregate(): Promise<void> {
      // All work done in steps — nothing left to aggregate
    },
  }
}
