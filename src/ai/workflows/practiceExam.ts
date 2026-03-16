/**
 * Practice exam generation workflow — 5 steps:
 * 1. Gather context (DB)
 * 2. Search documents (optional)
 * 3. Search web (optional)
 * 4. Generate questions (LLM)
 * 5. Validate questions (LLM, optional)
 */
import { db } from '../../db'
import type { GeneratedQuestion, PracticeExamSession } from '../../db/schema'
import { dbQueryStep, sourceSearchStep, webSearchStep, llmJsonStep } from '../orchestrator/steps'
import type { WorkflowDefinition, WorkflowContext } from '../orchestrator/types'
import { getKnowledgeGraph, getWeakTopicsTool, getErrorPatterns } from '../tools/knowledgeState'

export interface PracticeExamConfig {
  sessionId: string
  questionCount: number
  focusSubject?: string
  examSection?: string
  sourcesEnabled: boolean
}

interface GeneratedQuestionData {
  text: string
  format: 'multiple-choice' | 'true-false' | 'short-answer' | 'essay' | 'vignette'
  options?: string[]
  correctAnswer: string
  correctOptionIndex?: number
  explanation: string
  difficulty: number
  topicName: string
  points: number
  scenarioText?: string
  subQuestions?: Array<{ text: string; correctAnswer: string }>
}

