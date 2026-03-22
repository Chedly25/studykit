import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockEpisodes: any[] = []

vi.mock('../../../db', () => ({
  db: {
    tutoringEpisodes: {
      where: vi.fn().mockImplementation((index: string) => ({
        equals: vi.fn().mockImplementation((val: unknown) => ({
          toArray: vi.fn().mockImplementation(async () => {
            if (Array.isArray(val)) {
              // Compound index: [userId+topicId] or [userId+type]
              if (index === '[userId+topicId]') {
                return mockEpisodes.filter(e => e.userId === val[0] && e.topicId === val[1])
              }
              if (index === '[userId+type]') {
                return mockEpisodes.filter(e => e.userId === val[0] && e.type === val[1])
              }
            }
            // Simple index: userId
            return mockEpisodes.filter(e => e.userId === val)
          }),
        })),
      })),
      put: vi.fn().mockImplementation(async (ep: any) => {
        const idx = mockEpisodes.findIndex(e => e.id === ep.id)
        if (idx >= 0) mockEpisodes[idx] = ep
        else mockEpisodes.push(ep)
      }),
      get: vi.fn().mockImplementation(async (id: string) =>
        mockEpisodes.find(e => e.id === id)
      ),
      update: vi.fn().mockImplementation(async (id: string, changes: any) => {
        const idx = mockEpisodes.findIndex(e => e.id === id)
        if (idx >= 0) Object.assign(mockEpisodes[idx], changes)
      }),
      bulkDelete: vi.fn().mockImplementation(async (ids: string[]) => {
        const idSet = new Set(ids)
        let i = mockEpisodes.length
        while (i--) {
          if (idSet.has(mockEpisodes[i].id)) mockEpisodes.splice(i, 1)
        }
      }),
    },
  },
}))

import { recallEpisodes, recordEpisode, updateEpisodeEffectiveness, pruneEpisodes } from '../episodicMemory'

describe('episodicMemory', () => {
  beforeEach(() => {
    mockEpisodes.length = 0
    vi.clearAllMocks()
  })

  describe('recordEpisode', () => {
    it('creates an episode with generated id and timestamps', async () => {
      const id = await recordEpisode({
        userId: 'u1',
        type: 'breakthrough',
        description: 'Student understood recursion',
        context: '{}',
        effectiveness: 0.8,
        tags: '[]',
      })
      expect(id).toBeTruthy()
      expect(mockEpisodes).toHaveLength(1)
      expect(mockEpisodes[0].createdAt).toBeTruthy()
      expect(mockEpisodes[0].updatedAt).toBeTruthy()
    })
  })

  describe('recallEpisodes', () => {
    it('returns episodes sorted by effectiveness desc', async () => {
      await recordEpisode({ userId: 'u1', type: 'breakthrough', description: 'A', context: '{}', effectiveness: 0.3, tags: '[]' })
      await recordEpisode({ userId: 'u1', type: 'breakthrough', description: 'B', context: '{}', effectiveness: 0.9, tags: '[]' })
      await recordEpisode({ userId: 'u1', type: 'breakthrough', description: 'C', context: '{}', effectiveness: 0.6, tags: '[]' })

      const results = await recallEpisodes({ userId: 'u1' })
      expect(results[0].effectiveness).toBe(0.9)
      expect(results[1].effectiveness).toBe(0.6)
      expect(results[2].effectiveness).toBe(0.3)
    })

    it('respects limit parameter', async () => {
      for (let i = 0; i < 5; i++) {
        await recordEpisode({ userId: 'u1', type: 'breakthrough', description: `Ep ${i}`, context: '{}', effectiveness: 0.5, tags: '[]' })
      }
      const results = await recallEpisodes({ userId: 'u1', limit: 2 })
      expect(results).toHaveLength(2)
    })

    it('filters by minEffectiveness', async () => {
      await recordEpisode({ userId: 'u1', type: 'breakthrough', description: 'Low', context: '{}', effectiveness: 0.2, tags: '[]' })
      await recordEpisode({ userId: 'u1', type: 'breakthrough', description: 'High', context: '{}', effectiveness: 0.8, tags: '[]' })

      const results = await recallEpisodes({ userId: 'u1', minEffectiveness: 0.5 })
      expect(results).toHaveLength(1)
      expect(results[0].description).toBe('High')
    })

    it('filters by topicName (fuzzy)', async () => {
      await recordEpisode({ userId: 'u1', type: 'breakthrough', description: 'A', context: '{}', effectiveness: 0.8, tags: '[]', topicName: 'Algebra' })
      await recordEpisode({ userId: 'u1', type: 'breakthrough', description: 'B', context: '{}', effectiveness: 0.8, tags: '[]', topicName: 'Calculus' })

      const results = await recallEpisodes({ userId: 'u1', topicName: 'alg' })
      expect(results).toHaveLength(1)
      expect(results[0].topicName).toBe('Algebra')
    })
  })

  describe('updateEpisodeEffectiveness', () => {
    it('adds delta and clamps to 1.0', async () => {
      const id = await recordEpisode({ userId: 'u1', type: 'breakthrough', description: 'Test', context: '{}', effectiveness: 0.8, tags: '[]' })
      await updateEpisodeEffectiveness(id, 0.3)
      const episode = mockEpisodes.find(e => e.id === id)
      expect(episode.effectiveness).toBe(1.0)
    })

    it('clamps negative to 0', async () => {
      const id = await recordEpisode({ userId: 'u1', type: 'breakthrough', description: 'Test', context: '{}', effectiveness: 0.2, tags: '[]' })
      await updateEpisodeEffectiveness(id, -0.5)
      const episode = mockEpisodes.find(e => e.id === id)
      expect(episode.effectiveness).toBe(0)
    })

    it('does nothing for non-existent episode', async () => {
      await updateEpisodeEffectiveness('nonexistent', 0.1)
      // Should not throw
    })
  })

  describe('pruneEpisodes', () => {
    it('deletes lowest-effectiveness episodes beyond max', async () => {
      for (let i = 0; i < 503; i++) {
        mockEpisodes.push({
          id: `ep-${i}`, userId: 'u1', type: 'breakthrough',
          description: `Episode ${i}`, context: '{}',
          effectiveness: i / 503, tags: '[]',
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        })
      }

      const deleted = await pruneEpisodes('u1')
      expect(deleted).toBe(3)
      expect(mockEpisodes).toHaveLength(500)
    })

    it('does nothing when under limit', async () => {
      await recordEpisode({ userId: 'u1', type: 'breakthrough', description: 'Test', context: '{}', effectiveness: 0.5, tags: '[]' })
      const deleted = await pruneEpisodes('u1')
      expect(deleted).toBe(0)
    })
  })
})
