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

export interface GradingConfig {
  sessionId: string
}

interface QuestionGrade {
  questionId: string
  isCorrect: boolean
  earnedPoints: number
  feedback: string
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
      localStep<QuestionGrade[]>('gradeObjective', 'Grading objective questions', async () => {
        const questions = await db.generatedQuestions
          .where('sessionId').equals(config.sessionId)
          .toArray()

        const grades: QuestionGrade[] = []
        for (const q of questions) {
          if (q.format !== 'multiple-choice' && q.format !== 'true-false') continue
          if (!q.isAnswered) {
            grades.push({
              questionId: q.id,
              isCorrect: false,
              earnedPoints: 0,
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
            earnedPoints: isCorrect ? q.points : 0,
            feedback: isCorrect
              ? 'Correct!'
              : `Incorrect. The correct answer is: ${q.correctAnswer}`,
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

            return `Grade the following student answers. For each question, determine if the answer is correct (partial credit allowed for essays), assign earned points (0 to max), and provide brief feedback.

Questions and answers:
${JSON.stringify(questionsForGrading, null, 2)}

Return ONLY a JSON object:
{
  "grades": [
    {
      "questionId": "id-here",
      "isCorrect": true,
      "earnedPoints": 2,
      "feedback": "Good explanation of..."
    }
  ]
}`
          },
          'You are a fair and thorough exam grader. Grade based on accuracy and completeness. Return ONLY valid JSON.',
        ),
        optional: true,
        shouldRun: () => {
          // Will be checked at runtime; always include step
          return true
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

          return `Generate performance feedback for a practice exam.

Score: ${totalScore}/${maxScore} (${maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0}%)

Topic breakdown:
${topicSummary.map(t => `- ${t.topic}: ${t.earned}/${t.max} points, ${t.correct}/${t.total} correct`).join('\n')}

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
  ]
}`
        },
        'You are an encouraging but honest tutor providing exam feedback. Return ONLY valid JSON.',
      ),

      // Step 4: Update mastery stats
      localStep('updateMastery', 'Updating your knowledge graph', async (ctx) => {
        const questions = await db.generatedQuestions
          .where('sessionId').equals(config.sessionId)
          .toArray()

        const objectiveGrades = (ctx.results['gradeObjective']?.data as QuestionGrade[]) ?? []
        const subjectiveGrades = (ctx.results['gradeSubjective']?.data as { grades: QuestionGrade[] })?.grades ?? []
        const allGrades = [...objectiveGrades, ...subjectiveGrades]

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
          })
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

      return { grades: allGrades, totalScore, maxScore }
    },
  }
}
