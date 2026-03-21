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
  keyResult?: string
  estimatedDifficulty: number
  pointValue?: number
}

interface ParsedExamData {
  preamble: string
  exercises: ParsedExercise[]
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

      // Step 2: Parse exercises AND tag to topics in a single LLM call
      {
        id: 'parse-and-tag-exercises',
        name: 'Extracting exercises',
        async execute(_input: unknown, ctx: WorkflowContext) {
          const context = ctx.results['gather-context']?.data as {
            doc: { title: string }
            fullContent: string
            topics: Array<{ id: string; name: string; chapterId?: string }>
            chapters: Array<{ id: string; name: string; subjectId: string }>
            subjects: Array<{ id: string; name: string }>
          }

          // Build hierarchy description for topic tagging
          const hierarchyDesc = context.subjects.map(s => {
            const subChapters = context.chapters.filter(ch => ch.subjectId === s.id)
            return `${s.name}:\n${subChapters.map(ch => {
              const chTopics = context.topics.filter(t => t.chapterId === ch.id)
              return `  ${ch.name}: ${chTopics.map(t => `${t.name} (${t.id})`).join(', ')}`
            }).join('\n')}`
          }).join('\n\n')

          const hasTopics = context.topics.length > 0

          const prompt = `Analyze this exam document: extract exercises WITH context${hasTopics ? ', AND map each to topics' : ''}.

Document: "${context.doc.title}"
${hasTopics ? `\nTopic hierarchy:\n${hierarchyDesc}\n` : ''}
Content:
${context.fullContent}

Return ONLY valid JSON:
{
  "preamble": "The problem setup that defines variables, notation, objects used across all questions (e.g. 'Soit E un K-espace vectoriel de dimension finie, u un endomorphisme de E...'). If the exam has multiple independent problems, combine all preambles.",
  "exercises": [
    {
      "exerciseNumber": 1,
      "text": "Full text of this question",
      "solutionText": "Solution if provided, or null",
      "keyResult": "The key result/conclusion of this question that later questions might use (e.g. 'dim(F ∩ G) = 1', 'u est diagonalisable'). null if the question has no reusable result.",
      "estimatedDifficulty": 3,
      "pointValue": null${hasTopics ? ',\n      "topicIds": ["topic-id-1"]' : ''}
    }
  ]
}

Rules:
- "preamble": Extract the setup/context that defines objects, variables, spaces, maps, etc. used across questions. This is critical — later questions are meaningless without it.
- "text": The full text of this specific question (don't summarize)
- "keyResult": The main conclusion/result of this question, stated as a fact (not a proof). Later questions that say "en déduire", "en utilisant", "montrer que" depend on previous keyResults.
- "solutionText": Include if provided in the document, null otherwise
- exerciseNumber should be sequential (1, 2, 3...)
- estimatedDifficulty: 1 (easy) to 5 (very hard)
- If sub-questions exist (a, b, c), include them as part of the exercise text${hasTopics ? '\n- "topicIds": 1-3 topic IDs from the hierarchy above that best match this exercise. Use exact IDs.' : ''}
Respond ONLY with valid JSON.`

          const text = await ctx.llm(prompt, 'You are an expert at parsing academic exam documents. Extract exercises with full context, preambles, key results, and topic mappings.')

          const jsonMatch = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').match(/\{[\s\S]*\}/)
          if (!jsonMatch) throw new Error('No JSON found in response')
          const parsed = JSON.parse(jsonMatch[0]) as ParsedExamData & {
            exercises: Array<ParsedExercise & { topicIds?: string[] }>
          }

          // Enrich each exercise with preamble + admitted results from previous questions
          const taggedExercises: Array<ParsedExercise & { topicIds: string[] }> = []
          for (let i = 0; i < parsed.exercises.length; i++) {
            const ex = parsed.exercises[i]
            let contextBlock = ''

            if (parsed.preamble) {
              contextBlock += parsed.preamble + '\n\n'
            }

            const prevResults = parsed.exercises
              .slice(0, i)
              .filter(prev => prev.keyResult)
              .map(prev => `Q${prev.exerciseNumber}: ${prev.keyResult}`)
            if (prevResults.length > 0) {
              contextBlock += 'Résultats admis des questions précédentes:\n'
              contextBlock += prevResults.map(r => `• ${r}`).join('\n')
              contextBlock += '\n\n'
            }

            taggedExercises.push({
              ...ex,
              text: contextBlock + `${ex.exerciseNumber}. ${ex.text}`,
              topicIds: ex.topicIds ?? [],
            })
          }

          return { taggedExercises }
        },
      },

      // Step 3: Save results
      localStep('save-results', 'Saving exercises', async (ctx) => {
        const context = ctx.results['gather-context']?.data as {
          doc: { id: string; title: string }
        }
        const taggedData = ctx.results['parse-and-tag-exercises']?.data as {
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
