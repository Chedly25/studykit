/**
 * Adaptive prompt builder — extends the base system prompt with personalized
 * sections from student model, episodic memory, calibration, and misconceptions.
 */
import { db } from '../db'
import { buildSystemPrompt, type PromptContext } from './systemPrompt'
import { recallEpisodes } from './memory/episodicMemory'
import type { StudentModel, TutoringEpisode } from '../db/schema'

export interface AdaptivePromptContext extends PromptContext {
  userId: string
  currentTopicId?: string
}

function safeParse<T>(json: string | undefined | null, fallback: T): T {
  try { return JSON.parse(json || '') ?? fallback }
  catch { return fallback }
}

/**
 * Build a system prompt that adapts to the specific student.
 * Extends buildSystemPrompt with 4 personalized sections.
 */
export async function buildAdaptivePrompt(ctx: AdaptivePromptContext): Promise<string> {
  // Start with the base prompt (all 20 rules, knowledge state, etc.)
  let prompt = buildSystemPrompt(ctx)

  // Section A: Student-aware teaching rules
  if (ctx.studentModel) {
    prompt += buildAdaptiveRules(ctx.studentModel)
  }

  // Section B: Episodic memory (what worked / didn't)
  if (ctx.userId) {
    const effectiveEpisodes = await recallEpisodes({
      userId: ctx.userId,
      topicId: ctx.currentTopicId,
      minEffectiveness: 0.6,
      limit: 5,
    }).catch(() => [])

    const ineffectiveEpisodes = await recallEpisodes({
      userId: ctx.userId,
      type: 'strategy-ineffective',
      limit: 3,
    }).catch(() => [])

    prompt += buildEpisodicSection(effectiveEpisodes, ineffectiveEpisodes)
  }

  // Section C: Active misconceptions for current topic
  if (ctx.currentTopicId && ctx.profile?.id) {
    prompt += await buildMisconceptionSection(ctx.profile.id, ctx.currentTopicId)
  }

  return prompt
}

// ─── Section Builders ────────────────────────────────────────────

function buildAdaptiveRules(model: StudentModel): string {
  const commonMistakes: string[] = safeParse(model.commonMistakes, [])
  const personalityNotes: string[] = safeParse(model.personalityNotes, [])
  const preferredExplanations: string[] = safeParse(model.preferredExplanations, [])
  const learningStyle = safeParse(model.learningStyle, {} as Record<string, unknown>)
  const motivationTriggers: string[] = safeParse(model.motivationTriggers, [])

  const rules: string[] = []

  // Generate concrete teaching instructions from observed patterns
  for (const mistake of commonMistakes.slice(0, 5)) {
    const lower = mistake.toLowerCase()
    if (lower.includes('rush') || lower.includes('impulsive')) {
      rules.push('This student tends to rush. Before they answer, ask: "What assumptions are we making here?"')
    } else if (lower.includes('confus') || lower.includes('mix')) {
      rules.push(`Watch for: "${mistake}" — address this pattern directly if it surfaces.`)
    } else {
      rules.push(`Known pattern: "${mistake}" — be aware and guide accordingly.`)
    }
  }

  if (learningStyle.visual || learningStyle.spatial) {
    rules.push('This student learns best with spatial metaphors, diagrams, and step-by-step visual descriptions.')
  }
  if (learningStyle.verbal || learningStyle.narrative) {
    rules.push('This student responds well to narrative explanations and storytelling approaches.')
  }

  for (const pref of preferredExplanations.slice(0, 3)) {
    if (pref.toLowerCase().includes('analog')) {
      rules.push('Lead with analogies, then formalize with definitions.')
    } else if (pref.toLowerCase().includes('example')) {
      rules.push('Start with concrete examples before abstract theory.')
    } else if (pref.toLowerCase().includes('step')) {
      rules.push('Use step-by-step derivations — this student needs to see the process.')
    }
  }

  for (const note of personalityNotes.slice(0, 3)) {
    if (note.toLowerCase().includes('encouragement') || note.toLowerCase().includes('positive')) {
      rules.push('Acknowledge effort before corrections. This student responds well to positive reinforcement.')
    } else if (note.toLowerCase().includes('direct') || note.toLowerCase().includes('blunt')) {
      rules.push('Be direct and concise. Skip pleasantries — this student prefers efficiency.')
    }
  }

  for (const trigger of motivationTriggers.slice(0, 2)) {
    rules.push(`Motivation trigger: "${trigger}"`)
  }

  if (rules.length === 0) return ''

  return `\n\n## Adaptive Teaching Rules (from observed patterns)
${rules.map(r => `- ${r}`).join('\n')}`
}

function buildEpisodicSection(
  effective: TutoringEpisode[],
  ineffective: TutoringEpisode[],
): string {
  if (effective.length === 0 && ineffective.length === 0) return ''

  let section = ''

  if (effective.length > 0) {
    section += '\n\n## What Has Worked Before'
    for (const ep of effective) {
      const topic = ep.topicName ? ` on ${ep.topicName}` : ''
      section += `\n- ${ep.description}${topic} (effectiveness: ${ep.effectiveness.toFixed(1)})`
    }
  }

  if (ineffective.length > 0) {
    section += '\n\n## What Has NOT Worked'
    for (const ep of ineffective) {
      const topic = ep.topicName ? ` on ${ep.topicName}` : ''
      section += `\n- ${ep.description}${topic}`
    }
    section += '\nAvoid these approaches with this student.'
  }

  return section
}

async function buildMisconceptionSection(
  examProfileId: string,
  topicId: string,
): Promise<string> {
  try {
    const misconceptions = await db.misconceptions
      .where('[examProfileId+topicId]')
      .equals([examProfileId, topicId])
      .filter(m => !m.resolvedAt)
      .toArray()

    if (misconceptions.length === 0) return ''

    let section = '\n\n## Known Misconceptions (this topic)'
    for (const m of misconceptions.slice(0, 5)) {
      section += `\n- "${m.description}" (seen ${m.occurrenceCount}x, unresolved)`
    }
    section += '\nWatch for these errors and address them directly if they surface.'
    return section
  } catch {
    return ''
  }
}
