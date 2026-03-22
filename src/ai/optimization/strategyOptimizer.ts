/**
 * Strategy optimizer — selects the best content generation strategy
 * based on historical effectiveness data. The system learns which
 * approaches produce content that students actually learn from.
 */
import { getBestStrategies } from '../../lib/effectivenessTracker'

const MIN_INTERACTIONS_TO_QUALIFY = 3
const MIN_TOTAL_FOR_OPTIMIZATION = 10

/** Known prompt modifications per strategy name */
const STRATEGY_PROMPTS: Record<string, string> = {
  'content-architect-fiche': '',
  'content-architect-flashcard': '',
  'source-processing': '',
  'worked-example-heavy': 'Focus heavily on worked examples with step-by-step solutions. Include at least 2 fully worked examples.',
  'analogy-first': 'Lead with analogies and metaphors before formal definitions. Make abstract concepts concrete.',
  'question-driven': 'Structure the content as a series of questions and answers that build understanding progressively.',
  'visual-spatial': 'Use spatial metaphors, describe visual layouts, and reference diagrams where relevant.',
  'concise-reference': 'Keep content dense and reference-style. Prioritize precision over verbosity.',
}

interface StrategyResult {
  strategy: string
  promptModification: string
}

const DEFAULT_RESULT: StrategyResult = {
  strategy: 'default',
  promptModification: '',
}

/**
 * Get the optimal generation strategy for a content type.
 * Returns the best-performing strategy and any prompt modifications.
 */
export async function getOptimalStrategy(
  contentType: string,
  _examProfileId: string,
): Promise<StrategyResult> {
  try {
    const strategies = await getBestStrategies(contentType, 5)

    if (strategies.length === 0) return DEFAULT_RESULT

    // Check if we have enough total data to make meaningful recommendations
    const totalInteractions = strategies.reduce((sum, s) => sum + s.avgInteractionCount * s.totalGenerated, 0)
    if (totalInteractions < MIN_TOTAL_FOR_OPTIMIZATION) return DEFAULT_RESULT

    // Find the best strategy with enough interactions
    const qualified = strategies.filter(s => s.avgInteractionCount >= MIN_INTERACTIONS_TO_QUALIFY)
    if (qualified.length === 0) return DEFAULT_RESULT

    // Best by success rate (already sorted by getBestStrategies)
    const best = qualified[0]
    const promptModification = STRATEGY_PROMPTS[best.id] ?? ''

    return {
      strategy: best.id,
      promptModification,
    }
  } catch {
    return DEFAULT_RESULT
  }
}
