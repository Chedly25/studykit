/**
 * Grand Oral Coach — client-side orchestration for the voice simulator.
 *
 * Responsibilities:
 *   1. Pick a sujet from the seed corpus
 *   2. Ground it: resolve each ref via RAG (/api/legal-search) + merge preResolved
 *   3. Call Claude (via /api/legal-chat) with buildGrandOralGroundingPrompt to
 *      produce problématique + expected plan + keyPoints + subsidiaryQuestions
 *   4. Mint an OpenAI Realtime ephemeral token via /api/grand-oral/session
 *   5. Expose a tool handler (`buildJuryToolHandler`) the UI plumbs into the
 *      WebRTC data-channel event for function_call events
 *   6. Grade the finished session via Claude (/api/legal-chat)
 *
 * The actual WebRTC connection lives in the UI layer (not this file).
 */

import corpus from '../../data/grandOralSujets.json'
import { coachingCallJson } from './coachingClient'
import {
  buildGrandOralGroundingPrompt,
  buildGrandOralGradingPrompt,
  buildJuryQuestionPrompt,
  type GrandOralSujet,
  type GrandOralSujetType,
  type ResolvedRef,
} from '../prompts/grandOralPrompts'
import type {
  GrandOralGrading,
  GrandOralSubmission,
  GrandOralTask,
  JuryQuestionToolArgs,
  JuryQuestionToolResult,
} from './types'

const GROUNDING_MAX_TOKENS = 4000
const JURY_QUESTION_MAX_TOKENS = 800
const GRADING_MAX_TOKENS = 6000
const LEGAL_SEARCH_URL = '/api/legal-search'
const SESSION_URL = '/api/grand-oral/session'

const SUJETS = (corpus as { sujets: GrandOralSujet[] }).sujets

// ─── Pick a sujet ───────────────────────────────────────

export interface PickSujetOptions {
  type?: GrandOralSujetType
  theme?: string
  year?: number
  excludeIds?: string[]
}

export function pickGrandOralSujet(opts: PickSujetOptions = {}): GrandOralSujet {
  const pool = SUJETS.filter(s => {
    if (opts.type && s.type !== opts.type) return false
    if (opts.theme && s.theme !== opts.theme) return false
    if (opts.year && s.year !== opts.year) return false
    if (opts.excludeIds?.includes(s.id)) return false
    return true
  })
  if (pool.length === 0) {
    throw new Error('No sujet matches the filters')
  }
  return pool[Math.floor(Math.random() * pool.length)]
}

export function listAvailableThemes(): string[] {
  return Array.from(new Set(SUJETS.map(s => s.theme))).sort()
}

// ─── Resolve refs via RAG + preResolved ─────────────────

interface SearchResponse {
  results?: Array<{
    id: string
    score: number
    articleNum: string
    codeName: string
    breadcrumb: string
    text: string
  }>
}

async function fetchRagRef(query: string, authToken: string, signal?: AbortSignal): Promise<ResolvedRef | null> {
  const res = await fetch(LEGAL_SEARCH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
    body: JSON.stringify({ query, topK: 1 }),
    signal,
  })
  if (!res.ok) return null
  const data = (await res.json()) as SearchResponse
  const top = data.results?.[0]
  if (!top || !top.text) return null
  return {
    hint: query,
    source: top.breadcrumb || `${top.codeName} art. ${top.articleNum}`,
    text: top.text,
  }
}

export async function resolveRefs(
  sujet: GrandOralSujet,
  opts: { authToken: string; signal?: AbortSignal },
): Promise<ResolvedRef[]> {
  const out: ResolvedRef[] = []
  for (const ref of sujet.refs) {
    if (ref.preResolved) {
      out.push({
        hint: ref.hint,
        source: ref.preResolved.source,
        text: ref.preResolved.text,
      })
      continue
    }
    if (ref.query) {
      const r = await fetchRagRef(ref.query, opts.authToken, opts.signal)
      if (r) {
        out.push({ hint: ref.hint, source: r.source, text: r.text })
      } else {
        // RAG miss — keep a stub so the ref index doesn't shift
        out.push({ hint: ref.hint, source: ref.hint, text: `(référence non résolue — ${ref.hint})` })
      }
    }
  }
  return out
}

// ─── Ground sujet → full task ───────────────────────────

export interface LoadGrandOralTaskOpts {
  sujet: GrandOralSujet
  authToken: string
  getToken?: () => Promise<string | null>
  signal?: AbortSignal
}

