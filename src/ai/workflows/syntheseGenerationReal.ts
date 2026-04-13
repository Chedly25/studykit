/**
 * REAL-DOCUMENT Note de synthèse generation workflow.
 *
 * Instead of fabricating legal documents, this pipeline:
 * 1. Theme Architect → picks theme, outputs search queries per document slot
 * 2. Document Sourcer → Judilibre API (case law) + web search (reports, doctrine, press)
 * 3. Document Curator → LLM excerpts each real document to dossier length
 * 4. Model Synthesis Writer → writes ideal synthesis from real content
 * 5. Grading Rubric Builder → creates evaluation criteria
 *
 * Output stored on PracticeExamSession: dossierBlueprint, dossierContent,
 * synthesisModelAnswer, synthesisRubric.
 */
import * as Sentry from '@sentry/react'
import { db } from '../../db'
import { dbQueryStep } from '../orchestrator/steps'
import type { WorkflowDefinition, WorkflowContext } from '../orchestrator/types'
import { streamChat } from '../client'
import { searchUnusedDecision, formatDecisionTitle } from '../../lib/judilibreClient'
import { searchAndFetchSection } from '../../lib/legifranceClient'
import { searchWebStructured, extractUrlContent } from '../tools/webSearchTool'
import {
  buildRealThemeArchitectPrompt,
  buildDocumentCuratorPrompt,
  buildRealModelSynthesisPrompt,
  buildRealGradingRubricPrompt,
  buildQualityPatchPrompt,
} from '../prompts/syntheseRealPrompts'
import type {
  RealDossierBlueprint,
  RealDossierDocument,
  DocumentSlot,
} from '../prompts/syntheseRealPrompts'

// ─── Config ─────────────────────────────────────────────────────

export interface SyntheseRealGenerationConfig {
  sessionId: string
  sourcesEnabled: boolean
}

// ─── LLM helper ─────────────────────────────────────────────────

