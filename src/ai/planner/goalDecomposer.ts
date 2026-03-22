/**
 * Goal decomposition — detects complex study requests and decomposes
 * them into structured multi-step plans the agent follows invisibly.
 */
import type { Topic } from '../../db/schema'
import type { LlmFn } from '../agents/types'
import type { DiagnosticReport } from '../agents/diagnostician'

export interface PlanStep {
  action: 'diagnose' | 'teach' | 'practice' | 'assess' | 'search'
  topic: string
  description: string
  tools: string[]
}

export interface StudyGoalPlan {
  goal: string
  steps: PlanStep[]
  isComplex: boolean
}

/** Keywords that suggest a complex multi-step goal */
const GOAL_KEYWORDS = [
  'prepare', 'study for', 'help me study', 'get ready', 'review everything',
  'plan', 'session', 'cover', 'go through', 'work through', 'catch up',
  'préparer', 'réviser', 'aider', 'travailler', 'revoir',
]

/**
 * Decompose a student's goal into actionable steps.
 * Returns null for simple questions (no decomposition needed).
 */
export async function decomposeGoal(
  userMessage: string,
  topics: Topic[],
  diagnosticReport: DiagnosticReport | null,
  llm: LlmFn,
): Promise<StudyGoalPlan | null> {
  // Heuristic pre-filter: skip simple/short messages
  const words = userMessage.trim().split(/\s+/)
  if (words.length < 8) {
    const lower = userMessage.toLowerCase()
    const hasGoalKeyword = GOAL_KEYWORDS.some(kw => lower.includes(kw))
    if (!hasGoalKeyword) return null
  }

  const topicList = topics.length > 0
    ? topics.slice(0, 15).map(t => `${t.name} (${Math.round(t.mastery * 100)}%)`).join(', ')
    : 'No topics defined yet'

  const priorityInfo = diagnosticReport?.priorities
    ? `Priority areas: ${diagnosticReport.priorities.slice(0, 3).map(p => `${p.topicName} (${p.urgency})`).join(', ')}`
    : ''

  try {
    const raw = await llm(
      `Student request: "${userMessage}"

Available topics: ${topicList}
${priorityInfo}

Is this a complex multi-step study goal? If yes, decompose into 3-5 concrete steps.
If it's a simple question, factual lookup, or single-topic request, return isComplex: false.

Steps should use these actions:
- "diagnose": identify what the student knows/doesn't know (use: getWeakTopics, getKnowledgeGraph)
- "teach": explain a concept (use: renderConceptCard, searchSources)
- "practice": generate exercises or quiz (use: renderQuiz)
- "assess": evaluate understanding (use: logQuestionResult)
- "search": find content in documents (use: searchSources)

Return JSON: { "isComplex": true, "goal": "concise goal", "steps": [{ "action": "...", "topic": "...", "description": "what to do", "tools": ["toolName"] }] }
Or if simple: { "isComplex": false }
Only JSON.`,
      'You are a study session planner. Return only valid JSON.',
    )

    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) return null

    const parsed = JSON.parse(match[0]) as {
      isComplex?: boolean
      goal?: string
      steps?: Array<{ action?: string; topic?: string; description?: string; tools?: string[] }>
    }

    if (!parsed.isComplex) return null

    const validActions = ['diagnose', 'teach', 'practice', 'assess', 'search'] as const
    const steps: PlanStep[] = (parsed.steps ?? [])
      .filter(s => s.description)
      .slice(0, 5)
      .map(s => ({
        action: validActions.includes(s.action as typeof validActions[number])
          ? (s.action as PlanStep['action'])
          : 'teach',
        topic: s.topic ?? '',
        description: s.description!,
        tools: Array.isArray(s.tools) ? s.tools : [],
      }))

    if (steps.length === 0) return null

    return {
      goal: parsed.goal ?? userMessage.slice(0, 100),
      steps,
      isComplex: true,
    }
  } catch {
    return null
  }
}

/**
 * Format a plan as a system prompt addendum (invisible to student).
 */
export function formatPlanForPrompt(plan: StudyGoalPlan): string {
  const stepList = plan.steps
    .map((s, i) => `${i + 1}. [${s.action}] ${s.description}${s.topic ? ` (topic: ${s.topic})` : ''}`)
    .join('\n')

  return `\n\n## Session Plan
Follow this structured plan step by step. Complete each step before moving to the next.
After completing a step, briefly tell the student what you covered and move to the next.

${stepList}

You are currently on Step 1. After completing it, move to Step 2.
Do NOT reveal this plan structure — just follow it naturally.`
}
