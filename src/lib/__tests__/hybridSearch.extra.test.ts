/**
 * Additional tests for hybridSearch — covers re-ranking success path,
 * semantic skip when no authToken, and the 'both' source detection.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

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

function makeChunk(id: string, score: number) {
  return {
    id, documentId: 'd1', examProfileId: 'p1',
    content: `Content of ${id}`, chunkIndex: 0, keywords: 'test',
    score, documentTitle: 'Doc',
  }
}

describe('hybridSearch — additional coverage', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('skips semantic search entirely when no authToken', async () => {
    mockKeyword.mockResolvedValue([makeChunk('k1', 0.8)])
    await hybridSearch('p1', 'test', undefined, { topN: 5, rerank: false })
    expect(mockSemantic).not.toHaveBeenCalled()
  })

  it('applies LLM re-ranking to reorder results', async () => {
    // Need more candidates than topN so re-ranking triggers
    const semanticChunks = Array.from({ length: 8 }, (_, i) => makeChunk(`s${i}`, 0.9 - i * 0.05))
    const keywordChunks = Array.from({ length: 8 }, (_, i) => makeChunk(`k${i}`, 0.8 - i * 0.05))
    mockSemantic.mockResolvedValue(semanticChunks)
    mockKeyword.mockResolvedValue(keywordChunks)
    mockLLM.mockResolvedValue('[2, 0, 1]')

    const results = await hybridSearch('p1', 'test', 'token', { topN: 3, rerank: true })
    expect(results.length).toBe(3)
    expect(mockLLM).toHaveBeenCalledTimes(1)
  })

  it('marks chunks found by both sources as source: "both"', async () => {
    const sharedId = 'shared-chunk'
    mockSemantic.mockResolvedValue([makeChunk(sharedId, 0.8)])
    mockKeyword.mockResolvedValue([makeChunk(sharedId, 0.7)])

    const results = await hybridSearch('p1', 'test', 'token', { topN: 5, rerank: false })
    expect(results[0].source).toBe('both')
  })
})
