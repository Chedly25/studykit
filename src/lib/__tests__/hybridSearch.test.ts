import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock dependencies
vi.mock('../embeddings', () => ({
  semanticSearch: vi.fn(),
}))

vi.mock('../sources', () => ({
  searchChunks: vi.fn(),
}))

vi.mock('../../ai/fastClient', () => ({
  callFastModel: vi.fn(),
}))

import { hybridSearch } from '../hybridSearch'
import { semanticSearch } from '../embeddings'
import { searchChunks } from '../sources'
import { callFastModel } from '../../ai/fastClient'

const mockSemantic = vi.mocked(semanticSearch)
const mockKeyword = vi.mocked(searchChunks)
const mockLLM = vi.mocked(callFastModel)

function makeChunk(id: string, score: number, title = 'Doc') {
  return {
    id,
    documentId: 'd1',
    examProfileId: 'p1',
    content: `Content of ${id}`,
    chunkIndex: 0,
    keywords: 'test',
    score,
    documentTitle: title,
  }
}

describe('hybridSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLLM.mockResolvedValue('[]')
  })

  it('returns empty when both searches return nothing', async () => {
    mockSemantic.mockResolvedValue([])
    mockKeyword.mockResolvedValue([])

    const results = await hybridSearch('p1', 'test query', 'token', { topN: 5, rerank: false })
    expect(results).toHaveLength(0)
  })

  it('returns keyword-only results when semantic fails', async () => {
    mockSemantic.mockRejectedValue(new Error('no auth'))
    mockKeyword.mockResolvedValue([makeChunk('k1', 0.8), makeChunk('k2', 0.5)])

    const results = await hybridSearch('p1', 'test', 'token', { topN: 5, rerank: false })
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].source).toBe('keyword')
  })

  it('returns semantic-only results when keyword returns nothing', async () => {
    mockSemantic.mockResolvedValue([makeChunk('s1', 0.9), makeChunk('s2', 0.7)])
    mockKeyword.mockResolvedValue([])

    const results = await hybridSearch('p1', 'test', 'token', { topN: 5, rerank: false })
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].source).toBe('semantic')
  })

  it('fuses results from both sources via RRF', async () => {
    mockSemantic.mockResolvedValue([makeChunk('s1', 0.9), makeChunk('both', 0.7)])
    mockKeyword.mockResolvedValue([makeChunk('both', 0.8), makeChunk('k1', 0.6)])

    const results = await hybridSearch('p1', 'test', 'token', { topN: 5, rerank: false })

    // 'both' should rank highest since it appears in both result sets
    const bothResult = results.find(r => r.id === 'both')
    expect(bothResult).toBeDefined()
    expect(bothResult!.source).toBe('both')

    // Verify 'both' has the highest score (RRF boost)
    expect(results[0].id).toBe('both')
  })

  it('respects topN limit', async () => {
    mockSemantic.mockResolvedValue([
      makeChunk('s1', 0.9), makeChunk('s2', 0.8), makeChunk('s3', 0.7),
    ])
    mockKeyword.mockResolvedValue([
      makeChunk('k1', 0.9), makeChunk('k2', 0.8), makeChunk('k3', 0.7),
    ])

    const results = await hybridSearch('p1', 'test', 'token', { topN: 2, rerank: false })
    expect(results).toHaveLength(2)
  })

  it('skips re-ranking when no authToken', async () => {
    mockSemantic.mockResolvedValue([])
    mockKeyword.mockResolvedValue([makeChunk('k1', 0.8)])

    await hybridSearch('p1', 'test', undefined, { topN: 5 })
    expect(mockLLM).not.toHaveBeenCalled()
  })

  it('skips re-ranking when rerank=false', async () => {
    mockSemantic.mockResolvedValue([makeChunk('s1', 0.9)])
    mockKeyword.mockResolvedValue([makeChunk('k1', 0.8)])

    await hybridSearch('p1', 'test', 'token', { topN: 5, rerank: false })
    expect(mockLLM).not.toHaveBeenCalled()
  })

  it('handles re-ranking gracefully on LLM failure', async () => {
    mockSemantic.mockResolvedValue([makeChunk('s1', 0.9), makeChunk('s2', 0.7)])
    mockKeyword.mockResolvedValue([makeChunk('k1', 0.8)])
    mockLLM.mockRejectedValue(new Error('LLM error'))

    // Should still return results (falls back to fused order)
    const results = await hybridSearch('p1', 'test', 'token', { topN: 3, rerank: true })
    expect(results.length).toBeGreaterThan(0)
  })

  it('returns full DocumentChunk fields in results', async () => {
    mockSemantic.mockResolvedValue([{
      id: 'c1', documentId: 'd1', examProfileId: 'p1',
      content: 'Full content', chunkIndex: 3, keywords: 'key1,key2',
      topicId: 't1', contextPrefix: 'This discusses...',
      score: 0.9, documentTitle: 'My Doc',
    }])
    mockKeyword.mockResolvedValue([])

    const results = await hybridSearch('p1', 'test', 'token', { topN: 5, rerank: false })
    expect(results[0].id).toBe('c1')
    expect(results[0].chunkIndex).toBe(3)
    expect(results[0].keywords).toBe('key1,key2')
    expect(results[0].topicId).toBe('t1')
    expect(results[0].documentTitle).toBe('My Doc')
  })
})
