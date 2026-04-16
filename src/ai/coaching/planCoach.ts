/**
 * Question generation + grading for the CRFPA Plan Détaillé Coach.
 *
 * Flow mirrors the Syllogisme Coach:
 *  1. generatePlanQuestion: pick theme seed → searchLegalCodes → feed articles
 *     into the question prompt → one coachingCallJson → return task.
 *  2. gradePlanSubmission: build grading prompt with task + submission
 *     → one coachingCallJson → return rubric.
 */

import { searchLegalCodes } from '../tools/legalSearchTool'
import { coachingCallJson } from './coachingClient'
import { parseSearchResults } from './searchHelpers'
import {
  buildPlanQuestionPrompt,
  buildPlanGradingPrompt,
  PLAN_THEMES,
} from '../prompts/planPrompts'
import type {
  PlanGrading,
  PlanModel,
  PlanSubmission,
  PlanTask,
  SyllogismeArticleRef,
} from './types'

const TOP_K = 5
const QUESTION_MAX_TOKENS = 3000
const GRADING_MAX_TOKENS = 4000

interface GeneratedQuestionRaw {
  question: string
  themeLabel: string
  modelPlan: PlanModel
  commonPitfalls: string[]
}

export interface GeneratePlanQuestionOpts {
  themeId: string
  avoidQuestions?: string[]
  authToken: string
  getToken?: () => Promise<string | null>
  signal?: AbortSignal
}

export async function generatePlanQuestion(opts: GeneratePlanQuestionOpts): Promise<PlanTask> {
  const theme = PLAN_THEMES.find(t => t.id === opts.themeId)
  if (!theme) throw new Error(`Unknown plan theme: ${opts.themeId}`)

  let articles: SyllogismeArticleRef[] = []
  for (const seed of theme.searchSeeds) {
    const raw = await searchLegalCodes(seed, opts.authToken, { topK: TOP_K })
    articles = parseSearchResults(raw)
    if (articles.length > 0) break
  }

  const { system, user } = buildPlanQuestionPrompt({
    themeId: theme.id,
    themeLabel: theme.label,
    articles,
    avoidQuestions: opts.avoidQuestions,
  })

  const raw = await coachingCallJson<GeneratedQuestionRaw>({
    system,
    user,
    maxTokens: QUESTION_MAX_TOKENS,
    authToken: opts.authToken,
    getToken: opts.getToken,
    signal: opts.signal,
  })

  return {
    question: raw.question,
    themeLabel: raw.themeLabel || theme.label,
    sourceArticles: articles,
    modelPlan: raw.modelPlan,
    commonPitfalls: raw.commonPitfalls ?? [],
    generatedAt: new Date().toISOString(),
  }
}

export interface GradePlanOpts {
  task: PlanTask
  submission: PlanSubmission
  authToken: string
  getToken?: () => Promise<string | null>
  signal?: AbortSignal
}

type PlanGradingRaw = Omit<PlanGrading, 'gradedAt'>

export async function gradePlanSubmission(opts: GradePlanOpts): Promise<PlanGrading> {
  const { system, user } = buildPlanGradingPrompt({
    task: opts.task,
    submission: opts.submission,
  })

  const raw = await coachingCallJson<PlanGradingRaw>({
    system,
    user,
    maxTokens: GRADING_MAX_TOKENS,
    authToken: opts.authToken,
    getToken: opts.getToken,
    signal: opts.signal,
  })

  return { ...raw, gradedAt: new Date().toISOString() }
}
