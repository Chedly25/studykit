/**
 * Revision fiche generation workflow — generates a topic-level revision sheet.
 * Single LLM call per topic, grounded in the student's course materials.
 */
import { db } from '../../db'
import type { WorkflowDefinition, WorkflowContext } from '../orchestrator/types'
import { streamChat } from '../client'
import { buildFicheGenerationPrompt } from '../prompts/fichePrompts'

export interface FicheGenerationConfig {
  topicId: string
  topicName: string
  subjectId: string
  subjectName: string
  examName: string
  language?: 'fr' | 'en'
}

async function llmMain(prompt: string, system: string, ctx: WorkflowContext, maxTokens = 8192): Promise<string> {
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

export function createFicheGenerationWorkflow(config: FicheGenerationConfig): WorkflowDefinition<void> {
  return {
    id: 'fiche-generation',
    name: 'Generate Revision Fiche',
    steps: [
      {
        id: 'gatherAndGenerate',
        name: 'Generating revision fiche',
        async execute(_input: unknown, ctx: WorkflowContext): Promise<void> {
          // Gather course content for this topic
          const chunks = await db.documentChunks
            .where('examProfileId').equals(ctx.examProfileId)
            .filter(c => c.topicId === config.topicId)
            .toArray()

          // Also get chunks from the subject if no topic-specific chunks
          let courseContent = chunks.map(c => c.content).join('\n\n---\n\n')
          if (courseContent.length < 100) {
            // Fallback: get chunks from any document in this profile, limited
            const allChunks = await db.documentChunks
              .where('examProfileId').equals(ctx.examProfileId)
              .limit(50)
              .toArray()
            // Use longest word (>3 chars) from topic name to avoid stopwords like "Les", "The"
            const searchTerm = config.topicName.toLowerCase().split(/\s+/).find(w => w.length > 3)
              ?? config.topicName.toLowerCase()
            courseContent = allChunks
              .filter(c => c.content.toLowerCase().includes(searchTerm))
              .map(c => c.content)
              .join('\n\n---\n\n')
              .slice(0, 30000)
          }

          // Gather existing concept cards
          const conceptCards = await db.conceptCards
            .where('[examProfileId+topicId]')
            .equals([ctx.examProfileId, config.topicId])
            .toArray()

          // Gather personal mistakes
          const misconceptions = await db.misconceptions
            .where('[examProfileId+topicId]')
            .equals([ctx.examProfileId, config.topicId])
            .toArray()

          // Get topic mastery
          const topic = await db.topics.get(config.topicId)
          const mastery = topic?.mastery ?? 0

          const { system, user } = buildFicheGenerationPrompt({
            topicName: config.topicName,
            subjectName: config.subjectName,
            examName: config.examName,
            mastery,
            courseContent: courseContent.slice(0, 40000),
            conceptCards: conceptCards.map(c => {
              let cardContent = c.content ?? ''
              if (!cardContent && c.keyPoints) {
                try { cardContent = (JSON.parse(c.keyPoints) as string[]).join('. ') } catch { cardContent = c.keyPoints }
              }
              return { title: c.title, content: cardContent, mastery: c.mastery }
            }),
            personalMistakes: misconceptions.map(m => m.description),
            language: (config.language ?? 'fr') as 'fr' | 'en',
          })

          ctx.updateProgress?.(`Generating fiche for ${config.topicName}...`)
          const content = await llmMain(user, system, ctx, 8192)

          if (!content || content.trim().length < 50) {
            throw new Error('Generated fiche is too short')
          }

          // Check if a fiche already exists for this topic
          const existing = await db.revisionFiches
            .where('[examProfileId+topicId]')
            .equals([ctx.examProfileId, config.topicId])
            .first()

          const now = new Date().toISOString()
          if (existing) {
            await db.revisionFiches.update(existing.id, {
              content: content.trim(),
              sourceChunkIds: JSON.stringify(chunks.map(c => c.id)),
              personalMistakes: JSON.stringify(
                misconceptions.map(m => ({ text: m.description, date: m.lastSeenAt }))
              ),
              version: existing.version + 1,
              updatedAt: now,
            })
          } else {
            await db.revisionFiches.put({
              id: crypto.randomUUID(),
              examProfileId: ctx.examProfileId,
              topicId: config.topicId,
              subjectId: config.subjectId,
              title: config.topicName,
              content: content.trim(),
              sourceChunkIds: JSON.stringify(chunks.map(c => c.id)),
              personalMistakes: JSON.stringify(
                misconceptions.map(m => ({
                  text: m.description,
                  date: m.lastSeenAt,
                }))
              ),
              version: 1,
              generatedAt: now,
              updatedAt: now,
            })
          }
        },
      },
    ],

    async aggregate(): Promise<void> {},
  }
}

/**
 * Append a personal mistake to an existing fiche's "Erreurs fréquentes" section.
 * No LLM call needed — just string manipulation.
 */
export function appendMistakeToFiche(content: string, mistake: string, examDate: string): string {
  const erreurSection = content.indexOf('## Erreurs fréquentes')
  const commonSection = content.indexOf('## Common Mistakes')
  const sectionStart = erreurSection >= 0 ? erreurSection : commonSection

  if (sectionStart < 0) {
    // No mistakes section — append one
    return content + `\n\n## Erreurs fréquentes ⚠️\n- ${mistake} *(exam du ${examDate})*\n`
  }

  // Skip past the heading line itself before searching for the next ## section
  const headingEnd = content.indexOf('\n', sectionStart)
  const searchFrom = headingEnd >= 0 ? headingEnd + 1 : sectionStart + 40
  const nextSection = content.indexOf('\n## ', searchFrom)
  const insertPoint = nextSection >= 0 ? nextSection : content.length

  const newLine = `\n- *${mistake}* *(exam du ${examDate})*`
  return content.slice(0, insertPoint) + newLine + content.slice(insertPoint)
}
