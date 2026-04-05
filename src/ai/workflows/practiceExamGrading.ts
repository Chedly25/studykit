/**
 * Practice exam grading workflow — 4 steps:
 * 1. Grade objective questions programmatically
 * 2. Grade subjective questions via LLM (optional)
 * 3. Generate feedback via LLM
 * 4. Update mastery stats
 */
import { db } from '../../db'
import { localStep, llmJsonStep } from '../orchestrator/steps'
import type { WorkflowDefinition, WorkflowContext } from '../orchestrator/types'
import { logQuestionResult } from '../tools/dataOperations'
import { appendMistakeToFiche } from './ficheGeneration'

export interface GradingConfig {
  sessionId: string
}

interface QuestionGrade {
  questionId: string
  isCorrect: boolean
  earnedPoints: number
  feedback: string
  errorType?: 'recall' | 'conceptual' | 'application' | 'distractor' | null
  misconception?: string | null
}

interface GradingData {
  grades: QuestionGrade[]
  totalScore: number
  maxScore: number
}

export function createGradingWorkflow(config: GradingConfig): WorkflowDefinition<GradingData> {
  return {
    id: 'practice-exam-grading',
    name: 'Grade Practice Exam',
    steps: [
      // Step 1: Grade MCQ and True/False programmatically
      localStep<QuestionGrade[]>('gradeObjective', 'Grading objective questions', async (ctx) => {
        const questions = await db.generatedQuestions
          .where('sessionId').equals(config.sessionId)
          .toArray()

        // Load exam formats for negative marking config
        const examFormats = await db.examFormats.where('examProfileId').equals(ctx.examProfileId).toArray()
        const formatMap = new Map(examFormats.map(f => [f.id, f]))

        const grades: QuestionGrade[] = []
        for (const q of questions) {
          if (q.format !== 'multiple-choice' && q.format !== 'true-false') continue

          // Check if this question's section has negative marking
          const fmt = q.examSectionId ? formatMap.get(q.examSectionId) : undefined
          const hasNegativeMarking = fmt?.negativeMarking === true
          const penalty = fmt?.negativeMarkingPenalty ?? 0.25

          if (!q.isAnswered) {
            grades.push({
              questionId: q.id,
              isCorrect: false,
              earnedPoints: 0, // No penalty for unanswered
              feedback: 'Not answered.',
            })
            continue
          }

          let isCorrect = false
          if (q.format === 'multiple-choice' && q.correctOptionIndex !== undefined) {
            // Compare by option index (more reliable)
            const options: string[] = q.options ? JSON.parse(q.options) : []
            const userAnswer = (q.userAnswer ?? '').trim()
            const selectedIndex = options.findIndex(
              o => o.trim().toLowerCase() === userAnswer.toLowerCase(),
            )
            isCorrect = selectedIndex === q.correctOptionIndex
          } else {
            // Fallback: compare answer text
            isCorrect =
              (q.userAnswer ?? '').trim().toLowerCase() === q.correctAnswer.trim().toLowerCase()
          }

          grades.push({
            questionId: q.id,
            isCorrect,
            earnedPoints: isCorrect ? q.points : (hasNegativeMarking ? -penalty : 0),
            feedback: isCorrect
              ? 'Correct!'
              : `Incorrect. The correct answer is: ${q.correctAnswer}${hasNegativeMarking ? ` (-${penalty} penalty)` : ''}`,
          })
        }
        return grades
      }),

      // Step 2: Grade subjective questions via LLM (optional, skip if none)
      {
        ...llmJsonStep<{ grades: QuestionGrade[] }>(
          'gradeSubjective',
          'AI grading written answers',
          async (_ctx) => {
            const questions = await db.generatedQuestions
              .where('sessionId').equals(config.sessionId)
              .toArray()

            const subjective = questions.filter(
              q =>
                (q.format === 'short-answer' || q.format === 'essay' || q.format === 'vignette') &&
                q.isAnswered,
            )

            if (subjective.length === 0) return 'Return: { "grades": [] }'

            const questionsForGrading = subjective.map(q => ({
              id: q.id,
              text: q.text,
              format: q.format,
              correctAnswer: q.correctAnswer,
              userAnswer: q.userAnswer,
              points: q.points,
            }))

            return `Grade the following student answers. For each question, determine if the answer is correct (partial credit allowed for essays), assign earned points (0 to max), provide brief feedback, classify the error type if incorrect, and identify the specific misconception if applicable.

Error types:
- "recall": Student couldn't remember the information
- "conceptual": Student misunderstands the underlying concept
- "application": Student knows the concept but applied it incorrectly
- "distractor": Student was tricked by a plausible but wrong option
- null: If the answer is correct

Questions and answers:
${JSON.stringify(questionsForGrading, null, 2)}

Return ONLY a JSON object:
{
  "grades": [
    {
      "questionId": "id-here",
      "isCorrect": true,
      "earnedPoints": 2,
      "feedback": "Good explanation of...",
      "errorType": null,
      "misconception": null
    }
  ]
}

For "misconception": if incorrect, describe the specific misunderstanding in one sentence (e.g., "Confuses marginal and conditional probability"). null if correct or if it's a simple recall error.`
          },
          'You are a fair and thorough exam grader. Grade based on accuracy and completeness. Return ONLY valid JSON. Never use emojis.',
        ),
        optional: true,
        shouldRun: () => {
          // Will be checked at runtime; always include step
          return true
        },
      },

      // Step 2.5: Verify ambiguous grades via reflection loop
      {
        id: 'verifyGrades',
        name: 'Verifying grades',
        optional: true,
        async execute(_input: unknown, ctx: WorkflowContext) {
          const subjectiveResult = ctx.results['gradeSubjective']?.data as { grades: QuestionGrade[] } | undefined
          const subjectiveGrades = subjectiveResult?.grades ?? []

          const questions = await db.generatedQuestions
            .where('sessionId').equals(config.sessionId)
            .toArray()

          // Only verify grades in the ambiguous zone (partial credit)
          const ambiguous = subjectiveGrades.filter(g => {
            const q = questions.find(q => q.id === g.questionId)
            return q && g.earnedPoints > 0 && g.earnedPoints < q.points * 0.7
          })

          if (ambiguous.length === 0) return { verified: 0, fixed: 0 }

          let fixed = 0
          const { reflect } = await import('../reflection/reflectionLoop')
          const { gradeValidator } = await import('../reflection/validators')

          for (const grade of ambiguous.slice(0, 5)) {
            const q = questions.find(q => q.id === grade.questionId)
            if (!q) continue

            try {
              const result = await reflect(
                {
                  exerciseText: q.text,
                  studentAnswer: q.userAnswer ?? '',
                  score: q.points > 0 ? grade.earnedPoints / q.points : 0,
                  feedback: grade.feedback,
                  correctAnswer: q.correctAnswer,
                },
                gradeValidator,
                (prompt: string, system?: string) => ctx.llm(prompt, system),
              )

              if (result.wasFixed) {
                grade.earnedPoints = Math.round(result.content.score * q.points)
                grade.feedback = result.content.feedback
                fixed++
              }
            } catch { /* non-fatal — keep original grade */ }
          }

          return { verified: ambiguous.length, fixed }
        },
      },

      // Step 3: Generate overall feedback
      llmJsonStep<{ overallFeedback: string; topicBreakdown: Array<{ topic: string; score: number; maxScore: number; advice: string }> }>(
        'generateFeedback',
        'Generating performance feedback',
        async (ctx) => {
          const questions = await db.generatedQuestions
            .where('sessionId').equals(config.sessionId)
            .toArray()

          const objectiveGrades = (ctx.results['gradeObjective']?.data as QuestionGrade[]) ?? []
          const subjectiveGrades = (ctx.results['gradeSubjective']?.data as { grades: QuestionGrade[] })?.grades ?? []
          const allGrades = [...objectiveGrades, ...subjectiveGrades]

          const totalScore = allGrades.reduce((s, g) => s + g.earnedPoints, 0)
          const maxScore = questions.reduce((s, q) => s + q.points, 0)

          // Build topic breakdown
          const topicMap = new Map<string, { earned: number; max: number; correct: number; total: number }>()
          for (const q of questions) {
            const entry = topicMap.get(q.topicName) ?? { earned: 0, max: 0, correct: 0, total: 0 }
            entry.max += q.points
            entry.total++
            const grade = allGrades.find(g => g.questionId === q.id)
            if (grade) {
              entry.earned += grade.earnedPoints
              if (grade.isCorrect) entry.correct++
            }
            topicMap.set(q.topicName, entry)
          }

          const topicSummary = Array.from(topicMap.entries()).map(([topic, data]) => ({
            topic,
            earned: data.earned,
            max: data.max,
            correct: data.correct,
            total: data.total,
          }))

          // Build section breakdown (for simulation exams)
          const sectionMap = new Map<number, { name: string; earned: number; max: number; correct: number; total: number }>()
          for (const q of questions) {
            if (q.sectionIndex != null) {
              const entry = sectionMap.get(q.sectionIndex) ?? { name: `Section ${q.sectionIndex + 1}`, earned: 0, max: 0, correct: 0, total: 0 }
              entry.max += q.points
              entry.total++
              const grade = allGrades.find(g => g.questionId === q.id)
              if (grade) {
                entry.earned += grade.earnedPoints
                if (grade.isCorrect) entry.correct++
              }
              sectionMap.set(q.sectionIndex, entry)
            }
          }
          // Look up section names from ExamFormat
          if (sectionMap.size > 0) {
            const examFormats = await db.examFormats.where('examProfileId').equals(ctx.examProfileId).toArray()
            const formatById = new Map(examFormats.map(f => [f.id, f]))
            for (const q of questions) {
              if (q.sectionIndex != null && q.examSectionId) {
                const fmt = formatById.get(q.examSectionId)
                if (fmt) {
                  const entry = sectionMap.get(q.sectionIndex)
                  if (entry) entry.name = fmt.formatName
                }
              }
            }
          }

          const sectionSummary = Array.from(sectionMap.entries())
            .sort(([a], [b]) => a - b)
            .map(([_idx, d]) => `- ${d.name}: ${d.earned}/${d.max} points, ${d.correct}/${d.total} correct`)
            .join('\n')

          return `Generate performance feedback for a practice exam.

Score: ${totalScore}/${maxScore} (${maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0}%)

Topic breakdown:
${topicSummary.map(t => `- ${t.topic}: ${t.earned}/${t.max} points, ${t.correct}/${t.total} correct`).join('\n')}
${sectionSummary ? `\nSection breakdown:\n${sectionSummary}` : ''}

Return ONLY a JSON object:
{
  "overallFeedback": "2-3 sentence summary of performance with encouragement and specific areas to improve",
  "topicBreakdown": [
    {
      "topic": "Topic Name",
      "score": 4,
      "maxScore": 6,
      "advice": "Brief advice for improvement"
    }
  ]${sectionMap.size > 0 ? `,
  "sectionBreakdown": [
    {
      "sectionIndex": 0,
      "name": "Section Name",
      "earned": 12,
      "max": 16,
      "percentage": 75
    }
  ]` : ''}
}`
        },
        'You are an encouraging but honest tutor providing exam feedback. Return ONLY valid JSON. Never use emojis.',
      ),

      // Step 4: Update mastery stats + auto-enqueue misconception exercises
      localStep('updateMastery', 'Updating your knowledge graph', async (ctx) => {
        const questions = await db.generatedQuestions
          .where('sessionId').equals(config.sessionId)
          .toArray()

        const objectiveGrades = (ctx.results['gradeObjective']?.data as QuestionGrade[]) ?? []
        const subjectiveGrades = (ctx.results['gradeSubjective']?.data as { grades: QuestionGrade[] })?.grades ?? []
        const allGrades = [...objectiveGrades, ...subjectiveGrades]

        const topics = await db.topics.where('examProfileId').equals(ctx.examProfileId).toArray()
        const topicByName = new Map(topics.map(t => [t.name.toLowerCase(), t]))

        for (const q of questions) {
          const grade = allGrades.find(g => g.questionId === q.id)
          if (!grade) continue

          await logQuestionResult(ctx.examProfileId, {
            topicName: q.topicName,
            question: q.text,
            userAnswer: q.userAnswer ?? '',
            correctAnswer: q.correctAnswer,
            isCorrect: grade.isCorrect,
            difficulty: q.difficulty,
            explanation: q.explanation,
            errorType: grade.errorType ?? undefined,
          })

          // Save misconceptions
          if (grade.misconception && !grade.isCorrect) {
            const topic = topicByName.get(q.topicName.toLowerCase())
            if (topic) {
              const existing = await db.misconceptions
                .where('[examProfileId+topicId]')
                .equals([ctx.examProfileId, topic.id])
                .filter(m => m.description.toLowerCase() === grade.misconception!.toLowerCase())
                .first()

              const now = new Date().toISOString()
              if (existing) {
                const qIds: string[] = JSON.parse(existing.questionResultIds || '[]')
                await db.misconceptions.update(existing.id, {
                  occurrenceCount: existing.occurrenceCount + 1,
                  lastSeenAt: now,
                  questionResultIds: JSON.stringify([...new Set([...qIds, q.id])].slice(-20)),
                })
              } else {
                await db.misconceptions.put({
                  id: crypto.randomUUID(),
                  examProfileId: ctx.examProfileId,
                  topicId: topic.id,
                  description: grade.misconception,
                  occurrenceCount: 1,
                  firstSeenAt: now,
                  lastSeenAt: now,
                  exerciseIds: '[]',
                  questionResultIds: JSON.stringify([q.id]),
                })
              }

              // Auto-append mistake to revision fiche (if one exists)
              try {
                const fiche = await db.revisionFiches
                  .where('[examProfileId+topicId]')
                  .equals([ctx.examProfileId, topic.id])
                  .first()
                if (fiche) {
                  const mistakes: Array<{ text: string; date: string }> = JSON.parse(fiche.personalMistakes || '[]')
                  mistakes.push({ text: grade.misconception!, date: now })
                  await db.revisionFiches.update(fiche.id, {
                    content: appendMistakeToFiche(fiche.content, grade.misconception!, now.slice(0, 10)),
                    personalMistakes: JSON.stringify(mistakes),
                    updatedAt: now,
                  })
                }
              } catch { /* non-critical — fiche update is best-effort */ }
            }
          }
        }

        // Auto-enqueue misconception exercise generation if new misconceptions were found
        const newMisconceptions = allGrades.filter(g => g.misconception && !g.isCorrect)
        if (newMisconceptions.length > 0) {
          // Check for existing queued/running job to avoid duplicates
          const existingJob = await db.backgroundJobs
            .where('examProfileId')
            .equals(ctx.examProfileId)
            .filter(j => j.type === 'misconception-exercise' && (j.status === 'queued' || j.status === 'running'))
            .first()

          if (!existingJob) {
            const now = new Date().toISOString()
            await db.backgroundJobs.put({
              id: crypto.randomUUID(),
              examProfileId: ctx.examProfileId,
              type: 'misconception-exercise',
              status: 'queued',
              config: JSON.stringify({ examProfileId: ctx.examProfileId, maxMisconceptions: 3 }),
              completedStepIds: '[]',
              stepResults: '{}',
              totalSteps: 3,
              completedStepCount: 0,
              currentStepName: '',
              createdAt: now,
              updatedAt: now,
            })
          }
        }
      }),
    ],

    async aggregate(ctx: WorkflowContext): Promise<GradingData> {
      const questions = await db.generatedQuestions
        .where('sessionId').equals(config.sessionId)
        .toArray()

      const objectiveGrades = (ctx.results['gradeObjective']?.data as QuestionGrade[]) ?? []
      const subjectiveGrades = (ctx.results['gradeSubjective']?.data as { grades: QuestionGrade[] })?.grades ?? []
      const allGrades = [...objectiveGrades, ...subjectiveGrades]

      const totalScore = allGrades.reduce((s, g) => s + g.earnedPoints, 0)
      const maxScore = questions.reduce((s, q) => s + q.points, 0)

      // Write grades back to questions
      for (const grade of allGrades) {
        await db.generatedQuestions.update(grade.questionId, {
          isCorrect: grade.isCorrect,
          earnedPoints: grade.earnedPoints,
          feedback: grade.feedback,
        })
      }

      // Update session
      const feedbackData = ctx.results['generateFeedback']?.data as { overallFeedback: string } | undefined
      await db.practiceExamSessions.update(config.sessionId, {
        phase: 'graded',
        totalScore,
        maxScore,
        completedAt: new Date().toISOString(),
        overallFeedback: feedbackData ? JSON.stringify(feedbackData) : undefined,
      })

      // Dispatch swarm event: exam graded
      try {
        // @ts-expect-error Vite handles require() at build time
        const { dispatchSwarmEvent } = require('../agents/eventBus')
        dispatchSwarmEvent({
          type: 'exam-graded',
          sessionId: config.sessionId,
          examProfileId: ctx.examProfileId,
          totalScore,
          maxScore,
        })
      } catch { /* swarm dispatch is non-critical */ }

      return { grades: allGrades, totalScore, maxScore }
    },
  }
}