type GroundingResponse = Omit<GrandOralTask, 'sujet' | 'resolvedRefs' | 'generatedAt'>

export async function loadGrandOralTask(opts: LoadGrandOralTaskOpts): Promise<GrandOralTask> {
  const resolvedRefs = await resolveRefs(opts.sujet, { authToken: opts.authToken, signal: opts.signal })
  const { system, user } = buildGrandOralGroundingPrompt(opts.sujet, resolvedRefs)

  const grounded = await coachingCallJson<GroundingResponse>({
    system,
    user,
    maxTokens: GROUNDING_MAX_TOKENS,
    authToken: opts.authToken,
    getToken: opts.getToken,
    signal: opts.signal,
  })

  return {
    sujet: opts.sujet,
    resolvedRefs,
    problematique: grounded.problematique,
    expectedPlan: grounded.expectedPlan,
    keyPoints: grounded.keyPoints,
    subsidiaryQuestions: grounded.subsidiaryQuestions,
    generatedAt: new Date().toISOString(),
  }
}

// ─── Start session (mint ephemeral token) ───────────────

export interface GrandOralSessionToken {
  sessionId: string
  clientSecret: string
  expiresAt: number
  model: string
  voice: string
}

export async function startGrandOralSession(
  task: GrandOralTask,
  opts: { authToken: string; signal?: AbortSignal },
): Promise<GrandOralSessionToken> {
  const res = await fetch(SESSION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${opts.authToken}` },
    body: JSON.stringify({
      task: {
        sujet: { id: task.sujet.id, text: task.sujet.text, type: task.sujet.type },
        problematique: task.problematique,
        expectedPlan: task.expectedPlan,
      },
    }),
    signal: opts.signal,
  })
  if (!res.ok) {
    const err = await res.text().catch(() => '')
    throw new Error(`Session mint failed: ${res.status} ${err.slice(0, 200)}`)
  }
  return res.json() as Promise<GrandOralSessionToken>
}

// ─── Jury question tool handler (called by UI on function_call events) ─

export interface JuryToolHandler {
  (args: JuryQuestionToolArgs): Promise<JuryQuestionToolResult>
}

export function buildJuryToolHandler(
  task: GrandOralTask,
  opts: { authToken: string; getToken?: () => Promise<string | null> },
): JuryToolHandler {
  return async (args: JuryQuestionToolArgs): Promise<JuryQuestionToolResult> => {
    const { system, user } = buildJuryQuestionPrompt({
      sujetText: task.sujet.text,
      type: task.sujet.type,
      expectedPlan: task.expectedPlan,
      keyPoints: task.keyPoints,
      resolvedRefs: task.resolvedRefs,
      exposeTranscript: args.exposeTranscript,
      qaSoFar: args.qaSoFar ?? '',
      alreadyAsked: args.alreadyAsked ?? [],
      difficulty: args.difficulty,
    })

    const result = await coachingCallJson<JuryQuestionToolResult>({
      system,
      user,
      maxTokens: JURY_QUESTION_MAX_TOKENS,
      authToken: opts.authToken,
      getToken: opts.getToken,
    })
    return result
  }
}

// ─── Final grading ──────────────────────────────────────

export interface GradeGrandOralOpts {
  task: GrandOralTask
  submission: GrandOralSubmission
  authToken: string
  getToken?: () => Promise<string | null>
  signal?: AbortSignal
}

type GradingRaw = Omit<GrandOralGrading, 'gradedAt'>

export async function gradeGrandOralSession(opts: GradeGrandOralOpts): Promise<GrandOralGrading> {
  const { system, user } = buildGrandOralGradingPrompt({
    sujetText: opts.task.sujet.text,
    type: opts.task.sujet.type,
    expectedPlan: opts.task.expectedPlan,
    keyPoints: opts.task.keyPoints,
    resolvedRefs: opts.task.resolvedRefs,
    fullTranscript: opts.submission.fullTranscript,
    durationSec: opts.submission.durationSec,
    exposeDurationSec: opts.submission.exposeDurationSec,
    interruptionCount: opts.submission.interruptionCount,
    avgLatencySec: opts.submission.avgLatencySec,
  })

  const raw = await coachingCallJson<GradingRaw>({
    system,
    user,
    maxTokens: GRADING_MAX_TOKENS,
    authToken: opts.authToken,
    getToken: opts.getToken,
    signal: opts.signal,
  })

  return { ...raw, gradedAt: new Date().toISOString() }
}
