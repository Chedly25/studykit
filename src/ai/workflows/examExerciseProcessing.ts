/**
 * Exam exercise processing workflow — parses uploaded exam PDFs into
 * individual exercises tagged by topic.
 */
import { db } from '../../db'
import { getChunksByDocumentId } from '../../lib/sources'
import type { WorkflowDefinition, WorkflowContext } from '../orchestrator/types'
import { dbQueryStep, localStep } from '../orchestrator/steps'

interface ExamProcessingConfig {
  documentId: string
  isPro: boolean
}

interface ParsedExercise {
  exerciseNumber: number
  text: string
  solutionText?: string
  estimatedDifficulty: number
  pointValue?: number
}

export function createExamExerciseProcessingWorkflow(
  config: ExamProcessingConfig,
): WorkflowDefinition<{ exercisesCreated: number }> {
  return {
    id: 'exam-exercise-processing',
    name: 'Parsing exam exercises',
    steps: [
      // Step 1: Gather context
      dbQueryStep('gather-context', 'Loading exam content', async (ctx) => {
        const doc = await db.documents.get(config.documentId)
        if (!doc) throw new Error('Document not found')

        const chunks = await getChunksByDocumentId(config.documentId)
        const topics = await db.topics.where('examProfileId').equals(ctx.examProfileId).toArray()
        const chapters = await db.chapters.where('examProfileId').equals(ctx.examProfileId).toArray()
        const subjects = await db.subjects.where('examProfileId').equals(ctx.examProfileId).toArray()

        // Use more content for exams (need to see full exercises)
        const fullContent = chunks.map(c => c.content).join('\n\n')

        return {
          doc: { id: doc.id, title: doc.title },
          fullContent: fullContent.slice(0, 20000),
          topics: topics.map(t => ({ id: t.id, name: t.name, subjectId: t.subjectId, chapterId: t.chapterId })),
          chapters: chapters.map(ch => ({ id: ch.id, name: ch.name, subjectId: ch.subjectId })),
          subjects: subjects.map(s => ({ id: s.id, name: s.name })),
        }
      }),

      // Step 2: Parse exercises from the exam
      {
        id: 'parse-exercises',
        name: 'Extracting exercises',
        async execute(_input: unknown, ctx: WorkflowContext) {
          const context = ctx.results['gather-context']?.data as {
            doc: { title: string }
            fullContent: string
          }

          const prompt = `Analyze this exam document and extract each individual exercise/question.

Document: "${context.doc.title}"

Content:
${context.fullContent}

Return ONLY valid JSON:
{
  "exercises": [
    {
      "exerciseNumber": 1,
      "text": "Full text of the exercise/question",
      "solutionText": "Solution if provided, or null",
      "estimatedDifficulty": 3,
      "pointValue": null
    }
  ]
}

Rules:
- Extract EVERY exercise/question from the document
- exerciseNumber should be sequential (1, 2, 3...)
- estimatedDifficulty: 1 (easy) to 5 (very hard)
- Include the full text of each exercise (don't summarize)
- If sub-questions exist (a, b, c), include them as part of the exercise text
- pointValue: include if specified in the document, null otherwise
Respond ONLY with valid JSON.`

          const text = await ctx.llm(prompt, 'You are an expert at parsing academic exam documents. Extract individual exercises accurately.')

          const jsonMatch = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').match(/\{[\s\S]*\}/)
          if (!jsonMatch) throw new Error('No JSON found in response')
          return JSON.parse(jsonMatch[0]) as { exercises: ParsedExercise[] }
        },
      },

      // Step 3: Tag exercises with topics
      {
        id: 'tag-exercises',
        name: 'Tagging exercises with topics',
        async execute(_input: unknown, ctx: WorkflowContext) {
          const context = ctx.results['gather-context']?.data as {
            topics: Array<{ id: string; name: string; chapterId?: string }>
            chapters: Array<{ id: string; name: string }>
            subjects: Array<{ id: string; name: string }>
          }
          const parsedData = ctx.results['parse-exercises']?.data as { exercises: ParsedExercise[] }

          if (!parsedData?.exercises || parsedData.exercises.length === 0) {
            return { taggedExercises: [] }
          }

          if (!context?.subjects || !context?.topics) {
            return { taggedExercises: parsedData.exercises.map(e => ({ ...e, topicIds: [] as string[] })) }
          }

          // Build hierarchy description for the LLM
          const hierarchyDesc = context.subjects.map(s => {
            const subChapters = context.chapters.filter(ch => ch.subjectId === s.id)
            return `${s.name}:\n${subChapters.map(ch => {
              const chTopics = context.topics.filter(t => t.chapterId === ch.id)
              return `  ${ch.name}: ${chTopics.map(t => `${t.name} (${t.id})`).join(', ')}`
            }).join('\n')}`
          }).join('\n\n')

          const exerciseList = parsedData.exercises.map(e =>
            `Exercise ${e.exerciseNumber}: ${e.text.slice(0, 200)}...`
          ).join('\n')

          const prompt = `Map each exercise to the most relevant topics from this hierarchy.

Topic hierarchy:
${hierarchyDesc}

Exercises:
${exerciseList}

Return ONLY valid JSON:
{
  "mappings": [
    { "exerciseNumber": 1, "topicIds": ["topic-id-1", "topic-id-2"] }
  ]
}

Rules:
- Each exercise can map to 1-3 topics
- Use the exact topic IDs from the hierarchy above
- If unsure, map to the most likely topic
Respond ONLY with valid JSON.`

          const text = await ctx.llm(prompt, 'You are an expert at classifying academic exam questions by topic.')
          const jsonMatch = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').match(/\{[\s\S]*\}/)
          if (!jsonMatch) return { taggedExercises: parsedData.exercises.map(e => ({ ...e, topicIds: [] as string[] })) }

          const mappings = JSON.parse(jsonMatch[0]) as { mappings: Array<{ exerciseNumber: number; topicIds: string[] }> }
          const mappingMap = new Map(mappings.mappings.map(m => [m.exerciseNumber, m.topicIds]))

          return {
            taggedExercises: parsedData.exercises.map(e => ({
              ...e,
              topicIds: mappingMap.get(e.exerciseNumber) ?? [],
            })),
          }
        },
      },

      // Step 4: Save results
      localStep('save-results', 'Saving exercises', async (ctx) => {
        const context = ctx.results['gather-context']?.data as {
          doc: { id: string; title: string }
        }
        const taggedData = ctx.results['tag-exercises']?.data as {
          taggedExercises: Array<ParsedExercise & { topicIds: string[] }>
        }

        if (!taggedData?.taggedExercises || taggedData.taggedExercises.length === 0) {
          return { exercisesCreated: 0 }
        }

        // Create ExamSource
        const examSourceId = crypto.randomUUID()
        const now = new Date().toISOString()

        // Try to extract year from title
        const yearMatch = context.doc.title.match(/\b(19|20)\d{2}\b/)
        const year = yearMatch ? parseInt(yearMatch[0]) : undefined

        await db.examSources.put({
          id: examSourceId,
          examProfileId: ctx.examProfileId,
          documentId: context.doc.id,
          name: context.doc.title,
          year,
          totalExercises: taggedData.taggedExercises.length,
          parsedAt: now,
        })

        // Create Exercise records
        const exercises = taggedData.taggedExercises.map(e => ({
          id: crypto.randomUUID(),
          examSourceId,
          examProfileId: ctx.examProfileId,
          exerciseNumber: e.exerciseNumber,
          text: e.text,
          solutionText: e.solutionText,
          difficulty: Math.max(1, Math.min(5, e.estimatedDifficulty)),
          points: e.pointValue,
          topicIds: JSON.stringify(e.topicIds),
          status: 'not_attempted' as const,
          attemptCount: 0,
          createdAt: now,
        }))

        await db.exercises.bulkPut(exercises)

        return { exercisesCreated: exercises.length }
      }),
    ],

    aggregate(ctx) {
      const result = ctx.results['save-results']?.data as { exercisesCreated: number } | undefined
      return result ?? { exercisesCreated: 0 }
    },
  }
}
