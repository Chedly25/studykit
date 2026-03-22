/**
 * Reflection loop — generic verify-then-fix pipeline for AI-generated content.
 * Pure function: takes an LLM callback, no direct dependency on fastClient.
 */
import type { Validator, ReflectionResult, LlmFn } from '../agents/types'

/**
 * Verify content quality using a validator. If score is below threshold,
 * ask the LLM to fix issues and re-verify. Returns best result.
 */
export async function reflect<T>(
  content: T,
  validator: Validator<T>,
  llm: LlmFn,
): Promise<ReflectionResult<T>> {
  // Initial validation
  const initialResult = await validator.validate(content, llm)

  if (initialResult.score >= validator.minScore) {
    return {
      content,
      score: initialResult.score,
      wasFixed: false,
      attempts: 1,
    }
  }

  // Fix loop — try to improve content
  let bestContent = content
  let bestScore = initialResult.score
  let wasImproved = false
  let currentIssues = initialResult.issues
  let currentSuggestions = initialResult.suggestions

  for (let attempt = 0; attempt < validator.maxAttempts; attempt++) {
    const fixPrompt = validator.buildFixPrompt(
      bestContent,
      currentIssues,
      currentSuggestions,
    )

    const fixedRaw = await llm(
      fixPrompt,
      'You are a quality improvement assistant. Fix the issues described and return improved content.',
    )

    const fixedContent = validator.parseFixed(fixedRaw, bestContent)

    // Re-validate
    const revalidation = await validator.validate(fixedContent, llm)

    // Accept if improved (never regress)
    if (revalidation.score > bestScore) {
      bestContent = fixedContent
      bestScore = revalidation.score
      wasImproved = true
      currentIssues = revalidation.issues
      currentSuggestions = revalidation.suggestions
    }

    // Early exit if now above threshold
    if (bestScore >= validator.minScore) {
      return {
        content: bestContent,
        score: bestScore,
        wasFixed: true,
        attempts: attempt + 2, // +1 initial, +1 for this attempt (0-indexed)
      }
    }
  }

  // Return best result even if still below threshold
  return {
    content: bestContent,
    score: bestScore,
    wasFixed: wasImproved,
    attempts: validator.maxAttempts + 1,
  }
}
