import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockContentRecords: any[] = []
const mockStrategyRecords: any[] = []

vi.mock('../../db', () => ({
  db: {
    contentEffectiveness: {
      put: vi.fn().mockImplementation(async (record: any) => {
        const idx = mockContentRecords.findIndex(r => r.id === record.id)
        if (idx >= 0) mockContentRecords[idx] = record
        else mockContentRecords.push(record)
      }),
      where: vi.fn().mockImplementation((index: string) => ({
        equals: vi.fn().mockImplementation((val: string) => ({
          first: vi.fn().mockImplementation(async () => {
            if (index === 'contentId') return mockContentRecords.find(r => r.contentId === val)
            return undefined
          }),
          toArray: vi.fn().mockImplementation(async () => {
            if (index === 'generationStrategy') return mockContentRecords.filter(r => r.generationStrategy === val)
            return []
          }),
        })),
      })),
      update: vi.fn().mockImplementation(async (id: string, changes: any) => {
        const idx = mockContentRecords.findIndex(r => r.id === id)
        if (idx >= 0) Object.assign(mockContentRecords[idx], changes)
      }),
    },
    strategyEffectiveness: {
      put: vi.fn().mockImplementation(async (record: any) => {
        const idx = mockStrategyRecords.findIndex(r => r.id === record.id)
        if (idx >= 0) mockStrategyRecords[idx] = record
        else mockStrategyRecords.push(record)
      }),
      get: vi.fn().mockImplementation(async (id: string) =>
        mockStrategyRecords.find(r => r.id === id)
      ),
      where: vi.fn().mockImplementation(() => ({
        equals: vi.fn().mockImplementation((val: string) => ({
          toArray: vi.fn().mockImplementation(async () =>
            mockStrategyRecords.filter(r => r.contentType === val)
          ),
        })),
      })),
    },
  },
}))

import { trackContentCreation, trackContentInteraction, getStrategyStats, getBestStrategies } from '../effectivenessTracker'

describe('effectivenessTracker', () => {
  beforeEach(() => {
    mockContentRecords.length = 0
    mockStrategyRecords.length = 0
    vi.clearAllMocks()
  })

  describe('trackContentCreation', () => {
    it('creates a content effectiveness record', async () => {
      await trackContentCreation('flashcard', 'fc-1', 'profile-1', 'bloom-taxonomy', 0.85)
      expect(mockContentRecords).toHaveLength(1)
      expect(mockContentRecords[0].contentType).toBe('flashcard')
      expect(mockContentRecords[0].generationScore).toBe(0.85)
      expect(mockContentRecords[0].interactionCount).toBe(0)
    })

    it('updates strategy aggregate', async () => {
      await trackContentCreation('flashcard', 'fc-1', 'profile-1', 'bloom-taxonomy', 0.8)
      expect(mockStrategyRecords).toHaveLength(1)
      expect(mockStrategyRecords[0].id).toBe('bloom-taxonomy')
      expect(mockStrategyRecords[0].totalGenerated).toBe(1)
      expect(mockStrategyRecords[0].avgGenerationScore).toBe(0.8)
    })
  })

  describe('trackContentInteraction', () => {
    it('updates running average on interaction', async () => {
      mockContentRecords.push({
        id: 'ce-1', contentId: 'fc-1', generationStrategy: 'basic',
        contentType: 'flashcard', interactionCount: 2,
        successRate: 0.5, lastRating: 3, generationScore: 0.7,
      })

      await trackContentInteraction('fc-1', 4, true)

      const record = mockContentRecords.find(r => r.id === 'ce-1')
      // (0.5 * 2 + 1) / 3 = 2/3 ≈ 0.667
      expect(record.interactionCount).toBe(3)
      expect(record.successRate).toBeCloseTo(0.667, 2)
      expect(record.lastRating).toBe(4)
    })

    it('does nothing for unknown content', async () => {
      await trackContentInteraction('nonexistent', 3, false)
      // Should not throw
    })
  })

  describe('getStrategyStats', () => {
    it('returns strategy by id', async () => {
      mockStrategyRecords.push({
        id: 'strat-a', contentType: 'flashcard',
        avgSuccessRate: 0.8, totalGenerated: 10,
        avgGenerationScore: 0.7, avgInteractionCount: 5, updatedAt: '',
      })

      const stats = await getStrategyStats('strat-a')
      expect(stats).toBeDefined()
      expect(stats!.avgSuccessRate).toBe(0.8)
    })

    it('returns undefined for unknown strategy', async () => {
      const stats = await getStrategyStats('nonexistent')
      expect(stats).toBeUndefined()
    })
  })

  describe('getBestStrategies', () => {
    it('returns strategies sorted by success rate desc', async () => {
      mockStrategyRecords.push(
        { id: 'strat-a', contentType: 'flashcard', avgSuccessRate: 0.6, totalGenerated: 10, avgGenerationScore: 0.7, avgInteractionCount: 5, updatedAt: '' },
        { id: 'strat-b', contentType: 'flashcard', avgSuccessRate: 0.9, totalGenerated: 5, avgGenerationScore: 0.8, avgInteractionCount: 3, updatedAt: '' },
        { id: 'strat-c', contentType: 'flashcard', avgSuccessRate: 0.3, totalGenerated: 20, avgGenerationScore: 0.5, avgInteractionCount: 8, updatedAt: '' },
      )

      const best = await getBestStrategies('flashcard', 2)
      expect(best).toHaveLength(2)
      expect(best[0].id).toBe('strat-b')
      expect(best[1].id).toBe('strat-a')
    })
  })
})
