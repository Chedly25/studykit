/**
 * Note de synthèse grading workflow — 3 steps:
 * 1. Grade synthesis against rubric + model answer (LLM)
 * 2. Generate overall feedback (LLM)
 * 3. Update session with scores (local)
 */
import { db } from '../../db'
import { localStep } from '../orchestrator/steps'
import type { WorkflowDefinition, WorkflowContext } from '../orchestrator/types'
import { streamChat } from '../client'
import type { SynthesisRubric, DossierDocument } from '../prompts/synthesePrompts'

export interface SyntheseGradingConfig {
  sessionId: string
}

interface SynthesisGradeResult {
  criterionScores: Array<{
    criterion: string
    earned: number
    max: number
    comment: string
  }>
  documentsCited: number[]
  documentsMissed: number[]
  totalEarned: number
  totalMax: number
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

export function createSyntheseGradingWorkflow(config: SyntheseGradingConfig): WorkflowDefinition<void> {
  return {
    id: 'synthesis-grading',
    name: 'Grade Note de Synthèse',
    steps: [
      // ── Step 1: Grade synthesis ─────────────────────────────────
      {
        id: 'gradeSynthesis',
        name: 'Grading your synthesis',
        async execute(_input: unknown, ctx: WorkflowContext): Promise<SynthesisGradeResult> {
          const session = await db.practiceExamSessions.get(config.sessionId)
          if (!session) throw new Error('Session not found')

          const studentAnswer = session.synthesisAnswer ?? ''
          const modelAnswer = session.synthesisModelAnswer ?? ''
          let rubric: SynthesisRubric
          try {
            rubric = JSON.parse(session.synthesisRubric ?? '{}')
          } catch {
            rubric = { criteria: [], totalPoints: 20, documentCoverageMap: {} }
          }

          let documents: DossierDocument[] = []
          try {
            documents = JSON.parse(session.dossierContent ?? '[]')
          } catch { /* ignore */ }

          if (!studentAnswer.trim()) {
            // No answer submitted
            const result: SynthesisGradeResult = {
              criterionScores: rubric.criteria.map(c => ({
                criterion: c.criterion,
                earned: 0,
                max: c.points,
                comment: 'Non répondu.',
              })),
              documentsCited: [],
              documentsMissed: documents.map(d => d.docNumber),
              totalEarned: 0,
              totalMax: rubric.criteria.reduce((s, c) => s + c.points, 0),
            }
            await db.practiceExamSessions.update(config.sessionId, {
              synthesisGrading: JSON.stringify(result),
            })
            return result
          }

          const isSynthesis = session.examMode === 'synthesis'

          const system = isSynthesis
            ? `Tu es un correcteur agrégé de l'épreuve de note de synthèse CRFPA. Tu corriges la copie d'un candidat avec rigueur et bienveillance.

Évalue la note de synthèse du candidat selon chaque critère du barème. Sois précis dans tes commentaires : indique ce qui est bien fait et ce qui manque.

Vérifie quels documents du dossier sont cités (notation "(Doc. N)" ou "document N") et lesquels sont manquants.`
            : `Tu es un correcteur agrégé de l'épreuve de cas pratique / consultation juridique CRFPA. Tu corriges la copie d'un candidat avec rigueur et bienveillance.

Évalue la consultation du candidat selon chaque critère du barème. Sois précis dans tes commentaires : indique ce qui est bien fait et ce qui manque.

Vérifie la qualité du syllogisme juridique (majeure, mineure, conclusion) pour chaque problème identifié.`

          const rubricText = rubric.criteria.map(c =>
            `- ${c.criterion} (${c.points} pts)${c.details ? ` — ${c.details}` : ''}`
          ).join('\n')

          const docsSection = isSynthesis && documents.length > 0
            ? `\n## DOCUMENTS DU DOSSIER\n${documents.map(d => `Doc ${d.docNumber}: ${d.title}`).join('\n')}\n`
            : ''

          const docsCitedInstruction = isSynthesis
            ? `\n  "documentsCited": [1, 3, 5, 7],\n  "documentsMissed": [2, 4, 6]`
            : `\n  "documentsCited": [],\n  "documentsMissed": []`

          const prompt = `## BARÈME
${rubricText}
Total : ${rubric.criteria.reduce((s, c) => s + c.points, 0)} points
${docsSection}
## ${isSynthesis ? 'SYNTHÈSE' : 'CONSULTATION'} MODÈLE (pour référence)
${modelAnswer}

## COPIE DU CANDIDAT
${studentAnswer}

## CONSIGNE
Corrige selon le barème. Retourne UNIQUEMENT le JSON :
{
  "criterionScores": [
    { "criterion": "Nom du critère", "earned": 3, "max": 4, "comment": "Explication" }
  ],${docsCitedInstruction}
}`

          ctx.updateProgress?.('Grading synthesis...')
          const raw = await llmMain(prompt, system, ctx, 8192)

          let gradeResult: SynthesisGradeResult
          try {
            const jsonStart = raw.indexOf('{')
            const jsonEnd = raw.lastIndexOf('}')
            if (jsonStart < 0 || jsonEnd < jsonStart) throw new Error('No JSON found')
            let jsonStr = raw.slice(jsonStart, jsonEnd + 1)
            let parsed: Record<string, unknown>
            try {
              parsed = JSON.parse(jsonStr)
            } catch {
              // Try to repair truncated JSON
              const lastBrace = jsonStr.lastIndexOf('}', jsonStr.length - 2)
              if (lastBrace > 0) {
                jsonStr = jsonStr.slice(0, lastBrace + 1) + '}'
                parsed = JSON.parse(jsonStr)
              } else {
                throw new Error('JSON parse failed')
              }
            }
            const totalEarned = (parsed.criterionScores ?? []).reduce(
              (s: number, c: { earned: number }) => s + c.earned, 0
            )
            const totalMax = rubric.criteria.reduce((s, c) => s + c.points, 0)
            gradeResult = { ...parsed, totalEarned, totalMax }
          } catch {
            gradeResult = {
              criterionScores: rubric.criteria.map(c => ({
                criterion: c.criterion,
                earned: 0,
                max: c.points,
                comment: 'Correction automatique échouée.',
              })),
              documentsCited: [],
              documentsMissed: documents.map(d => d.docNumber),
              totalEarned: 0,
              totalMax: rubric.criteria.reduce((s, c) => s + c.points, 0),
            }
          }

          await db.practiceExamSessions.update(config.sessionId, {
            synthesisGrading: JSON.stringify(gradeResult),
          })

          return gradeResult
        },
      },

      // ── Step 2: Generate overall feedback ───────────────────────
      {
        id: 'generateFeedback',
        name: 'Generating feedback',
        async execute(_input: unknown, ctx: WorkflowContext): Promise<string> {
          const grading = ctx.results['gradeSynthesis'].data as SynthesisGradeResult

          const percentage = grading.totalMax > 0
            ? Math.round((grading.totalEarned / grading.totalMax) * 100)
            : 0

          const system = 'Tu es un professeur de droit bienveillant mais honnête. Donne un retour concis en français.'

          const prompt = `Un candidat a obtenu ${grading.totalEarned}/${grading.totalMax} (${percentage}%) à l'épreuve de note de synthèse CRFPA.

Détail :
${grading.criterionScores.map(c => `- ${c.criterion}: ${c.earned}/${c.max} — ${c.comment}`).join('\n')}

Documents cités : ${grading.documentsCited.length > 0 ? grading.documentsCited.join(', ') : 'aucun'}
Documents manquants : ${grading.documentsMissed.length > 0 ? grading.documentsMissed.join(', ') : 'aucun'}

Donne un retour global en 3-4 phrases : points forts, points faibles, et un conseil concret. Retourne UNIQUEMENT le texte.`

          const feedback = await llmMain(prompt, system, ctx, 1024)
          return feedback.trim()
        },
      },

      // ── Step 3: Update session ──────────────────────────────────
      localStep('updateSession', 'Finalizing results', async (ctx) => {
        const grading = ctx.results['gradeSynthesis'].data as SynthesisGradeResult
        const feedback = ctx.results['generateFeedback']?.data as string | undefined

        await db.practiceExamSessions.update(config.sessionId, {
          phase: 'graded',
          totalScore: grading.totalEarned,
          maxScore: grading.totalMax,
          overallFeedback: feedback ?? undefined,
          completedAt: new Date().toISOString(),
        })

        return { totalScore: grading.totalEarned, maxScore: grading.totalMax }
      }),
    ],

    async aggregate(): Promise<void> {
      // All work done in steps
    },
  }
}
