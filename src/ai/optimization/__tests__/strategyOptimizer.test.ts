import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../lib/effectivenessTracker', () => ({
  getBestStrategies: vi.fn(),
}))

import { getOptimalStrategy } from '../strategyOptimizer'
import { getBestStrategies } from '../../../lib/effectivenessTracker'

const mockGetBest = vi.mocked(getBestStrategies)

describe('getOptimalStrategy', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns default when no strategies exist', async () => {
    mockGetBest.mockResolvedValue([])
    const result = await getOptimalStrategy('flashcard', 'p1')
    expect(result.strategy).toBe('default')
    expect(result.promptModification).toBe('')
  })

  it('returns default when not enough total interactions', async () => {
    mockGetBest.mockResolvedValue([
      { id: 'strat-a', contentType: 'flashcard', avgSuccessRate: 0.9, totalGenerated: 2, avgGenerationScore: 0.8, avgInteractionCount: 1, updatedAt: '' },
    ])
    const result = await getOptimalStrategy('flashcard', 'p1')
    expect(result.strategy).toBe('default')
  })

  it('returns best strategy by success rate with enough data', async () => {
    mockGetBest.mockResolvedValue([
      { id: 'worked-example-heavy', contentType: 'flashcard', avgSuccessRate: 0.85, totalGenerated: 20, avgGenerationScore: 0.8, avgInteractionCount: 5, updatedAt: '' },
      { id: 'analogy-first', contentType: 'flashcard', avgSuccessRate: 0.6, totalGenerated: 15, avgGenerationScore: 0.7, avgInteractionCount: 4, updatedAt: '' },
    ])
    const result = await getOptimalStrategy('flashcard', 'p1')
    expect(result.strategy).toBe('worked-example-heavy')
    expect(result.promptModification).toContain('worked examples')
  })

  it('returns empty modification for unknown strategies', async () => {
    mockGetBest.mockResolvedValue([
      { id: 'custom-unknown-strategy', contentType: 'flashcard', avgSuccessRate: 0.9, totalGenerated: 20, avgGenerationScore: 0.8, avgInteractionCount: 5, updatedAt: '' },
    ])
    const result = await getOptimalStrategy('flashcard', 'p1')
    expect(result.strategy).toBe('custom-unknown-strategy')
    expect(result.promptModification).toBe('')
  })

  it('skips strategies with too few interactions', async () => {
    mockGetBest.mockResolvedValue([
      { id: 'high-rate-low-data', contentType: 'flashcard', avgSuccessRate: 1.0, totalGenerated: 50, avgGenerationScore: 0.9, avgInteractionCount: 1, updatedAt: '' },
      { id: 'analogy-first', contentType: 'flashcard', avgSuccessRate: 0.7, totalGenerated: 15, avgGenerationScore: 0.7, avgInteractionCount: 5, updatedAt: '' },
    ])
    const result = await getOptimalStrategy('flashcard', 'p1')
    // Should skip the first one (avgInteractionCount < 3) and use analogy-first
    expect(result.strategy).toBe('analogy-first')
  })

  it('handles errors gracefully', async () => {
    mockGetBest.mockRejectedValue(new Error('DB error'))
    const result = await getOptimalStrategy('flashcard', 'p1')
    expect(result.strategy).toBe('default')
    expect(result.promptModification).toBe('')
  })
})
