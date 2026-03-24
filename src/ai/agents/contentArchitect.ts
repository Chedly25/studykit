/**
 * Content Architect agent — creates and improves study materials
 * using the reflection loop and effectiveness tracking.
 * Reads the diagnostician's report to target content where it's needed.
 */
import { db } from '../../db'
import { conceptCardValidator, flashcardValidator } from '../reflection/validators'
import { trackContentCreation } from '../../lib/effectivenessTracker'
import { getOptimalStrategy } from '../optimization/strategyOptimizer'
import type { AgentDefinition, AgentContext, AgentResult } from './types'
import type { DiagnosticReport } from './diagnostician'

export const contentArchitectAgent: AgentDefinition = {
  id: 'content-architect',
  name: 'Content Architect',
  description: 'Creates and improves study materials for priority topics',
  triggers: ['manual', 'app-open'],
  model: 'fast',
  cooldownMs: 3600000, // 1 hour

  async execute(ctx: AgentContext): Promise<AgentResult> {
    const { examProfileId } = ctx
    const episodes: AgentResult['episodes'] = []
    let cardsCreated = 0
    let flashcardsCreated = 0

    // Read diagnostician report
    const diagnosticInsight = await db.agentInsights.get(`diagnostician:${examProfileId}`)
    if (!diagnosticInsight) {
      return { success: true, summary: 'No diagnostic report available — run diagnostician first', episodes: [] }
    }

    let report: DiagnosticReport
    try {
      report = JSON.parse(diagnosticInsight.data) as DiagnosticReport
    } catch {
      return { success: false, summary: 'Failed to parse diagnostic report', episodes: [] }
    }

    // Focus on critical and high priority topics
    const targetTopics = report.priorities.filter(p => p.urgency === 'critical' || p.urgency === 'high').slice(0, 3)
    if (targetTopics.length === 0) {
      return { success: true, summary: 'No critical content gaps found', episodes: [] }
    }

    for (const priority of targetTopics) {
      if (ctx.signal.aborted) break

      // Check existing content for this topic
      const existingCards = await db.conceptCards
        .where('examProfileId')
        .equals(examProfileId)
        .filter(c => c.topicId === priority.topicId)
        .count()

      const existingFlashcards = await db.flashcards
        .where('topicId')
        .equals(priority.topicId)
        .count()

      // Search for relevant source material
      const sources = await ctx.search(priority.topicName, 5)
      const sourceContent = sources.map(s => s.chunk.content).join('\n---\n').slice(0, 4000)

      // Generate concept card if fewer than 2 exist
      if (existingCards < 2 && sourceContent) {
        try {
          const { strategy: cardStrategy, promptModification: cardMod } = await getOptimalStrategy('concept-card', examProfileId)
          const raw = await ctx.llm(
            `Generate a comprehensive study fiche for: "${priority.topicName}"
${cardMod ? `\nStyle guidance: ${cardMod}` : ''}
Source material:
${sourceContent}

Create a rich markdown fiche with these sections:
## Definition, ## Key Points, ## Nuances & Edge Cases, ## Worked Example, ## Common Mistakes, ## Connections

Use LaTeX $...$ for math. Be thorough.

Return JSON: { "title": "${priority.topicName}", "content": "full markdown", "keyPoints": ["point1", "point2", "point3"] }
Only JSON.`,
            'You are an expert at creating comprehensive study reference fiches. Return only valid JSON.',
          )

          const match = raw.match(/\{[\s\S]*\}/)
          if (match) {
            const parsed = JSON.parse(match[0]) as { title?: string; content?: string; keyPoints?: string[] }
            if (parsed.content) {
              // Reflect on quality
              const reflected = await ctx.reflect(
                { title: parsed.title ?? priority.topicName, content: parsed.content, keyPoints: parsed.keyPoints ?? [] },
                conceptCardValidator,
              )

              const now = new Date().toISOString()
              const cardId = crypto.randomUUID()
              await db.conceptCards.put({
                id: cardId,
                examProfileId,
                topicId: priority.topicId,
                title: reflected.content.title,
                content: reflected.content.content,
                keyPoints: JSON.stringify(reflected.content.keyPoints),
                example: '',
                sourceChunkIds: JSON.stringify(sources.map(s => s.chunk.id)),
                sourceReference: '',
                relatedCardIds: '[]',
                mastery: 0,
                easeFactor: 2.5,
                interval: 0,
                repetitions: 0,
                nextReviewDate: new Date().toISOString().slice(0, 10),
                createdAt: now,
                updatedAt: now,
              })

              await trackContentCreation('concept-card', cardId, examProfileId, cardStrategy, reflected.score)
              cardsCreated++

              episodes.push({
                userId: ctx.userId, examProfileId, topicId: priority.topicId, topicName: priority.topicName,
                type: 'strategy-effective',
                description: `Generated concept card for ${priority.topicName} (quality: ${reflected.score.toFixed(1)})`,
                context: JSON.stringify({ strategy: 'content-architect-fiche', score: reflected.score }),
                effectiveness: 0.5, tags: '["content-generation"]',
              })
            }
          }
        } catch { /* non-fatal — skip this topic */ }
      }

      // Generate flashcards if fewer than 5 exist
      if (existingFlashcards < 5 && sourceContent) {
        try {
          const { strategy: fcStrategy, promptModification: fcMod } = await getOptimalStrategy('flashcard', examProfileId)
          const count = Math.min(5 - existingFlashcards, 5)
          const raw = await ctx.llm(
            `Generate ${count} study flashcards for: "${priority.topicName}"
${fcMod ? `\nStyle guidance: ${fcMod}` : ''}
Source material:
${sourceContent}

Focus on understanding, not just recall. Test application and connections.

Return JSON: { "flashcards": [{ "front": "question", "back": "answer" }] }
Only JSON.`,
            'You are an expert at creating effective study flashcards. Return only valid JSON.',
          )

          const match = raw.match(/\{[\s\S]*\}/)
          if (match) {
            const parsed = JSON.parse(match[0]) as { flashcards?: Array<{ front: string; back: string }> }
            const cards = parsed.flashcards ?? []

            // Find or create a deck for this topic
            let deck = await db.flashcardDecks
              .where('examProfileId')
              .equals(examProfileId)
              .filter(d => d.topicId === priority.topicId)
              .first()

            if (!deck) {
              const deckId = crypto.randomUUID()
              await db.flashcardDecks.put({
                id: deckId,
                examProfileId,
                topicId: priority.topicId,
                name: `${priority.topicName} Cards`,
                createdAt: new Date().toISOString(),
              })
              deck = await db.flashcardDecks.get(deckId)
            }

            if (deck) {
              for (const card of cards.slice(0, count)) {
                // Reflect on quality
                const reflected = await ctx.reflect(
                  { front: card.front, back: card.back, topicName: priority.topicName },
                  flashcardValidator,
                )

                const fcId = crypto.randomUUID()
                await db.flashcards.put({
                  id: fcId,
                  deckId: deck.id,
                  topicId: priority.topicId,
                  front: reflected.content.front,
                  back: reflected.content.back,
                  source: 'ai-generated',
                  easeFactor: 2.5,
                  interval: 0,
                  repetitions: 0,
                  nextReviewDate: new Date().toISOString().slice(0, 10),
                  lastRating: 0,
                })

                await trackContentCreation('flashcard', fcId, examProfileId, fcStrategy, reflected.score)
                flashcardsCreated++
              }
            }
          }
        } catch { /* non-fatal */ }
      }
    }

    return {
      success: true,
      data: { cardsCreated, flashcardsCreated },
      summary: `Created ${cardsCreated} concept cards, ${flashcardsCreated} flashcards for ${targetTopics.length} priority topics`,
      episodes,
    }
  },
}
