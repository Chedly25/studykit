/**
 * Decision picker + grading for the CRFPA Fiche d'arrêt Trainer.
 *
 * Flow differs from Syllogisme/Plan — no scenario generation LLM call:
 *  1. pickFicheDecision: calls /api/random-decision with chamber filter → real Cour de cassation decision
 *  2. gradeFicheSubmission: builds grading prompt, one coachingCallJson → rubric
 */

import { coachingCallJson } from './coachingClient'
import { buildFicheArretGradingPrompt, FICHE_CHAMBERS } from '../prompts/ficheArretPrompts'
import type {
  FicheDecision,
  FicheGrading,
  FicheSubmission,
  FicheTask,
} from './types'

const RANDOM_DECISION_URL = (() => {
  const base = import.meta.env.VITE_API_URL
  if (!base) return '/api/random-decision'
  // VITE_API_URL often points at /api/chat; swap the tail
  return base.replace(/\/[^/]+$/, '/random-decision')
})()

const GRADING_MAX_TOKENS = 4000

export interface PickDecisionOpts {
  chamberId: string
  excludeIds?: string[]     // decision IDs already seen
  authToken: string
  signal?: AbortSignal
}

export async function pickFicheDecision(opts: PickDecisionOpts): Promise<FicheTask> {
  const chamber = FICHE_CHAMBERS.find(c => c.id === opts.chamberId)
  if (!chamber) throw new Error(`Unknown fiche chamber: ${opts.chamberId}`)

  const res = await fetch(RANDOM_DECISION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${opts.authToken}`,
    },
    body: JSON.stringify({
      codeName: chamber.codeName,
      excludeIds: opts.excludeIds ?? [],
    }),
    signal: opts.signal,
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`Random decision fetch failed (${res.status}): ${errText.slice(0, 200)}`)
  }

  const data = await res.json() as {
    id: string
    codeName: string
    reference: string
    breadcrumb?: string
    text: string
  }

  const decision: FicheDecision = {
    id: data.id,
    chamber: chamber.label,
    reference: data.reference || data.id,
    breadcrumb: data.breadcrumb,
    text: data.text,
  }

  return {
    decision,
    generatedAt: new Date().toISOString(),
  }
}

export interface GradeFicheOpts {
  task: FicheTask
  submission: FicheSubmission
  authToken: string
  getToken?: () => Promise<string | null>
  signal?: AbortSignal
}

type FicheGradingRaw = Omit<FicheGrading, 'gradedAt'>

export async function gradeFicheSubmission(opts: GradeFicheOpts): Promise<FicheGrading> {
  const { system, user } = buildFicheArretGradingPrompt({
    task: opts.task,
    submission: opts.submission,
  })

  const raw = await coachingCallJson<FicheGradingRaw>({
    system,
    user,
    maxTokens: GRADING_MAX_TOKENS,
    authToken: opts.authToken,
    getToken: opts.getToken,
    signal: opts.signal,
  })

  return { ...raw, gradedAt: new Date().toISOString() }
}
