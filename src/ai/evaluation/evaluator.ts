/**
 * Content evaluation pipeline — batch evaluation with redundancy detection.
 * Decides which AI-generated content to keep, rewrite, or discard.
 */
import type { LlmFn } from '../agents/types'

export interface ContentEvaluation {
  index: number
  score: number              // 0-1 quality
  action: 'keep' | 'rewrite' | 'discard'
  issues: string[]
  redundancyScore: number    // 0-1 (1 = exact duplicate)
}

/**
 * Evaluate a batch of flashcards for quality and redundancy.
 * Returns an evaluation per card with action recommendation.
 */
export async function evaluateFlashcardBatch(
  cards: Array<{ front: string; back: string }>,
  existingCards: Array<{ front: string; back: string }>,
  llm: LlmFn,
): Promise<ContentEvaluation[]> {
  if (cards.length === 0) return []

  const newCardList = cards
    .map((c, i) => `[${i}] Front: ${c.front} | Back: ${c.back}`)
    .join('\n')

  const existingList = existingCards.length > 0
    ? existingCards.slice(0, 20).map(c => `- ${c.front}`).join('\n')
    : 'None'

  try {
    const raw = await llm(
      `Evaluate these ${cards.length} flashcards for a study deck.

New cards:
${newCardList}

Existing cards already in deck (check for redundancy):
${existingList}

For each new card, evaluate:
1. Quality (0-1): tests understanding not just recall, clear question, complete answer
2. Redundancy (0-1): 1 = essentially a duplicate of an existing card, 0 = completely new
3. Action: "keep" if score >= 0.6 AND redundancy < 0.7, "rewrite" if score 0.3-0.6, "discard" if score < 0.3 OR redundancy >= 0.7

Return JSON: { "evaluations": [{ "index": 0, "score": 0.8, "redundancyScore": 0.1, "action": "keep", "issues": [] }] }
Only JSON.`,
      'You are a flashcard quality evaluator. Return only valid JSON.',
    )

    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) return cards.map((_, i) => defaultEvaluation(i))

    const parsed = JSON.parse(match[0]) as {
      evaluations?: Array<{ index?: number; score?: number; redundancyScore?: number; action?: string; issues?: string[] }>
    }

    const evals = (parsed.evaluations ?? []).map((e, fallbackIndex) => ({
      index: typeof e.index === 'number' && e.index >= 0 && e.index < cards.length ? e.index : fallbackIndex,
      score: clamp(e.score ?? 0.5),
      redundancyScore: clamp(e.redundancyScore ?? 0),
      action: validateAction(e.action),
      issues: e.issues ?? [],
    }))
    // If LLM returned fewer evaluations than cards, fill remaining with defaults
    if (evals.length < cards.length) {
      const covered = new Set(evals.map(e => e.index))
      for (let i = 0; i < cards.length; i++) {
        if (!covered.has(i)) evals.push(defaultEvaluation(i))
      }
    }
    return evals
  } catch {
    return cards.map((_, i) => defaultEvaluation(i))
  }
}

/**
 * Evaluate a single concept card for quality and title uniqueness.
 */
export async function evaluateConceptCard(
  card: { title: string; content: string; keyPoints: string[] },
  existingCards: Array<{ title: string }>,
  llm: LlmFn,
): Promise<ContentEvaluation> {
  // Quick duplicate title check (no LLM needed)
  const isDuplicate = existingCards.some(
    e => e.title.toLowerCase() === card.title.toLowerCase()
  )
  if (isDuplicate) {
    return {
      index: 0, score: 0, action: 'discard',
      issues: [`Duplicate title: "${card.title}" already exists`],
      redundancyScore: 1,
    }
  }

  try {
    const raw = await llm(
      `Evaluate this concept card for study reference quality.

Title: ${card.title}
Content: ${card.content.slice(0, 1500)}
Key Points: ${card.keyPoints.join(', ')}

Evaluate:
1. Completeness (0-1): covers definition, key points, examples?
2. Quality (0-1): accurate, clear, well-structured?
3. Overall score (0-1)
4. Action: "keep" if score >= 0.6, "rewrite" if 0.3-0.6, "discard" if < 0.3

Return JSON: { "score": 0.8, "action": "keep", "issues": [], "redundancyScore": 0 }
Only JSON.`,
      'You are a study content quality evaluator. Return only valid JSON.',
    )

    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) return defaultEvaluation(0)

    const parsed = JSON.parse(match[0]) as {
      score?: number; action?: string; issues?: string[]; redundancyScore?: number
    }

    return {
      index: 0,
      score: clamp(parsed.score ?? 0.5),
      action: validateAction(parsed.action),
      issues: parsed.issues ?? [],
      redundancyScore: clamp(parsed.redundancyScore ?? 0),
    }
  } catch {
    return defaultEvaluation(0)
  }
}

// ─── Helpers ─────────────────────────────────────────────────────

function clamp(v: number): number {
  return Math.max(0, Math.min(1, v))
}

function validateAction(action: string | undefined): 'keep' | 'rewrite' | 'discard' {
  if (action === 'keep' || action === 'rewrite' || action === 'discard') return action
  return 'keep' // default to keep if unparseable
}

function defaultEvaluation(index: number): ContentEvaluation {
  return { index, score: 0.5, action: 'keep', issues: [], redundancyScore: 0 }
}
