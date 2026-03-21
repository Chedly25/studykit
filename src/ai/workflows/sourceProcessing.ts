/**
 * Source processing workflow — runs after document upload.
 * Steps: gather context → parallel (embed + extract + flashcards) → save results → concept cards (batched)
 */
import { db } from '../../db'
import { getChunksByDocumentId } from '../../lib/sources'
import { embedAndStoreChunks, hasEmbeddings } from '../../lib/embeddings'
import type { WorkflowDefinition, WorkflowContext } from '../orchestrator/types'
import { dbQueryStep, localStep } from '../orchestrator/steps'

interface SourceProcessingResult {
  summary: string
  conceptsFound: string[]
  mappingsApplied: number
  flashcardDeckId?: string
  flashcardCount?: number
}

interface ProcessingConfig {
  documentId: string
  isPro: boolean
}

export function createSourceProcessingWorkflow(
  config: ProcessingConfig,
): WorkflowDefinition<SourceProcessingResult> {
  return {
    id: 'source-processing',
    name: 'Processing document',
    steps: [
      // Step 1: Gather context
      dbQueryStep('gather-context', 'Gathering context', async (ctx) => {
        const doc = await db.documents.get(config.documentId)
        if (!doc) throw new Error('Document not found')

        const chunks = await getChunksByDocumentId(config.documentId)
        const topics = await db.topics.where('examProfileId').equals(ctx.examProfileId).toArray()
        const subjects = await db.subjects.where('examProfileId').equals(ctx.examProfileId).toArray()
        const profile = await db.examProfiles.get(ctx.examProfileId)

        return {
          doc,
          chunks,
          topics: topics.map(t => ({ id: t.id, name: t.name, subjectId: t.subjectId })),
          subjects: subjects.map(s => ({ id: s.id, name: s.name })),
          profileName: profile?.name ?? '',
          // Take first ~3000 words for the LLM
          sampleContent: chunks.slice(0, 8).map(c => c.content).join('\n\n').slice(0, 12000),
        }
      }),

      // Step 2: Parallel — embed chunks + extract concepts + generate flashcards
      {
        id: 'parallel-process',
        name: 'Analyzing document',
        async execute(_input: unknown, ctx: WorkflowContext) {
          const context = ctx.results['gather-context']?.data as {
            doc: { title: string }
            sampleContent: string
            topics: Array<{ id: string; name: string }>
            subjects: Array<{ name: string }>
            profileName: string
          }

          const topicList = context.topics.map(t => t.name).join(', ')
          const subjectList = context.subjects.map(s => s.name).join(', ')

          // Launch all three in parallel
          const [embedResult, extractResult, flashcardResult] = await Promise.all([
            // Embed chunks
            (async () => {
              try {
                const alreadyEmbedded = await hasEmbeddings(config.documentId)
                if (alreadyEmbedded) return { skipped: true }
                const chunks = await getChunksByDocumentId(config.documentId)
                await embedAndStoreChunks(chunks, ctx.authToken)
                return { embedded: chunks.length }
              } catch {
                return { error: 'embedding failed' }
              }
            })(),

            // Extract concepts + summary (1 LLM call)
            (async () => {
              const prompt = `Analyze this document and produce a JSON response.

Document: "${context.doc.title}"
Study goal: ${context.profileName}
Existing subjects: ${subjectList || 'none'}
Existing topics: ${topicList || 'none'}

Content sample:
${context.sampleContent}

Return JSON with:
1. "summary": A 2-3 paragraph summary of the document's key content
2. "concepts": Array of concepts found, each with:
   - "name": The concept name (match existing topic names when possible)
   - "chunkIndices": Which chunk indices (0-based) contain this concept

Match concept names to existing topics when the content clearly maps. Only include concepts that are substantive.

Respond ONLY with valid JSON.`

              const text = await ctx.llm(prompt, 'You are an academic content analyst. Extract key concepts and generate concise summaries.')
              const jsonMatch = text.match(/\{[\s\S]*\}/)
              if (!jsonMatch) throw new Error('No JSON in extract response')
              return JSON.parse(jsonMatch[0]) as {
                summary: string
                concepts: Array<{ name: string; chunkIndices: number[] }>
              }
            })(),

            // Generate flashcards (Pro only)
            (async () => {
              if (!config.isPro) return null
              try {
                const prompt = `Generate flashcards from this document for studying.

Document: "${context.doc.title}"
Study goal: ${context.profileName}

Content:
${context.sampleContent}

Return JSON with:
{
  "cards": [
    { "front": "question or prompt", "back": "answer or explanation" }
  ]
}

Generate 10-20 high-quality flashcards covering the key concepts. Focus on understanding, not just recall. Respond ONLY with valid JSON.`

                const text = await ctx.llm(prompt, 'You are an expert flashcard creator. Generate concise, effective study cards.')
                const jsonMatch = text.match(/\{[\s\S]*\}/)
                if (!jsonMatch) return null
                return JSON.parse(jsonMatch[0]) as { cards: Array<{ front: string; back: string }> }
              } catch {
                return null
              }
            })(),
          ])

          return { embedResult, extractResult, flashcardResult }
        },
      },

      // Step 3: Save results
      localStep('save-results', 'Saving results', async (ctx) => {
        const parallelData = ctx.results['parallel-process']?.data as {
          extractResult: { summary: string; concepts: Array<{ name: string; chunkIndices: number[] }> }
          flashcardResult: { cards: Array<{ front: string; back: string }> } | null
        }

        const conceptData = parallelData?.extractResult
        const flashcardData = parallelData?.flashcardResult

        const context = ctx.results['gather-context']?.data as {
          doc: { title: string; id: string }
          chunks: Array<{ id: string; chunkIndex: number }>
          topics: Array<{ id: string; name: string; subjectId: string }>
        }

        // Save summary
        if (conceptData?.summary) {
          await db.documents.update(config.documentId, { summary: conceptData.summary })
        }

        // Map chunks to topics
        let mappingsApplied = 0
        const conceptsFound: string[] = []

        if (conceptData?.concepts) {
          const topicMap = new Map(context.topics.map(t => [t.name.toLowerCase(), t.id]))
          const chunkMap = new Map(context.chunks.map(c => [c.chunkIndex, c.id]))

          for (const concept of conceptData.concepts) {
            conceptsFound.push(concept.name)
            const topicId = topicMap.get(concept.name.toLowerCase())
            if (topicId && concept.chunkIndices) {
              for (const idx of concept.chunkIndices) {
                const chunkId = chunkMap.get(idx)
                if (chunkId) {
                  await db.documentChunks.update(chunkId, { topicId })
                  mappingsApplied++
                }
              }
            }
          }
        }

        // Create flashcard deck
        let flashcardDeckId: string | undefined
        let flashcardCount = 0

        if (flashcardData?.cards && flashcardData.cards.length > 0) {
          const deckId = crypto.randomUUID()
          await db.flashcardDecks.put({
            id: deckId,
            examProfileId: ctx.examProfileId,
            name: `${context.doc.title} Cards`,
            createdAt: new Date().toISOString(),
          })

          const cards = flashcardData.cards.map(c => ({
            id: crypto.randomUUID(),
            deckId,
            front: c.front,
            back: c.back,
            source: 'ai-generated' as const,
            easeFactor: 2.5,
            interval: 0,
            repetitions: 0,
            nextReviewDate: new Date().toISOString().slice(0, 10),
            lastRating: 0,
          }))
          await db.flashcards.bulkPut(cards)
          flashcardDeckId = deckId
          flashcardCount = cards.length
        }

        return { summary: conceptData?.summary ?? '', conceptsFound, mappingsApplied, flashcardDeckId, flashcardCount }
      }),

      // Step 4: Generate concept cards (batched + parallel)
      {
        id: 'generate-concept-cards',
        name: 'Generating concept cards',
        shouldRun: () => true,
        optional: true,
        async execute(_input: unknown, ctx: WorkflowContext) {
          const parallelData = ctx.results['parallel-process']?.data as {
            extractResult: { concepts: Array<{ name: string; chunkIndices: number[] }> }
          } | undefined

          const conceptData = parallelData?.extractResult

          const context = ctx.results['gather-context']?.data as {
            chunks: Array<{ id: string; chunkIndex: number; content: string }>
            topics: Array<{ id: string; name: string }>
          }

          if (!conceptData?.concepts || conceptData.concepts.length === 0) {
            return { cardsGenerated: 0 }
          }

          const topicMap = new Map(context.topics.map(t => [t.name.toLowerCase(), t.id]))

          // Resolve topic IDs and filter to matchable concepts
          const matchedConcepts: Array<{
            name: string
            topicId: string
            relevantContent: string
            chunkIds: string[]
          }> = []

          for (const concept of conceptData.concepts.slice(0, 12)) {
            let topicId = topicMap.get(concept.name.toLowerCase())
            if (!topicId) {
              for (const [name, id] of topicMap) {
                if (concept.name.toLowerCase().includes(name) || name.includes(concept.name.toLowerCase())) {
                  topicId = id
                  break
                }
              }
            }
            if (!topicId) continue

            const relevantChunks = concept.chunkIndices
              .map(i => context.chunks.find(c => c.chunkIndex === i))
              .filter(Boolean)
              .slice(0, 3)

            const relevantContent = relevantChunks.map(c => c!.content).join('\n---\n')
            if (!relevantContent) continue

            matchedConcepts.push({
              name: concept.name,
              topicId,
              relevantContent,
              chunkIds: relevantChunks.map(c => c!.id),
            })
          }

          if (matchedConcepts.length === 0) return { cardsGenerated: 0 }

          // Batch concepts into groups of 4 and run all batches in parallel
          const BATCH_SIZE = 4
          const batches: typeof matchedConcepts[] = []
          for (let i = 0; i < matchedConcepts.length; i += BATCH_SIZE) {
            batches.push(matchedConcepts.slice(i, i + BATCH_SIZE))
          }

          let cardsGenerated = 0

          const batchResults = await Promise.all(
            batches.map(async (batch) => {
              const conceptList = batch.map((c, i) => {
                return `Concept ${i + 1}: "${c.name}"\nSource material:\n${c.relevantContent.slice(0, 3000)}`
              }).join('\n\n===\n\n')

              try {
                const text = await ctx.llm(
                  `Generate concept cards for the following ${batch.length} concepts.

${conceptList}

Return a JSON array with one object per concept:
[
  { "title": "concept name", "keyPoints": ["point 1", "point 2", "point 3"], "example": "a concrete example", "sourceReference": "source reference like Ch.3 p.12" }
]

Return EXACTLY ${batch.length} cards in the array, one per concept above, in the same order.
Respond ONLY with valid JSON (an array).`,
                  'You are an expert at creating concise study concept cards.',
                )

                const jsonMatch = text.match(/\[[\s\S]*\]/)
                if (!jsonMatch) return []

                const parsed = JSON.parse(jsonMatch[0]) as Array<{
                  title?: string
                  keyPoints?: string[]
                  example?: string
                  sourceReference?: string
                }>

                return parsed.map((card, i) => ({
                  card,
                  concept: batch[i],
                }))
              } catch {
                return []
              }
            })
          )

          // Save all generated cards
          const now = new Date().toISOString()
          for (const results of batchResults) {
            for (const { card, concept } of results) {
              if (!card || !concept) continue
              try {
                await db.conceptCards.put({
                  id: crypto.randomUUID(),
                  examProfileId: ctx.examProfileId,
                  topicId: concept.topicId,
                  title: card.title ?? concept.name,
                  keyPoints: JSON.stringify(card.keyPoints ?? []),
                  example: card.example ?? '',
                  sourceChunkIds: JSON.stringify(concept.chunkIds),
                  sourceReference: card.sourceReference ?? '',
                  relatedCardIds: '[]',
                  mastery: 0,
                  createdAt: now,
                  updatedAt: now,
                })
                cardsGenerated++
              } catch {
                continue
              }
            }
          }

          return { cardsGenerated }
        },
      },
    ],

    aggregate(ctx) {
      const result = ctx.results['save-results']?.data as SourceProcessingResult | undefined
      return result ?? { summary: '', conceptsFound: [], mappingsApplied: 0 }
    },
  }
}
