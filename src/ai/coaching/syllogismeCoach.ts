/**
 * Scenario generation + grading for the CRFPA Syllogisme Coach.
 *
 * Flow:
 *  1. generateSyllogismeScenario: pick theme's search seed → searchLegalCodes
 *     → feed top articles into scenario prompt → one coachingCallJson → return task.
 *  2. gradeSyllogismeSubmission: build grading prompt with task + submission
 *     → one coachingCallJson → return rubric.
 *
 * Uses coachingCallJson (Phase 1) — no workflow orchestrator.
 */

import { searchLegalCodes } from '../tools/legalSearchTool'
import { coachingCallJson } from './coachingClient'
import { parseSearchResults } from './searchHelpers'
import {
  buildSyllogismeScenarioPrompt,
  buildSyllogismeGradingPrompt,
  SYLLOGISME_THEMES,
} from '../prompts/syllogismePrompts'
import type {
  SyllogismeArticleRef,
  SyllogismeDifficulty,
  SyllogismeGrading,
  SyllogismeSubmission,
  SyllogismeTask,
  SyllogismeModel,
} from './types'

const TOP_K = 5
const SCENARIO_MAX_TOKENS = 2500
const GRADING_MAX_TOKENS = 3500

interface GeneratedScenarioRaw {
  scenario: string
  question: string
  modelSyllogisme: SyllogismeModel
}

export interface GenerateScenarioOpts {
  themeId: string
  difficulty: SyllogismeDifficulty
  avoidScenarios?: string[]
  authToken: string
  getToken?: () => Promise<string | null>
  signal?: AbortSignal
}

export async function generateSyllogismeScenario(opts: GenerateScenarioOpts): Promise<SyllogismeTask> {
  const theme = SYLLOGISME_THEMES.find(t => t.id === opts.themeId)
  if (!theme) throw new Error(`Unknown syllogisme theme: ${opts.themeId}`)

  // Pre-fetch articles — first seed usually suffices; fall back to second if empty.
  let articles: SyllogismeArticleRef[] = []
  for (const seed of theme.searchSeeds) {
    const raw = await searchLegalCodes(seed, opts.authToken, { topK: TOP_K })
    articles = parseSearchResults(raw)
    if (articles.length > 0) break
  }

  const { system, user } = buildSyllogismeScenarioPrompt({
    theme: theme.label,
    difficulty: opts.difficulty,
    articles,
    avoidScenarios: opts.avoidScenarios,
  })

  const raw = await coachingCallJson<GeneratedScenarioRaw>({
    system,
    user,
    maxTokens: SCENARIO_MAX_TOKENS,
    authToken: opts.authToken,
    getToken: opts.getToken,
    signal: opts.signal,
  })

  return {
    theme: theme.label,
    difficulty: opts.difficulty,
    scenario: raw.scenario,
    question: raw.question,
    sourceArticles: articles,
    modelSyllogisme: raw.modelSyllogisme,
    generatedAt: new Date().toISOString(),
  }
}

export interface GradeSubmissionOpts {
  task: SyllogismeTask
  submission: SyllogismeSubmission
  authToken: string
  getToken?: () => Promise<string | null>
  signal?: AbortSignal
}

type GradingRaw = Omit<SyllogismeGrading, 'gradedAt'>

export async function gradeSyllogismeSubmission(opts: GradeSubmissionOpts): Promise<SyllogismeGrading> {
  const { system, user } = buildSyllogismeGradingPrompt({
    task: opts.task,
    submission: opts.submission,
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
