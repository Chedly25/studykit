import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../db', () => ({
  db: {
    documentChunks: {
      update: vi.fn().mockResolvedValue(undefined),
    },
  },
}))

vi.mock('../../ai/fastClient', () => ({
  callFastModel: vi.fn(),
}))

import { enrichChunksWithContext } from '../contextualRetrieval'
import { callFastModel } from '../../ai/fastClient'
import { db } from '../../db'

const mockLLM = vi.mocked(callFastModel)

function makeChunk(id: string, content: string) {
  return {
    id,
    documentId: 'd1',
    examProfileId: 'p1',
    content,
    chunkIndex: 0,
    keywords: '',
  }
}

describe('enrichChunksWithContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('generates context prefixes and writes to DB', async () => {
    const chunks = [makeChunk('c1', 'First chunk about linear algebra'), makeChunk('c2', 'Second chunk about calculus')]

    mockLLM.mockResolvedValue('[{"index": 0, "context": "This section covers linear algebra."}, {"index": 1, "context": "This section covers calculus."}]')

    const result = await enrichChunksWithContext(chunks, 'Math Textbook', 'A textbook covering math topics.', 'token')

    expect(result.size).toBe(2)
    expect(result.get('c1')).toBe('This section covers linear algebra.')
    expect(result.get('c2')).toBe('This section covers calculus.')

    expect(db.documentChunks.update).toHaveBeenCalledTimes(2)
    expect(db.documentChunks.update).toHaveBeenCalledWith('c1', { contextPrefix: 'This section covers linear algebra.' })
  })

  it('batches chunks into groups of 10', async () => {
    const chunks = Array.from({ length: 15 }, (_, i) => makeChunk(`c${i}`, `Chunk ${i}`))

    mockLLM
      .mockResolvedValueOnce(JSON.stringify(Array.from({ length: 10 }, (_, i) => ({ index: i, context: `Context ${i}` }))))
      .mockResolvedValueOnce(JSON.stringify(Array.from({ length: 5 }, (_, i) => ({ index: i, context: `Context ${i + 10}` }))))

    const result = await enrichChunksWithContext(chunks, 'Doc', 'Summary', 'token')

    expect(mockLLM).toHaveBeenCalledTimes(2)
    expect(result.size).toBe(15)
  })

  it('handles batch failure gracefully', async () => {
    const chunks = [makeChunk('c1', 'Chunk 1'), makeChunk('c2', 'Chunk 2')]

    mockLLM.mockRejectedValue(new Error('LLM error'))

    // Should not throw
    const result = await enrichChunksWithContext(chunks, 'Doc', 'Summary', 'token')
    expect(result.size).toBe(0)
  })

  it('handles malformed JSON gracefully', async () => {
    const chunks = [makeChunk('c1', 'Chunk 1')]

    mockLLM.mockResolvedValue('not valid json')

    const result = await enrichChunksWithContext(chunks, 'Doc', 'Summary', 'token')
    expect(result.size).toBe(0)
  })

  it('returns empty map for empty chunks', async () => {
    const result = await enrichChunksWithContext([], 'Doc', 'Summary', 'token')
    expect(result.size).toBe(0)
    expect(mockLLM).not.toHaveBeenCalled()
  })
})
