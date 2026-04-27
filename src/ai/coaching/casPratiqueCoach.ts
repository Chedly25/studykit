/**
 * Cas pratique / consultation juridique coach.
 *
 * Flow:
 *  1. generateCasPratiqueScenario:
 *     a. Assemble a grounding pool by fanning out searchLegalCodes on specialty seeds.
 *     b. Call Opus 4.7 with pool injected as the only authorized citation surface.
 *     c. Fast regex check: every Art. X mentioned in modelAnswer must be in the pool.
 *     d. LLM verification pass (Sonnet): flag any invented or misrepresented references.
 *     e. One retry with failure feedback if either check fails.
 *     f. Throw InventedReferencesError if retry also fails.
 *  2. gradeCasPratiqueSubmission:
 *     Sonnet + full task context including groundingPool, six-axis rubric /20.
 *
 * Uses coachingCallJson — no workflow orchestrator.
 */

import { searchLegalCodes } from '../tools/legalSearchTool'
import { coachingCallJson } from './coachingClient'
import { parseSearchResults } from './searchHelpers'
import { InventedReferencesError } from './coachingErrors'
import {
  SPECIALTY_OPTIONS,
  SPECIALTY_SEARCH_SEEDS,
  buildCasPratiqueGenerationPrompt,
  buildCasPratiqueGradingPrompt,
  buildCasPratiqueVerificationPrompt,
} from '../prompts/casPratiquePrompts'
import type {
  CasPratiqueSpecialty,
  CasPratiqueVerificationResult,
} from '../prompts/casPratiquePrompts'
import type {
  CasPratiqueGrading,
  CasPratiqueGroundingEntry,
  CasPratiqueSubmission,
  CasPratiqueTask,
} from './types'

const TOP_K_PER_SEED = 5
const MAX_POOL_SIZE = 25
const GENERATION_MAX_TOKENS = 8000    // scenario + modelAnswer + issues combined
const VERIFICATION_MAX_TOKENS = 3000
const GRADING_MAX_TOKENS = 4000

// ─── Pool assembly ───────────────────────────────────────────────

/**
 * Fan out searchLegalCodes across the specialty seeds, flatten + dedupe by
 * (codeName, articleNum), cap at MAX_POOL_SIZE to keep Opus context sane.
 * Tolerant of individual seed failures — we keep whatever came back.
 */
async function assembleGroundingPool(
  specialty: CasPratiqueSpecialty,
  authToken: string,
): Promise<CasPratiqueGroundingEntry[]> {
  const seeds = SPECIALTY_SEARCH_SEEDS[specialty]
  if (!seeds?.length) return []

  const searches = await Promise.all(
    seeds.map(async seed => {
      try {
        const raw = await searchLegalCodes(seed, authToken, { topK: TOP_K_PER_SEED })
        return parseSearchResults(raw)
      } catch {
        return []
      }
    }),
  )

  const seen = new Set<string>()
  const pool: CasPratiqueGroundingEntry[] = []
  for (const results of searches) {
    for (const entry of results) {
      const key = `${entry.codeName}::${entry.articleNum}`
      if (seen.has(key)) continue
      seen.add(key)
      pool.push(entry)
      if (pool.length >= MAX_POOL_SIZE) break
    }
    if (pool.length >= MAX_POOL_SIZE) break
  }
  return pool
}

// ─── Verification ────────────────────────────────────────────────

/**
 * Fast regex check: extract every "Art. NNN" pattern from the model answer
 * and require that each appears in the pool. Catches pure hallucinations
 * before spending a verification LLM call.
 *
 * Returns a list of articles that are cited but absent from the pool.
 */
function findPoolMisses(modelAnswer: string, pool: CasPratiqueGroundingEntry[]): string[] {
  // Matches "Art. 1231-1", "article 1231-1", "article L. 1231-1", "art. L1231-3"
  const articlePattern = /\b(?:art(?:icle)?\.?\s+)(L?\.?\s*)?(\d+(?:[-–]\d+)?)\b/gi
  const cited = new Set<string>()
  for (const m of modelAnswer.matchAll(articlePattern)) {
    // Normalize: strip spaces/dots, uppercase L prefix
    const prefix = (m[1] ?? '').replace(/[.\s]/g, '').toUpperCase()
    const num = m[2].replace(/[–]/g, '-')
    cited.add(`${prefix}${num}`)
  }

  const poolNums = new Set(pool.map(e => {
    const normalized = e.articleNum.replace(/[.\s]/g, '').toUpperCase().replace(/[–]/g, '-')
    return normalized
  }))

  const misses: string[] = []
  for (const c of cited) {
    if (!poolNums.has(c)) misses.push(c)
  }
  return misses
}

