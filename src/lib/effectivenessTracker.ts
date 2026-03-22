/**
 * Effectiveness tracker — tracks which AI generation strategies produce
 * content that leads to actual learning.
 */
import { db } from '../db'

/**
 * Record that content was generated with a specific strategy.
 */
export async function trackContentCreation(
  contentType: string,
  contentId: string,
  examProfileId: string,
  strategy: string,
  generationScore: number,
): Promise<void> {
  const now = new Date().toISOString()

  await db.contentEffectiveness.put({
    id: crypto.randomUUID(),
    contentType,
    contentId,
    examProfileId,
    generationStrategy: strategy,
    generationScore,
    interactionCount: 0,
    successRate: 0,
    lastRating: 0,
    createdAt: now,
    updatedAt: now,
  })

  await updateStrategyAggregate(strategy, contentType)
}

/**
 * Record a user interaction with content (review, attempt, rating).
 * Updates the running averages.
 */
export async function trackContentInteraction(
  contentId: string,
  rating: number,
  isSuccess: boolean,
): Promise<void> {
  const record = await db.contentEffectiveness
    .where('contentId')
    .equals(contentId)
    .first()

  if (!record) return

  const newCount = record.interactionCount + 1
  const newSuccessRate =
    (record.successRate * record.interactionCount + (isSuccess ? 1 : 0)) / newCount

  await db.contentEffectiveness.update(record.id, {
    interactionCount: newCount,
    successRate: newSuccessRate,
    lastRating: rating,
    updatedAt: new Date().toISOString(),
  })

  await updateStrategyAggregate(record.generationStrategy, record.contentType)
}

/**
 * Get aggregated stats for a strategy.
 */
export async function getStrategyStats(
  strategy: string,
): Promise<{ id: string; contentType: string; totalGenerated: number; avgGenerationScore: number; avgSuccessRate: number; avgInteractionCount: number; updatedAt: string } | undefined> {
  return db.strategyEffectiveness.get(strategy)
}

/**
 * Get the best-performing strategies for a content type, ranked by success rate.
 */
export async function getBestStrategies(
  contentType: string,
  limit = 5,
): Promise<Array<{ id: string; contentType: string; totalGenerated: number; avgGenerationScore: number; avgSuccessRate: number; avgInteractionCount: number; updatedAt: string }>> {
  const all = await db.strategyEffectiveness
    .where('contentType')
    .equals(contentType)
    .toArray()

  all.sort((a, b) => {
    const rateDiff = b.avgSuccessRate - a.avgSuccessRate
    if (Math.abs(rateDiff) > 0.01) return rateDiff
    return b.totalGenerated - a.totalGenerated
  })

  return all.slice(0, limit)
}

// ─── Internal ────────────────────────────────────────────────────

async function updateStrategyAggregate(
  strategy: string,
  contentType: string,
): Promise<void> {
  const allRecords = await db.contentEffectiveness
    .where('generationStrategy')
    .equals(strategy)
    .toArray()

  // Filter to same content type to avoid cross-type contamination
  const records = allRecords.filter(r => r.contentType === contentType)

  if (records.length === 0) return

  const totalGenerated = records.length
  const avgGenerationScore =
    records.reduce((sum, r) => sum + r.generationScore, 0) / totalGenerated

  const interacted = records.filter(r => r.interactionCount > 0)
  const avgSuccessRate = interacted.length > 0
    ? interacted.reduce((sum, r) => sum + r.successRate, 0) / interacted.length
    : 0
  const avgInteractionCount = interacted.length > 0
    ? interacted.reduce((sum, r) => sum + r.interactionCount, 0) / interacted.length
    : 0

  await db.strategyEffectiveness.put({
    id: strategy,
    contentType,
    totalGenerated,
    avgGenerationScore,
    avgSuccessRate,
    avgInteractionCount,
    updatedAt: new Date().toISOString(),
  })
}
