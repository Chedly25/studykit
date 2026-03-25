/**
 * Exam DNA analysis workflow — analyzes uploaded past papers to extract style profiles.
 * Analyzes each paper individually, then merges into an aggregate DNA.
 */
import { db } from '../../db'
import type { WorkflowDefinition, WorkflowContext } from '../orchestrator/types'
import { streamChat } from '../client'
import { buildDNAAnalysisPrompt, mergeDNAProfiles } from '../prompts/examDNAPrompts'
import type { DNAProfile } from '../prompts/examDNAPrompts'

export interface ExamDNAAnalysisConfig {
  documentIds: string[]         // IDs of uploaded exam papers
  name: string                  // "Mines-Ponts Maths I"
  subject: string               // "maths-algebre" etc.
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

export function createExamDNAAnalysisWorkflow(config: ExamDNAAnalysisConfig): WorkflowDefinition<void> {
  return {
    id: 'exam-dna-analysis',
    name: 'Analyze Exam DNA',
    steps: [
      {
        id: 'analyzeAndMerge',
        name: 'Analyzing exam papers',
        async execute(_input: unknown, ctx: WorkflowContext): Promise<void> {
          const profiles: DNAProfile[] = []

          for (let i = 0; i < config.documentIds.length; i++) {
            const docId = config.documentIds[i]
            const doc = await db.documents.get(docId)
            if (!doc?.originalContent) continue

            ctx.updateProgress?.(`Analyzing paper ${i + 1} of ${config.documentIds.length}...`)

            const { system, user } = buildDNAAnalysisPrompt(
              doc.originalContent.slice(0, 50000) // Cap at 50K chars
            )

            const raw = await llmMain(user, system, ctx, 4096)

            try {
              const jsonStart = raw.indexOf('{')
              const jsonEnd = raw.lastIndexOf('}')
              if (jsonStart >= 0 && jsonEnd > jsonStart) {
                const profile = JSON.parse(raw.slice(jsonStart, jsonEnd + 1)) as DNAProfile
                if (profile.structure && profile.questionTypes) {
                  profiles.push(profile)
                }
              }
            } catch {
              // Skip papers that fail to analyze
            }
          }

          if (profiles.length === 0) {
            throw new Error('Failed to analyze any exam papers. Make sure the PDFs contain extractable text.')
          }

          // Merge profiles
          ctx.updateProgress?.('Merging DNA profiles...')
          const merged = mergeDNAProfiles(profiles)

          // Check for existing DNA for this profile+subject
          const existing = await db.examDNA
            .where('[examProfileId+subject]')
            .equals([ctx.examProfileId, config.subject])
            .first()

          const now = new Date().toISOString()
          if (existing) {
            // Merge with existing: combine source document lists, re-merge profiles
            const existingDocIds: string[] = JSON.parse(existing.sourceDocumentIds || '[]')
            const allDocIds = [...new Set([...existingDocIds, ...config.documentIds])]

            await db.examDNA.update(existing.id, {
              name: config.name,
              sourceDocumentIds: JSON.stringify(allDocIds),
              dnaProfile: JSON.stringify(merged),
              paperCount: allDocIds.length,
              updatedAt: now,
            })
          } else {
            await db.examDNA.put({
              id: crypto.randomUUID(),
              examProfileId: ctx.examProfileId,
              name: config.name,
              subject: config.subject,
              sourceDocumentIds: JSON.stringify(config.documentIds),
              dnaProfile: JSON.stringify(merged),
              paperCount: profiles.length,
              createdAt: now,
              updatedAt: now,
            })
          }
        },
      },
    ],

    async aggregate(): Promise<void> {},
  }
}
