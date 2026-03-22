import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../episodicMemory', () => ({
  recallEpisodes: vi.fn().mockImplementation(async () => [
    { id: 'ep1', userId: 'u1', topicId: 't1', topicName: 'Algebra', type: 'strategy-effective', description: 'Analogy worked', context: '{}', effectiveness: 0.5, tags: '[]', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'ep2', userId: 'u1', topicId: 't2', topicName: 'Calculus', type: 'strategy-effective', description: 'Step-by-step', context: '{}', effectiveness: 0.5, tags: '[]', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'ep3', userId: 'u1', topicId: undefined, topicName: undefined, type: 'preference-observed', description: 'Visual learner', context: '{}', effectiveness: 0.5, tags: '[]', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  ]),
  updateEpisodeEffectiveness: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../../db', () => {
  const makeChain = (dataFn: () => unknown[]) => ({
    where: () => ({
      equals: () => ({
        toArray: async () => dataFn(),
      }),
    }),
  })
  return {
    db: {
      topics: makeChain(() => [
        { id: 't1', mastery: 0.7 },
        { id: 't2', mastery: 0.3 },
      ]),
      masterySnapshots: makeChain(() => {
        const date = new Date().toISOString().slice(0, 10) // today — same as episode creation
        return [
          { topicId: 't1', examProfileId: 'p1', date, mastery: 0.5 },
          { topicId: 't2', examProfileId: 'p1', date, mastery: 0.5 },
        ]
      }),
    },
  }
})

import { updateEpisodeEffectivenessFromOutcomes } from '../effectivenessUpdater'
import { updateEpisodeEffectiveness } from '../episodicMemory'

describe('updateEpisodeEffectivenessFromOutcomes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('boosts episodes when mastery improved', async () => {
    const result = await updateEpisodeEffectivenessFromOutcomes('u1', 'p1')
    expect(updateEpisodeEffectiveness).toHaveBeenCalledWith('ep1', 0.1)
    expect(result.boosted).toBeGreaterThan(0)
  })

  it('penalizes episodes when mastery declined', async () => {
    const result = await updateEpisodeEffectivenessFromOutcomes('u1', 'p1')
    expect(updateEpisodeEffectiveness).toHaveBeenCalledWith('ep2', -0.05)
    expect(result.penalized).toBeGreaterThan(0)
  })

  it('skips episodes without topicId', async () => {
    await updateEpisodeEffectivenessFromOutcomes('u1', 'p1')
    expect(updateEpisodeEffectiveness).toHaveBeenCalledTimes(2)
  })

  it('returns correct stats', async () => {
    const result = await updateEpisodeEffectivenessFromOutcomes('u1', 'p1')
    expect(result.updated).toBe(2)
    expect(result.boosted).toBe(1)
    expect(result.penalized).toBe(1)
  })
})
