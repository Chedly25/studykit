/**
 * CRFPA legal fiches generation + enrichment pipeline.
 *
 *  Flow of `generateLegalFiche`:
 *   1. Assemble grounding pool (searchLegalCodes on theme seeds, dedup, cap).
 *   2. Retrieve her cours chunks via `searchUserCours` (may be empty).
 *   3. Opus 4.7 generates fiche in Markdown, constrained to the pool.
 *   4. Fast regex check: every Art. X cited appears in the pool.
 *   5. Sonnet verification pass (invented / misrepresented / cours-fabricated).
 *   6. One retry with failure feedback; else throw InventedReferencesError.
 *   7. Detect ACTUALITE_WEB_PENDING marker; return hasActualiteMarker flag.
 *
 *  Flow of `enrichFicheActualite`:
 *   1. Tavily search scoped to allowlisted domains for the matière.
 *   2. If no results → return "Aucune actualité…" string, not-needed status.
 *   3. Sonnet synthesizes 2-4 entries citing Tavily URLs.
 *   4. URL allowlist gate on the synthesized output; one retry if off-list.
 *   5. Replace marker in fiche content with synthesized snippet.
 */

import { db } from '../../db'
import { searchLegalCodes } from '../tools/legalSearchTool'
import { searchUserCours, type UserCoursResult } from '../tools/userCoursSearchTool'
import { tavilySearch, TavilyUnavailableError } from '../tools/tavilyClient'
import { coachingCallJson, coachingCall } from './coachingClient'
import { parseSearchResults } from './searchHelpers'
import { InventedReferencesError } from './coachingErrors'
import {
  ACTUALITE_MARKER,
  TAVILY_DOMAINS,
  buildLegalFicheActualitePrompt,
  buildLegalFicheGenerationPrompt,
  buildLegalFicheVerificationPrompt,
  findThemeById,
  type FicheMatiere,
  type LegalFicheActualiteTavilyResult,
  type LegalFicheUserCoursChunk,
  type LegalFicheVerificationResult,
} from '../prompts/legalFichePrompts'
import { findOffAllowlistUrls } from '../../lib/domainAllowlist'
import type {
  CasPratiqueGroundingEntry,
} from './types'

// ─── Tunables ────────────────────────────────────────────────────

const TOP_K_PER_SEED = 5
const MAX_POOL_SIZE = 25
const USER_COURS_TOP_K = 15
const GENERATION_MAX_TOKENS = 8000
const VERIFICATION_MAX_TOKENS = 3000
const ACTUALITE_MAX_TOKENS = 1500

// ─── Pool assembly ───────────────────────────────────────────────

