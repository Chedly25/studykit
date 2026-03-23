import { db } from '../../db'
import { setTransient } from '../../lib/transientStore'

interface RenderConceptCardInput {
  title: string
  keyPoints: string[]
  example?: string
  connections?: string[]
  sourceReference?: string
  content?: string          // Rich markdown fiche content
}

interface QuizQuestion {
  question: string
  options: string[]
  correctIndex: number
  explanation: string
}

interface RenderQuizInput {
  questions: QuizQuestion[]
}

export async function saveConceptCard(
  examProfileId: string,
  topicId: string,
  input: RenderConceptCardInput,
): Promise<string> {
  // Check for duplicate title before saving
  const existingWithTitle = await db.conceptCards
    .where('examProfileId')
    .equals(examProfileId)
    .filter(c => c.topicId === topicId && c.title.toLowerCase() === input.title.toLowerCase())
    .first()

  if (existingWithTitle) {
    return JSON.stringify({
      error: `A concept card titled "${input.title}" already exists for this topic. Use a different title or update the existing card.`,
    })
  }

  const cardId = crypto.randomUUID()
  const now = new Date().toISOString()

  await db.conceptCards.put({
    id: cardId,
    examProfileId,
    topicId,
    title: input.title,
    content: input.content,
    keyPoints: JSON.stringify(input.keyPoints),
    example: input.example ?? '',
    sourceChunkIds: '[]',
    sourceReference: input.sourceReference ?? '',
    relatedCardIds: JSON.stringify(input.connections ?? []),
    mastery: 0,
    easeFactor: 2.5,
    interval: 0,
    repetitions: 0,
    nextReviewDate: new Date().toISOString().slice(0, 10),
    createdAt: now,
    updatedAt: now,
  })

  return JSON.stringify({
    success: true,
    cardId,
    marker: `[card:${cardId}]`,
    instruction: 'The concept card has been rendered inline. Continue the conversation naturally — ask the student a question to check their understanding.',
  })
}

export function prepareQuiz(input: RenderQuizInput): string {
  const quizId = crypto.randomUUID()

  // Validate
  const questions = input.questions.filter(q =>
    q.question && Array.isArray(q.options) && q.options.length >= 2 &&
    typeof q.correctIndex === 'number' && q.correctIndex < q.options.length
  )

  if (questions.length === 0) {
    return JSON.stringify({ error: 'No valid questions provided' })
  }

  setTransient(quizId, questions)

  return JSON.stringify({
    success: true,
    quizId,
    marker: `[quiz:${quizId}]`,
    questionCount: questions.length,
    instruction: 'The quiz has been rendered inline. Wait for the student to complete it before continuing.',
  })
}

interface RenderCodePlaygroundInput {
  code: string
  language: string
  instructions: string
}

export function prepareCodePlayground(input: RenderCodePlaygroundInput): string {
  const codeId = crypto.randomUUID()

  setTransient(codeId, {
    code: input.code ?? '',
    language: input.language ?? 'python',
    instructions: input.instructions ?? '',
  })

  return JSON.stringify({
    success: true,
    codeId,
    marker: `[code:${codeId}]`,
    instruction: 'The code playground has been rendered inline. The student can edit and run the code. Wait for them to try before continuing.',
  })
}
