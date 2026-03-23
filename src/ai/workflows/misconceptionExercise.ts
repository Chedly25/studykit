/**
 * Misconception-driven exercise generation workflow.
 * Loads unresolved misconceptions, generates targeted exercises via fast model,
 * saves them to the exercise bank.
 */
import { db } from '../../db'
import { localStep } from '../orchestrator/steps'
import type { WorkflowDefinition, WorkflowContext } from '../orchestrator/types'

interface MisconceptionExerciseConfig {
  examProfileId: string
  maxMisconceptions?: number
}

interface MisconceptionExerciseResult {
  exercisesGenerated: number
  misconceptionsCovered: string[]
}

export function createMisconceptionExerciseWorkflow(
  config: MisconceptionExerciseConfig,
): WorkflowDefinition<MisconceptionExerciseResult> {
  return {
    id: 'misconception-exercise',
    name: 'Generating targeted exercises',
    steps: [
      // Step 1: Load unresolved misconceptions
      localStep('load-misconceptions', 'Loading misconceptions', async () => {
        const misconceptions = await db.misconceptions
          .where('examProfileId')
          .equals(config.examProfileId)
          .filter(m => !m.resolvedAt)
          .toArray()

        // Sort by occurrence count (most frequent first), limit
        const sorted = misconceptions
          .sort((a, b) => b.occurrenceCount - a.occurrenceCount)
          .slice(0, config.maxMisconceptions ?? 3)

        // Enrich with topic names
        const topics = await db.topics
          .where('examProfileId')
          .equals(config.examProfileId)
          .toArray()
        const topicMap = new Map(topics.map(t => [t.id, t.name]))

        return sorted.map(m => ({
          id: m.id,
          description: m.description,
          topicId: m.topicId,
          topicName: topicMap.get(m.topicId) ?? 'Unknown',
          occurrenceCount: m.occurrenceCount,
        }))
      }),

      // Step 2: Generate exercises via LLM
      {
        id: 'generate-exercises',
        name: 'Generating targeted practice exercises',
        async execute(_input: unknown, ctx: WorkflowContext) {
          const misconceptions = ctx.results['load-misconceptions']?.data as Array<{
            id: string
            description: string
            topicId: string
            topicName: string
            occurrenceCount: number
          }>

          if (!misconceptions || misconceptions.length === 0) {
            return { exercises: [], misconceptionsCovered: [] }
          }

          const allExercises: Array<{
            text: string
            solutionText: string
            difficulty: number
            topicId: string
            misconceptionDescription: string
          }> = []
          const misconceptionsCovered: string[] = []

          for (const m of misconceptions) {
            await ctx.updateProgress?.(`Generating exercises for: ${m.description.slice(0, 50)}...`)

            try {
              const text = await ctx.llm(
                `Generate 2 targeted practice exercises that specifically test and correct this misconception: "${m.description}"
Topic: ${m.topicName}

The exercises should be designed so that a student who has this misconception will get them wrong, but a student who understands correctly will get them right.

Return ONLY valid JSON:
{ "exercises": [{ "text": "exercise question text with full context", "solutionText": "detailed step-by-step solution explaining why the misconception leads to the wrong answer", "difficulty": 3 }] }`,
                'You are an expert tutor creating diagnostic exercises. Each exercise should expose a specific misconception. Never use emojis.',
              )

              const jsonMatch = text.match(/\{[\s\S]*\}/)
              if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]) as {
                  exercises: Array<{ text: string; solutionText: string; difficulty: number }>
                }
                for (const ex of parsed.exercises) {
                  allExercises.push({
                    ...ex,
                    topicId: m.topicId,
                    misconceptionDescription: m.description,
                  })
                }
                misconceptionsCovered.push(m.description)
              }
            } catch {
              // Non-fatal — skip this misconception
              continue
            }
          }

          return { exercises: allExercises, misconceptionsCovered }
        },
      },

      // Step 3: Save exercises to the bank
      localStep('save-exercises', 'Saving exercises', async (ctx) => {
        const data = ctx.results['generate-exercises']?.data as {
          exercises: Array<{
            text: string
            solutionText: string
            difficulty: number
            topicId: string
            misconceptionDescription: string
          }>
          misconceptionsCovered: string[]
        }

        if (!data?.exercises || data.exercises.length === 0) {
          return { exercisesGenerated: 0, misconceptionsCovered: [] }
        }

        // Create or find a misconception-generated exam source
        const sourceId = 'misconception-generated'
        const existing = await db.examSources.get(sourceId)
        if (!existing) {
          await db.examSources.put({
            id: sourceId,
            examProfileId: config.examProfileId,
            documentId: '',
            name: 'Misconception Exercises',
            totalExercises: 0,
            parsedAt: new Date().toISOString(),
          })
        }

        const now = new Date().toISOString()
        const today = now.slice(0, 10)
        let exercisesGenerated = 0

        for (const ex of data.exercises) {
          await db.exercises.put({
            id: crypto.randomUUID(),
            examSourceId: sourceId,
            examProfileId: config.examProfileId,
            exerciseNumber: Date.now(),
            text: `[Targeted practice — addresses: ${ex.misconceptionDescription}]\n\n${ex.text}`,
            solutionText: ex.solutionText,
            difficulty: Math.max(1, Math.min(5, ex.difficulty)),
            topicIds: JSON.stringify([ex.topicId]),
            status: 'not_attempted',
            attemptCount: 0,
            createdAt: now,
            easeFactor: 2.5,
            interval: 0,
            repetitions: 0,
            nextReviewDate: today,
          })
          exercisesGenerated++
        }

        // Update total exercise count on source
        await db.examSources.update(sourceId, {
          totalExercises: (existing?.totalExercises ?? 0) + exercisesGenerated,
        })

        return { exercisesGenerated, misconceptionsCovered: data.misconceptionsCovered }
      }),
    ],

    aggregate(ctx) {
      const result = ctx.results['save-exercises']?.data as MisconceptionExerciseResult | undefined
      return result ?? { exercisesGenerated: 0, misconceptionsCovered: [] }
    },
  }
}