async function assembleGroundingPool(
  seeds: string[],
  authToken: string,
): Promise<CasPratiqueGroundingEntry[]> {
  if (seeds.length === 0) return []
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

/** Same regex pass as cas pratique — any Art. X cited in the content must appear in the pool. */
function findPoolMisses(content: string, pool: CasPratiqueGroundingEntry[]): string[] {
  const articlePattern = /\b(?:art(?:icle)?\.?\s+)(L?\.?\s*)?(\d+(?:[-–]\d+)?)\b/gi
  const cited = new Set<string>()
  for (const m of content.matchAll(articlePattern)) {
    const prefix = (m[1] ?? '').replace(/[.\s]/g, '').toUpperCase()
    const num = m[2].replace(/[–]/g, '-')
    cited.add(`${prefix}${num}`)
  }
  const poolNums = new Set(pool.map(e => {
    return e.articleNum.replace(/[.\s]/g, '').toUpperCase().replace(/[–]/g, '-')
  }))
  const misses: string[] = []
  for (const c of cited) {
    if (!poolNums.has(c)) misses.push(c)
  }
  return misses
}

async function runLlmVerification(
  opts: {
    groundingPool: CasPratiqueGroundingEntry[]
    userCoursChunks: LegalFicheUserCoursChunk[]
    ficheMarkdown: string
    authToken: string
    getToken?: () => Promise<string | null>
    signal?: AbortSignal
  },
): Promise<LegalFicheVerificationResult> {
  const { system, user } = buildLegalFicheVerificationPrompt({
    groundingPool: opts.groundingPool,
    userCoursChunks: opts.userCoursChunks,
    ficheMarkdown: opts.ficheMarkdown,
  })
  return coachingCallJson<LegalFicheVerificationResult>({
    system,
    user,
    maxTokens: VERIFICATION_MAX_TOKENS,
    authToken: opts.authToken,
    getToken: opts.getToken,
    signal: opts.signal,
    model: 'sonnet',
  })
}

// ─── Generation ──────────────────────────────────────────────────

export interface GenerateLegalFicheOpts {
  theme: string
  themeId?: string
  matiere?: FicheMatiere
  source: 'theme' | 'cours' | 'custom'
  customQuery?: string
  examProfileId: string
  /**
   * When source='cours' and documentId is set, the cours RAG is scoped to that
   * single document rather than fuzzy-searching across all her uploads.
   */
  documentId?: string
  authToken: string
  getToken?: () => Promise<string | null>
  signal?: AbortSignal
}

export interface LegalFicheGenerationResult {
  content: string
  groundingPool: CasPratiqueGroundingEntry[]
  userCoursChunks: UserCoursResult[]
  /** True when the Opus output contains <!-- ACTUALITE_WEB_PENDING --> */
  hasActualiteMarker: boolean
}

function coursResultToPromptChunk(r: UserCoursResult): LegalFicheUserCoursChunk {
  return {
    chunkId: r.chunkId,
    documentTitle: r.documentTitle,
    content: r.content,
  }
}

/** Soft detection: explicit marker OR empty Actualité section → treat as marker present. */
function detectActualiteMarker(content: string): boolean {
  if (content.includes(ACTUALITE_MARKER)) return true
  // Fallback: `### Actualité` section present but has < 3 non-whitespace chars before next heading
  const match = content.match(/###\s+Actualit[eé][^\n]*\n([\s\S]*?)(?=\n##|\n###|$)/)
  if (!match) return false
  const body = match[1].trim()
  if (body.length === 0) return true
  // Only whitespace / headings / comment-ish
  if (/^<!--[\s\S]*-->\s*$/.test(body)) return true
  return false
}

async function runGeneration(
  opts: GenerateLegalFicheOpts,
  pool: CasPratiqueGroundingEntry[],
  coursChunks: UserCoursResult[],
  previousFailures: string[] | undefined,
): Promise<string> {
  const theme = opts.themeId ? findThemeById(opts.themeId) : undefined
  const matiere: FicheMatiere | undefined = opts.matiere ?? theme?.matiere
  const { system, user } = buildLegalFicheGenerationPrompt({
    theme: opts.theme,
    matiere,
    groundingPool: pool,
    userCoursChunks: coursChunks.map(coursResultToPromptChunk),
    previousFailures,
    customQuery: opts.customQuery,
  })
  // Opus returns raw Markdown, NOT JSON — use coachingCall not coachingCallJson.
  const raw = await coachingCall({
    system,
    user,
    maxTokens: GENERATION_MAX_TOKENS,
    authToken: opts.authToken,
    getToken: opts.getToken,
    signal: opts.signal,
    model: 'opus',
  })
  // Strip any surrounding code fences the model may have emitted despite the instruction.
  return stripMarkdownFences(raw).trim()
}

function stripMarkdownFences(text: string): string {
  const fenced = text.match(/```(?:markdown|md)?\s*([\s\S]*?)```/i)
  return fenced ? fenced[1] : text
}

async function fetchCoursChunksForSource(opts: GenerateLegalFicheOpts): Promise<UserCoursResult[]> {
  // source='cours' + documentId: scope strictly to that document, take up to USER_COURS_TOP_K
  // leading chunks (keeps prof's exposition contiguous rather than semantic-cherry-picked).
  if (opts.source === 'cours' && opts.documentId) {
    try {
      const doc = await db.documents.get(opts.documentId)
      const chunks = await db.documentChunks
        .where('documentId').equals(opts.documentId)
        .sortBy('chunkIndex')
      const picked = chunks.slice(0, USER_COURS_TOP_K)
      return picked.map(c => ({
        chunkId: c.id,
        documentId: c.documentId,
        documentTitle: doc?.title,
        chunkIndex: c.chunkIndex,
        content: c.content,
        score: 1,
      }))
    } catch {
      return []
    }
  }
  // Theme / custom / cours-without-id: semantic search across all her cours
  const query = opts.theme + (opts.customQuery ? ' ' + opts.customQuery : '')
  try {
    return await searchUserCours(query, opts.examProfileId, opts.authToken, {
      topK: USER_COURS_TOP_K,
      minScore: 0.35,
    })
  } catch {
    return []
  }
}

export async function generateLegalFiche(opts: GenerateLegalFicheOpts): Promise<LegalFicheGenerationResult> {
  const theme = opts.themeId ? findThemeById(opts.themeId) : undefined
  const seeds = theme?.searchSeeds ?? [opts.customQuery ?? opts.theme]

  // 1 + 2: pool + cours in parallel
  const [pool, coursRaw] = await Promise.all([
    assembleGroundingPool(seeds, opts.authToken),
    fetchCoursChunksForSource(opts),
  ])

  if (pool.length === 0) {
    throw new Error('Pool de références vide — impossible de générer une fiche fiable.')
  }

  // 3: Opus generation
  let content = await runGeneration(opts, pool, coursRaw, undefined)

  // 4: regex check
  let misses = findPoolMisses(content, pool)
  // 5: LLM verify
  let verification: LegalFicheVerificationResult = misses.length > 0
    ? {
        passed: false,
        issues: misses.map(m => ({
          citation: `Article ${m}`,
          claim: 'Cité dans la fiche',
          reason: `L'article ${m} est cité mais n'apparaît pas dans le pool autorisé.`,
          severity: 'invented' as const,
        })),
      }
    : await runLlmVerification({
        groundingPool: pool,
        userCoursChunks: coursRaw.map(coursResultToPromptChunk),
        ficheMarkdown: content,
        authToken: opts.authToken,
        getToken: opts.getToken,
        signal: opts.signal,
      })

  // 6: retry once
  if (!verification.passed) {
    const failures = verification.issues.map(issueToFeedback)
    content = await runGeneration(opts, pool, coursRaw, failures)
    misses = findPoolMisses(content, pool)
    verification = misses.length > 0
      ? {
          passed: false,
          issues: misses.map(m => ({
            citation: `Article ${m}`,
            claim: 'Cité dans la fiche',
            reason: `L'article ${m} reste absent du pool après retry.`,
            severity: 'invented' as const,
          })),
        }
      : await runLlmVerification({
          groundingPool: pool,
          userCoursChunks: coursRaw.map(coursResultToPromptChunk),
          ficheMarkdown: content,
          authToken: opts.authToken,
          getToken: opts.getToken,
          signal: opts.signal,
        })
    if (!verification.passed) {
      throw new InventedReferencesError(verification.issues.map(issueToFeedback))
    }
  }

  return {
    content,
    groundingPool: pool,
    userCoursChunks: coursRaw,
    hasActualiteMarker: detectActualiteMarker(content),
  }
}

function issueToFeedback(issue: { citation: string; claim: string; reason: string; severity: string }): string {
  const label = issue.severity === 'invented' ? 'INVENTÉ'
    : issue.severity === 'misrepresented' ? 'DÉNATURÉ'
    : 'COURS-FABRIQUÉ'
  return `${label} — ${issue.citation} : ${issue.reason}`
}

// ─── Enrichment (Tavily → Sonnet) ────────────────────────────────

export interface EnrichFicheActualiteOpts {
  theme: string
  matiere: FicheMatiere
  authToken: string
  getToken?: () => Promise<string | null>
  signal?: AbortSignal
}

export interface EnrichFicheActualiteResult {
  /** Markdown snippet to substitute for the marker (or the "no actualité" fallback line). */
  snippet: string
  /** How to mark status when persisting. */
  status: 'auto-enriched' | 'manually-enriched' | 'not-needed' | 'failed'
  error?: string
}

const NO_ACTUALITE_LINE = '*Aucune actualité récente identifiable dans les sources consultées.*'

export async function enrichFicheActualite(
  opts: EnrichFicheActualiteOpts,
  statusOnSuccess: 'auto-enriched' | 'manually-enriched' = 'auto-enriched',
): Promise<EnrichFicheActualiteResult> {
  const allowlist = TAVILY_DOMAINS[opts.matiere]
  if (!allowlist || allowlist.length === 0) {
    return { snippet: NO_ACTUALITE_LINE, status: 'not-needed' }
  }

  // 1: Tavily
  let results: LegalFicheActualiteTavilyResult[] = []
  try {
    const tavilyOut = await tavilySearch(
      {
        query: `${opts.theme} jurisprudence 2024 2025 2026`,
        includeDomains: allowlist,
        maxResults: 10,
        topic: 'general',
        days: 540,
      },
      opts.authToken,
      opts.signal,
    )
    results = tavilyOut.results.map(r => ({
      url: r.url,
      title: r.title,
      content: r.content,
      publishedDate: r.publishedDate,
    }))
  } catch (err) {
    if (err instanceof TavilyUnavailableError) {
      return { snippet: NO_ACTUALITE_LINE, status: 'failed', error: err.message }
    }
    throw err
  }

  if (results.length === 0) {
    return { snippet: NO_ACTUALITE_LINE, status: 'not-needed' }
  }

  // 2: Sonnet synthesis
  const { system, user } = buildLegalFicheActualitePrompt({
    theme: opts.theme,
    matiere: opts.matiere,
    tavilyResults: results,
  })

  const attempt = async (sys: string): Promise<string> => {
    const raw = await coachingCall({
      system: sys,
      user,
      maxTokens: ACTUALITE_MAX_TOKENS,
      authToken: opts.authToken,
      getToken: opts.getToken,
      signal: opts.signal,
      model: 'sonnet',
    })
    return raw.trim()
  }

  let snippet = await attempt(system)

  // 3: URL allowlist gate; one retry if off-list
  let offList = findOffAllowlistUrls(snippet, allowlist)
  if (offList.length > 0) {
    const retrySystem = `${system}\n\nATTENTION : la tentative précédente a cité des URL INTERDITES : ${offList.join(', ')}. Ces URL ne figurent PAS dans la liste autorisée. N'utilise que des URL de la liste autorisée explicitement.`
    snippet = await attempt(retrySystem)
    offList = findOffAllowlistUrls(snippet, allowlist)
    if (offList.length > 0) {
      return {
        snippet: NO_ACTUALITE_LINE,
        status: 'failed',
        error: `URL hors allowlist après retry: ${offList.slice(0, 2).join(', ')}`,
      }
    }
  }

  // Sanity: require at least one entry with a markdown URL link OR the fallback line
  const hasAnyLink = /\[[^\]]+\]\(https?:\/\//.test(snippet)
  if (!hasAnyLink && !snippet.includes('Aucune actualité')) {
    // Sonnet returned prose without links — treat as failure
    return {
      snippet: NO_ACTUALITE_LINE,
      status: 'failed',
      error: 'Synthèse Tavily sans lien source',
    }
  }

  return { snippet, status: statusOnSuccess }
}

/**
 * Replace the ACTUALITE_WEB_PENDING marker in the fiche content with
 * the enrichment snippet. If the marker isn't present (edge case),
 * we try to locate the Actualité subsection and inject the snippet
 * inside it; otherwise we leave the fiche unchanged and return null.
 */
export function applyActualiteSnippet(content: string, snippet: string): string | null {
  if (content.includes(ACTUALITE_MARKER)) {
    return content.replace(ACTUALITE_MARKER, snippet)
  }
  // Fallback: find `### Actualité` section and replace its body
  const sectionRx = /(###\s+Actualit[eé][^\n]*\n)([\s\S]*?)(?=\n##\s|\n###\s|$)/
  if (sectionRx.test(content)) {
    return content.replace(sectionRx, (_match, heading) => `${heading}\n${snippet}\n`)
  }
  return null
}