async function llmCall(prompt: string, system: string, ctx: WorkflowContext, maxTokens = 8192): Promise<string> {
  const response = await streamChat({
    messages: [{ id: crypto.randomUUID(), role: 'user', content: prompt }],
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

function extractJson<T>(raw: string): T {
  // Strip markdown fences
  const cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '')
  const objIdx = cleaned.indexOf('{')
  const arrIdx = cleaned.indexOf('[')
  const start = arrIdx >= 0 && (objIdx < 0 || arrIdx < objIdx) ? arrIdx : objIdx
  if (start < 0) throw new Error('No JSON found in response')
  const isArray = cleaned[start] === '['
  const end = isArray ? cleaned.lastIndexOf(']') : cleaned.lastIndexOf('}')
  if (end < start) throw new Error('No JSON end found')
  const jsonStr = cleaned.slice(start, end + 1)
  try { return JSON.parse(jsonStr) }
  catch {
    // Only attempt repair for objects (not arrays — truncation corrupts nested structures)
    if (!isArray) {
      const lastBrace = jsonStr.lastIndexOf('}')
      if (lastBrace > 0) {
        return JSON.parse(jsonStr.slice(0, lastBrace + 1))
      }
    }
    throw new Error('Failed to parse JSON from response')
  }
}

// ─── Tone cleanup (deterministic regex) ─────────────────────────

function cleanDissertationTone(text: string): string {
  const replacements: [RegExp, string][] = [
    [/il appara[iî]t nécessaire d['']examiner/gi, 'le dossier met en évidence'],
    [/il appara[iî]t nécessaire de/gi, 'le dossier révèle'],
    [/il convient de souligner/gi, 'le dossier souligne'],
    [/il convient de noter/gi, 'le dossier indique'],
    [/il convient de relever/gi, 'le dossier relève'],
    [/il convient d['']observer/gi, 'le dossier montre'],
    [/il s['']agit d['']analyser/gi, 'les documents exposent'],
    [/il s['']agit d['']examiner/gi, 'les documents présentent'],
    [/il s['']agit de comprendre/gi, 'les documents permettent de comprendre'],
    [/force est de constater/gi, 'les documents révèlent'],
    [/il est intéressant de noter/gi, 'on relève dans le dossier'],
    [/il est important de souligner/gi, 'le dossier souligne'],
    [/il nous semble/gi, 'le dossier suggère'],
    [/on peut affirmer que/gi, 'les documents montrent que'],
  ]
  let result = text
  for (const [pattern, replacement] of replacements) {
    result = result.replace(pattern, replacement)
  }
  return result
}

// ─── Pipeline logging ───────────────────────────────────────────

function pipelineLog(level: 'info' | 'warn' | 'error', msg: string) {
  const prefix = '[synthese-real]'
  if (level === 'error') Sentry.captureException(new Error(`${prefix} ${msg}`))
  else if (level === 'warn') Sentry.captureMessage(String(`${prefix} ${msg}`), 'warning')
  else { /* info-level logs suppressed in production */ }
}

// ─── Document sourcing helpers ──────────────────────────────────

interface SourcedDocument {
  slot: DocumentSlot
  title: string
  sourceUrl: string
  rawContent: string
}

const MIN_WORDS = 300

/** Search Judilibre for case law, with deduplication and minimum word count */
async function sourceFromJudilibre(
  slot: DocumentSlot,
  authToken: string,
  usedIds: Set<string>,
): Promise<SourcedDocument | null> {
  for (const query of slot.searchQueries) {
    try {
      const result = await searchUnusedDecision(query, authToken, usedIds, {
        chamber: slot.chamberHint,
        minWords: MIN_WORDS,
      })
      if (!result) continue

      usedIds.add(result.searchResult.id)
      return {
        slot,
        title: formatDecisionTitle(result.searchResult),
        sourceUrl: `https://www.courdecassation.fr/decision/${result.searchResult.id}`,
        rawContent: result.decision.text,
      }
    } catch (err) {
      pipelineLog('warn', `Judilibre query "${query}" failed: ${(err as Error).message}`)
    }
  }
  return null
}

/** Search Legifrance for legislation — fetches entire sections with relevance scoring */
async function sourceFromLegifrance(
  slot: DocumentSlot,
  authToken: string,
): Promise<SourcedDocument | null> {
  for (const query of slot.searchQueries) {
    try {
      const section = await searchAndFetchSection(query, authToken, {
        codeNames: slot.codeNames,
        minWords: MIN_WORDS,
      })
      if (!section) continue

      const title = section.sectionTitle
        ? `${section.codeName} — ${section.sectionTitle}`
        : section.codeName
      return {
        slot,
        title,
        sourceUrl: section.sourceUrl,
        rawContent: section.concatenatedText,
      }
    } catch (err) {
      pipelineLog('warn', `Legifrance query "${query}" failed: ${(err as Error).message}`)
    }
  }
  return null
}

/** Search web via Tavily, then fetch full page content */
async function sourceFromWeb(
  slot: DocumentSlot,
  authToken: string,
  usedUrls: Set<string>,
): Promise<SourcedDocument | null> {
  for (const query of slot.searchQueries) {
    try {
      const results = await searchWebStructured(query, authToken, 5)
      if (results.length === 0) continue

      for (const result of results) {
        if (usedUrls.has(result.url)) continue

        // Try to fetch full page content
        let content = ''
        let title = result.title
        try {
          const extracted = await extractUrlContent(result.url, authToken)
          if (extracted && extracted.content.split(/\s+/).length >= MIN_WORDS) {
            content = extracted.content
            if (extracted.title) title = extracted.title
          }
        } catch {
          pipelineLog('info', `Extract failed for ${result.url}, using snippet`)
        }

        // Fall back to Tavily snippet if extract failed
        if (!content && result.content.split(/\s+/).length >= MIN_WORDS) {
          content = result.content
        }

        if (!content || content.split(/\s+/).length < MIN_WORDS) continue

        usedUrls.add(result.url)
        return {
          slot,
          title,
          sourceUrl: result.url,
          rawContent: content.slice(0, 80000),
        }
      }
    } catch (err) {
      pipelineLog('warn', `Web search "${query}" failed: ${(err as Error).message}`)
    }
  }
  return null
}

// ─── Workflow factory ───────────────────────────────────────────

export function createSyntheseRealGenerationWorkflow(config: SyntheseRealGenerationConfig): WorkflowDefinition<void> {
  return {
    id: 'synthesis-generation',
    name: 'Generate Note de Synthèse (Real Documents)',
    steps: [
      // ── Step 1: Gather context ────────────────────────────────
      dbQueryStep<{ topics: string[]; avoidThemes: string[] }>('gatherContext', 'Gathering your study data', async (ctx) => {
        const topics = await db.topics.where('examProfileId').equals(ctx.examProfileId).toArray()
        const topicNames = topics.map(t => t.name)

        const pastSessions = await db.practiceExamSessions
          .where('examProfileId').equals(ctx.examProfileId)
          .filter(s => s.examMode === 'synthesis' && !!s.dossierBlueprint)
          .toArray()
        const avoidThemes = pastSessions
          .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
          .slice(0, 3)
          .map(s => {
            try { return (JSON.parse(s.dossierBlueprint!) as RealDossierBlueprint).theme } catch { return '' }
          })
          .filter(Boolean)

        return { topics: topicNames, avoidThemes }
      }),

      // ── Step 2: Theme Architect (with retry) ──────────────────
      {
        id: 'themeArchitect',
        name: 'Designing dossier blueprint',
        async execute(_input: unknown, ctx: WorkflowContext): Promise<RealDossierBlueprint> {
          const context = ctx.results['gatherContext'].data as { topics: string[]; avoidThemes: string[] }
          const { system, user } = buildRealThemeArchitectPrompt({
            topics: context.topics,
            avoidThemes: context.avoidThemes,
          })

          let blueprint: RealDossierBlueprint | null = null
          for (let attempt = 0; attempt < 2; attempt++) {
            ctx.updateProgress?.(attempt === 0
              ? 'Designing the dossier theme and structure...'
              : 'Retrying blueprint generation...')
            try {
              const raw = await llmCall(user, system, ctx, 8192)
              blueprint = extractJson<RealDossierBlueprint>(raw)
              if (blueprint.theme && blueprint.documentSlots && blueprint.documentSlots.length >= 8) break
              blueprint = null
            } catch {
              if (attempt === 1) throw new Error('Failed to generate blueprint after 2 attempts.')
            }
          }

          if (!blueprint) throw new Error('Blueprint validation failed.')

          await db.practiceExamSessions.update(config.sessionId, {
            dossierBlueprint: JSON.stringify(blueprint),
          })
          return blueprint
        },
      },

      // ── Step 3: Source real documents ──────────────────────────
      {
        id: 'documentSourcing',
        name: 'Finding real legal documents',
        async execute(_input: unknown, ctx: WorkflowContext): Promise<SourcedDocument[]> {
          const blueprint = ctx.results['themeArchitect'].data as RealDossierBlueprint
          const sourced: SourcedDocument[] = []
          const usedJudilibreIds = new Set<string>()
          const usedWebUrls = new Set<string>()

          // Process slots sequentially to avoid rate limits
          for (let i = 0; i < blueprint.documentSlots.length; i++) {
            const slot = blueprint.documentSlots[i]
            ctx.updateProgress?.(`Finding document ${i + 1}/${blueprint.documentSlots.length}: ${slot.type}...`)

            let doc: SourcedDocument | null = null
            try {
              if (slot.type === 'jurisprudence-cass') {
                doc = await sourceFromJudilibre(slot, ctx.authToken, usedJudilibreIds)
              } else if (slot.type === 'legislation') {
                doc = await sourceFromLegifrance(slot, ctx.authToken)
                if (!doc) doc = await sourceFromWeb(slot, ctx.authToken, usedWebUrls)
              } else {
                doc = await sourceFromWeb(slot, ctx.authToken, usedWebUrls)
              }
            } catch (err) {
              pipelineLog('warn', `Slot ${i + 1} (${slot.type}) failed: ${(err as Error).message}`)
            }

            if (doc) {
              sourced.push(doc)
            } else {
              pipelineLog('warn', `Slot ${i + 1} (${slot.type}): no document found`)
            }
          }

          // Balance validation — try to fill gaps
          const typeCounts = {
            jurisprudence: sourced.filter(d => d.slot.type.startsWith('jurisprudence')).length,
            legislation: sourced.filter(d => d.slot.type === 'legislation').length,
            other: sourced.filter(d => !d.slot.type.startsWith('jurisprudence') && d.slot.type !== 'legislation').length,
          }

          if (typeCounts.jurisprudence < 2) {
            pipelineLog('warn', `Dossier imbalanced: only ${typeCounts.jurisprudence} jurisprudence — attempting supplemental searches`)
            // Try up to 2 supplemental searches
            for (let attempt = 0; attempt < 2; attempt++) {
              if (sourced.filter(d => d.slot.type.startsWith('jurisprudence')).length >= 2) break
              try {
                const suppSlot: DocumentSlot = {
                  slotNumber: 99 - attempt, type: 'jurisprudence-cass',
                  description: 'Supplemental case law',
                  feedsPlanSection: attempt === 0 ? 'IA' : 'IIA',
                  searchQueries: [blueprint.theme, blueprint.problematique],
                }
                const doc = await sourceFromJudilibre(suppSlot, ctx.authToken, usedJudilibreIds)
                if (doc) sourced.push(doc)
              } catch { /* best effort */ }
            }
            const postCount = sourced.filter(d => d.slot.type.startsWith('jurisprudence')).length
            if (postCount < 2) {
              pipelineLog('warn', `Still only ${postCount} jurisprudence doc(s) after supplemental — dossier may be imbalanced`)
            }
          }

          if (typeCounts.legislation < 1) {
            pipelineLog('warn', 'Dossier imbalanced: no legislation — attempting supplemental search')
            try {
              const suppSlot: DocumentSlot = {
                slotNumber: 98, type: 'legislation',
                description: 'Supplemental legislation',
                feedsPlanSection: 'IA',
                searchQueries: [blueprint.theme],
              }
              const doc = await sourceFromLegifrance(suppSlot, ctx.authToken)
              if (doc) sourced.push(doc)
            } catch { /* best effort */ }
          }

          if (sourced.length < 5) {
            throw new Error(`Only sourced ${sourced.length} documents. Need at least 5 for a viable dossier.`)
          }

          return sourced
        },
      },

      // ── Step 4: Curate excerpts (LLM) ─────────────────────────
      {
        id: 'documentCuration',
        name: 'Curating document excerpts',
        async execute(_input: unknown, ctx: WorkflowContext): Promise<RealDossierDocument[]> {
          const blueprint = ctx.results['themeArchitect'].data as RealDossierBlueprint
          const sourced = ctx.results['documentSourcing'].data as SourcedDocument[]
          const curated: RealDossierDocument[] = []

          for (let i = 0; i < sourced.length; i++) {
            const src = sourced[i]
            ctx.updateProgress?.(`Curating document ${i + 1}/${sourced.length}...`)

            // Legislation: use VERBATIM text — no LLM rewriting
            if (src.slot.type === 'legislation') {
              curated.push({
                docNumber: curated.length + 1,
                type: src.slot.type,
                title: src.title,
                sourceUrl: src.sourceUrl,
                content: src.rawContent,
              })
              continue
            }

            // Other types: LLM curation
            const { system, user } = buildDocumentCuratorPrompt(
              blueprint.theme,
              blueprint.problematique,
              src.slot,
              src.rawContent,
              src.title,
              src.sourceUrl,
            )

            try {
              const excerpt = await llmCall(user, system, ctx, 4096)
              const excerptText = excerpt.trim()
              const excerptWords = excerptText.split(/\s+/).length

              // If LLM returned garbage (< 400 words), fall back to raw content
              if (excerptWords < 400) {
                pipelineLog('warn', `Curation too short (${excerptWords}w) for "${src.title}" — using raw`)
                curated.push({
                  docNumber: curated.length + 1,
                  type: src.slot.type,
                  title: src.title,
                  sourceUrl: src.sourceUrl,
                  content: src.rawContent.slice(0, 5000),
                })
                continue
              }

              // Post-curation verification: check key legal references preserved
              const refPattern = /(?:n°\s*[\d\-\.]+|\d{1,2}\s+(?:janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\s+\d{4}|art(?:icle)?\.?\s*[A-Z]?\d[\d\-]*)/gi
              const rawRefs = new Set<string>()
              let m: RegExpExecArray | null
              while ((m = refPattern.exec(src.rawContent.slice(0, 10000))) !== null) {
                rawRefs.add(m[0].toLowerCase().trim())
              }
              if (rawRefs.size > 3) {
                let found = 0
                for (const ref of rawRefs) {
                  if (excerptText.toLowerCase().includes(ref)) found++
                }
                if (found / rawRefs.size < 0.4) {
                  pipelineLog('warn', `Curation lost references (${found}/${rawRefs.size}) for "${src.title}" — using raw`)
                  curated.push({
                    docNumber: curated.length + 1,
                    type: src.slot.type,
                    title: src.title,
                    sourceUrl: src.sourceUrl,
                    content: src.rawContent.slice(0, 5000),
                  })
                  continue
                }
              }

              curated.push({
                docNumber: curated.length + 1,
                type: src.slot.type,
                title: src.title,
                sourceUrl: src.sourceUrl,
                content: excerptText,
              })
            } catch (err) {
              pipelineLog('warn', `Curation LLM failed for "${src.title}": ${(err as Error).message}`)
              curated.push({
                docNumber: curated.length + 1,
                type: src.slot.type,
                title: src.title,
                sourceUrl: src.sourceUrl,
                content: src.rawContent.slice(0, 5000),
              })
            }
          }

          // Persist curated documents
          await db.practiceExamSessions.update(config.sessionId, {
            dossierContent: JSON.stringify(curated),
          })

          return curated
        },
      },

      // ── Step 5: Model Synthesis Writer ─────────────────────────
      {
        id: 'modelSynthesisWriter',
        name: 'Writing model synthesis',
        async execute(_input: unknown, ctx: WorkflowContext): Promise<string> {
          const blueprint = ctx.results['themeArchitect'].data as RealDossierBlueprint
          const documents = ctx.results['documentCuration'].data as RealDossierDocument[]

          const { system, user } = buildRealModelSynthesisPrompt(blueprint, documents)

          ctx.updateProgress?.('Writing the model synthesis...')
          const synthesis = await llmCall(user, system, ctx, 12000)

          await db.practiceExamSessions.update(config.sessionId, {
            synthesisModelAnswer: synthesis.trim(),
          })
          return synthesis.trim()
        },
      },

      // ── Step 6: Quality pass (coverage + length + tone) ────────
      {
        id: 'synthesisQualityPass',
        name: 'Quality checking synthesis',
        optional: true,
        async execute(_input: unknown, ctx: WorkflowContext): Promise<string> {
          let synthesis = ctx.results['modelSynthesisWriter'].data as string
          const documents = ctx.results['documentCuration'].data as RealDossierDocument[]

          // Pass C: Tone cleanup (deterministic, instant)
          ctx.updateProgress?.('Cleaning synthesis tone...')
          synthesis = cleanDissertationTone(synthesis)

          // Pass A: Coverage check
          ctx.updateProgress?.('Checking document coverage...')
          const citedDocNumbers = new Set<number>()
          const citationRegex = /\(Doc\.\s*(\d+)\)/gi
          let match: RegExpExecArray | null
          while ((match = citationRegex.exec(synthesis)) !== null) {
            citedDocNumbers.add(parseInt(match[1], 10))
          }
          const uncitedDocs = documents.filter(d => !citedDocNumbers.has(d.docNumber))

          // Pass B: Length check
          const wordCount = synthesis.trim().split(/\s+/).length
          const needsExpansion = wordCount < 2200

          // Combined LLM call if needed
          if (uncitedDocs.length > 0 || needsExpansion) {
            const issueDesc = uncitedDocs.length > 0 && needsExpansion
              ? `Patching ${uncitedDocs.length} uncited docs + expanding (${wordCount} words)...`
              : uncitedDocs.length > 0
              ? `Inserting references to ${uncitedDocs.length} uncited documents...`
              : `Expanding synthesis (${wordCount}/2400 words)...`
            ctx.updateProgress?.(issueDesc)

            const { system, user } = buildQualityPatchPrompt(synthesis, uncitedDocs, wordCount, needsExpansion)
            const improved = await llmCall(user, system, ctx, 12000)
            if (improved.trim().length > synthesis.length * 0.5) {
              // Only accept if the LLM returned something substantial
              synthesis = improved.trim()
            }
          } else {
            ctx.updateProgress?.('Synthesis quality OK — no patches needed')
          }

          // Persist improved synthesis
          await db.practiceExamSessions.update(config.sessionId, {
            synthesisModelAnswer: synthesis,
          })
          return synthesis
        },
      },

      // ── Step 7: Grading Rubric Builder ─────────────────────────
      {
        id: 'gradingRubricBuilder',
        name: 'Creating grading rubric',
        async execute(_input: unknown, ctx: WorkflowContext): Promise<string> {
          const blueprint = ctx.results['themeArchitect'].data as RealDossierBlueprint
          const documents = ctx.results['documentCuration'].data as RealDossierDocument[]
          // Fallback chain: quality pass → original synthesis → DB read (handles checkpoint resume)
          const modelSynthesis = (
            ctx.results['synthesisQualityPass']?.data
            ?? ctx.results['modelSynthesisWriter']?.data
            ?? (await db.practiceExamSessions.get(config.sessionId))?.synthesisModelAnswer
            ?? ''
          ) as string

          const { system, user } = buildRealGradingRubricPrompt(blueprint, documents, modelSynthesis)

          ctx.updateProgress?.('Building grading rubric...')
          const raw = await llmCall(user, system, ctx, 4096)

          let rubricJson: string
          try {
            const rubric = extractJson<Record<string, unknown>>(raw)
            rubricJson = JSON.stringify(rubric)
          } catch {
            rubricJson = JSON.stringify({
              criteria: [
                { criterion: 'Citation de tous les documents', points: 4 },
                { criterion: 'Plan structuré (I/A, I/B, II/A, II/B)', points: 3 },
                { criterion: 'Problématique pertinente', points: 2 },
                { criterion: 'Qualité de la synthèse (restitution, pas dissertation)', points: 4 },
                { criterion: 'Neutralité (absence d\'avis personnel)', points: 2 },
                { criterion: 'Respect de la limite de 4 pages', points: 1 },
                { criterion: 'Qualité rédactionnelle', points: 2 },
                { criterion: 'Équilibre entre les parties', points: 2 },
              ],
              totalPoints: 20,
              documentCoverageMap: {},
            })
          }

          await db.practiceExamSessions.update(config.sessionId, {
            synthesisRubric: rubricJson,
          })
          return rubricJson
        },
      },
    ],

    // ── Aggregate: mark session ready ─────────────────────────────
    async aggregate(): Promise<void> {
      const session = await db.practiceExamSessions.get(config.sessionId)
      if (!session?.dossierContent) {
        throw new Error('Synthesis generation failed — no dossier content.')
      }

      let docCount = 0
      try {
        const docs = JSON.parse(session.dossierContent) as RealDossierDocument[]
        docCount = docs.length
      } catch { /* ignore */ }

      await db.practiceExamSessions.update(config.sessionId, {
        phase: 'ready',
        questionCount: docCount,
        timeLimitSeconds: 5 * 3600, // 5 hours
      })
    },
  }
}