export function createPracticeExamWorkflow(config: PracticeExamConfig): WorkflowDefinition<GeneratedQuestion[]> {
  return {
    id: 'practice-exam-generation',
    name: 'Generate Practice Exam',
    steps: [
      // Step 1: Gather context from DB
      dbQueryStep('gatherContext', 'Gathering your study data', async (ctx) => {
        const [knowledgeGraph, weakTopics, errorPatterns, studentModel, examFormats] = await Promise.all([
          getKnowledgeGraph(ctx.examProfileId),
          getWeakTopicsTool(ctx.examProfileId),
          getErrorPatterns(ctx.examProfileId),
          db.studentModels.get(ctx.examProfileId),
          db.examFormats.where('examProfileId').equals(ctx.examProfileId).toArray(),
        ])
        return { knowledgeGraph, weakTopics, errorPatterns, studentModel, examFormats }
      }),

      // Step 2: Search uploaded documents (optional, skipped if sources disabled)
      {
        ...sourceSearchStep('searchDocuments', 'Searching your study materials', (ctx) => {
          const context = ctx.results['gatherContext']?.data as { weakTopics: string } | undefined
          const weakTopics = context?.weakTopics ?? ''
          return config.focusSubject
            ? `${config.focusSubject} exam questions key concepts`
            : `weak topics practice questions ${weakTopics.slice(0, 200)}`
        }, 8),
        optional: true,
        shouldRun: () => config.sourcesEnabled,
      },

      // Step 3: Search web for reference material (optional)
      {
        ...webSearchStep('searchWeb', 'Researching online resources', (ctx) => {
          const focus = config.focusSubject ?? 'weak topics'
          return `${focus} exam practice questions study guide`
        }),
        optional: true,
      },

      // Step 4: Generate questions (core LLM step)
      llmJsonStep<{ questions: GeneratedQuestionData[] }>(
        'generateQuestions',
        'Generating exam questions',
        (ctx) => {
          const context = ctx.results['gatherContext']?.data as {
            knowledgeGraph: string
            weakTopics: string
            errorPatterns: string
            studentModel?: { learningStyle: string; commonMistakes: string }
            examFormats: Array<{ formatName: string; description: string; samplePrompt?: string }>
          }

          const sourceContent = ctx.results['searchDocuments']?.data as string | undefined
          const webContent = ctx.results['searchWeb']?.data as string | undefined

          const focusNote = config.focusSubject
            ? `Focus primarily on the subject: ${config.focusSubject}.`
            : 'Focus on the student\'s weakest topics.'

          const sectionNote = config.examSection
            ? `Use the "${config.examSection}" exam format style.`
            : 'Use a mix of question formats (multiple-choice, true-false, short-answer, essay).'

          const examFormatInfo = context?.examFormats?.length
            ? `\nExam format sections:\n${context.examFormats.map(f => `- ${f.formatName}: ${f.description}${f.samplePrompt ? ` (Example: ${f.samplePrompt})` : ''}`).join('\n')}`
            : ''

          return `You are generating a practice exam. Produce exactly ${config.questionCount} questions.

${focusNote}
${sectionNote}
${examFormatInfo}

Student's knowledge graph:
${context?.knowledgeGraph ?? 'No data available'}

Weak topics:
${context?.weakTopics ?? 'None identified'}

Error patterns:
${context?.errorPatterns ?? 'None'}

${context?.studentModel ? `Student learning style: ${context.studentModel.learningStyle}\nCommon mistakes: ${context.studentModel.commonMistakes}` : ''}

${sourceContent ? `Relevant source material:\n${sourceContent.slice(0, 3000)}` : ''}

${webContent ? `Web research:\n${webContent.slice(0, 2000)}` : ''}

Respond with ONLY a JSON object in this exact format:
{
  "questions": [
    {
      "text": "Question text here",
      "format": "multiple-choice",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": "Option B",
      "correctOptionIndex": 1,
      "explanation": "Why this is correct...",
      "difficulty": 3,
      "topicName": "Topic Name",
      "points": 2
    }
  ]
}

Rules:
- For multiple-choice: always include 4 options, set correctOptionIndex (0-based), correctAnswer must match the option text
- For true-false: format is "true-false", correctAnswer is "true" or "false", no options needed
- For short-answer: no options needed, correctAnswer is the expected answer
- For essay: no options needed, correctAnswer describes the ideal answer
- difficulty: 1-5 scale
- points: 1 for true-false, 2 for MCQ/short-answer, 3 for essay
- topicName must match a topic from the knowledge graph
- Vary difficulty across questions
- Ensure questions test different topics`
        },
        'You are an expert exam question generator. Generate high-quality, academically rigorous questions. Return ONLY valid JSON.',
      ),

      // Step 5: Validate generated questions (optional)
      {
        ...llmJsonStep<{ questions: GeneratedQuestionData[] }>(
          'validateQuestions',
          'Validating question quality',
          (ctx) => {
            const generated = ctx.results['generateQuestions']?.data as { questions: GeneratedQuestionData[] }
            return `Review these exam questions for accuracy and quality. Fix any issues with incorrect answers, ambiguous wording, or missing options. Return the corrected questions in the same JSON format.

Questions to validate:
${JSON.stringify(generated?.questions ?? [], null, 2)}

Return ONLY a JSON object: { "questions": [...] }
If all questions are correct, return them unchanged.`
          },
          'You are an expert exam reviewer. Check each question for factual accuracy, clear wording, and correct answers. Return ONLY valid JSON.',
        ),
        optional: true,
      },
    ],

    async aggregate(ctx: WorkflowContext): Promise<GeneratedQuestion[]> {
      // Use validated questions if available, otherwise use generated
      const validated = ctx.results['validateQuestions']?.data as { questions: GeneratedQuestionData[] } | undefined
      const generated = ctx.results['generateQuestions']?.data as { questions: GeneratedQuestionData[] }
      const questions = validated?.questions ?? generated?.questions ?? []

      // Write to IndexedDB
      const generatedQuestions: GeneratedQuestion[] = questions.map((q, i) => ({
        id: crypto.randomUUID(),
        sessionId: config.sessionId,
        examProfileId: ctx.examProfileId,
        questionIndex: i,
        text: q.text,
        format: q.format,
        options: q.options ? JSON.stringify(q.options) : undefined,
        correctAnswer: q.correctAnswer,
        correctOptionIndex: q.correctOptionIndex,
        explanation: q.explanation,
        difficulty: q.difficulty,
        topicName: q.topicName,
        points: q.points,
        scenarioText: q.scenarioText,
        subQuestions: q.subQuestions ? JSON.stringify(q.subQuestions) : undefined,
        isAnswered: false,
      }))

      await db.generatedQuestions.bulkPut(generatedQuestions)
      await db.practiceExamSessions.update(config.sessionId, { phase: 'ready' })

      return generatedQuestions
    },
  }
}