async function runLlmVerification(
  task: { scenario: string; modelAnswer: string; groundingPool: CasPratiqueGroundingEntry[] },
  authToken: string,
  getToken: (() => Promise<string | null>) | undefined,
  signal: AbortSignal | undefined,
): Promise<CasPratiqueVerificationResult> {
  const { system, user } = buildCasPratiqueVerificationPrompt({
    groundingPool: task.groundingPool,
    modelAnswer: task.modelAnswer,
    scenario: task.scenario,
  })
  return coachingCallJson<CasPratiqueVerificationResult>({
    system,
    user,
    maxTokens: VERIFICATION_MAX_TOKENS,
    authToken,
    getToken,
    signal,
    model: 'sonnet',
  })
}

// ─── Generation ──────────────────────────────────────────────────

interface GenerationOutput {
  scenario: string
  modelAnswer: string
  legalIssues: string[]
}

export interface GenerateCasPratiqueOpts {
  specialty: CasPratiqueSpecialty
  duration: number
  topics?: string[]
  avoidThemes?: string[]
  authToken: string
  getToken?: () => Promise<string | null>
  signal?: AbortSignal
}

async function runGeneration(
  opts: GenerateCasPratiqueOpts,
  pool: CasPratiqueGroundingEntry[],
  previousFailures: string[] | undefined,
): Promise<GenerationOutput> {
  const { system, user } = buildCasPratiqueGenerationPrompt({
    specialty: opts.specialty,
    duration: opts.duration,
    topics: opts.topics,
    avoidThemes: opts.avoidThemes,
    groundingPool: pool,
    previousFailures,
  })
  return coachingCallJson<GenerationOutput>({
    system,
    user,
    maxTokens: GENERATION_MAX_TOKENS,
    authToken: opts.authToken,
    getToken: opts.getToken,
    signal: opts.signal,
    model: 'opus',
  })
}

export async function generateCasPratiqueScenario(opts: GenerateCasPratiqueOpts): Promise<CasPratiqueTask> {
  const specialtyOption = SPECIALTY_OPTIONS.find(o => o.value === opts.specialty)
  const specialtyLabel = specialtyOption?.label ?? opts.specialty

  const pool = await assembleGroundingPool(opts.specialty, opts.authToken)
  if (pool.length === 0) {
    throw new Error('Pool de références vide — impossible de générer un cas pratique vérifiable.')
  }

  // Attempt 1
  let generated = await runGeneration(opts, pool, undefined)
  let verification = await verifyGeneration(generated, pool, opts)

  if (!verification.passed) {
    // Attempt 2 with feedback about what went wrong
    const failureMessages = verification.issues.map(issueToFeedback)
    generated = await runGeneration(opts, pool, failureMessages)
    verification = await verifyGeneration(generated, pool, opts)
  }

  if (!verification.passed) {
    throw new InventedReferencesError(verification.issues.map(issueToFeedback))
  }

  return {
    specialty: opts.specialty,
    specialtyLabel,
    duration: opts.duration,
    scenario: generated.scenario,
    modelAnswer: generated.modelAnswer,
    legalIssues: generated.legalIssues,
    groundingPool: pool,
    generatedAt: new Date().toISOString(),
  }
}

async function verifyGeneration(
  generated: GenerationOutput,
  pool: CasPratiqueGroundingEntry[],
  opts: GenerateCasPratiqueOpts,
): Promise<CasPratiqueVerificationResult> {
  const misses = findPoolMisses(generated.modelAnswer, pool)
  if (misses.length > 0) {
    return {
      passed: false,
      issues: misses.map(m => ({
        citation: `Article ${m}`,
        claim: 'Mentionné dans la consultation modèle',
        reason: `L'article ${m} est cité dans la consultation modèle mais n'apparaît pas dans le pool autorisé.`,
        severity: 'invented' as const,
      })),
    }
  }
  return runLlmVerification(
    { scenario: generated.scenario, modelAnswer: generated.modelAnswer, groundingPool: pool },
    opts.authToken,
    opts.getToken,
    opts.signal,
  )
}

function issueToFeedback(issue: { citation: string; claim: string; reason: string; severity: string }): string {
  return `${issue.severity === 'invented' ? 'INVENTÉ' : 'DÉNATURÉ'} — ${issue.citation} : ${issue.reason}`
}

// ─── Grading ─────────────────────────────────────────────────────

export interface GradeCasPratiqueOpts {
  task: CasPratiqueTask
  submission: CasPratiqueSubmission
  authToken: string
  getToken?: () => Promise<string | null>
  signal?: AbortSignal
}

type CasPratiqueGradingRaw = Omit<CasPratiqueGrading, 'gradedAt'>

export async function gradeCasPratiqueSubmission(opts: GradeCasPratiqueOpts): Promise<CasPratiqueGrading> {
  const { system, user } = buildCasPratiqueGradingPrompt({
    task: opts.task,
    submission: opts.submission,
  })

  const raw = await coachingCallJson<CasPratiqueGradingRaw>({
    system,
    user,
    maxTokens: GRADING_MAX_TOKENS,
    authToken: opts.authToken,
    getToken: opts.getToken,
    signal: opts.signal,
    model: 'sonnet',
  })

  return { ...raw, gradedAt: new Date().toISOString() }
}
