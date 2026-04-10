import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock db module
vi.mock('../../db', () => ({
  db: {
    chunkEmbeddings: {
      bulkPut: vi.fn().mockResolvedValue(undefined),
      where: vi.fn().mockReturnValue({
        equals: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([]),
          count: vi.fn().mockResolvedValue(0),
          delete: vi.fn().mockResolvedValue(0),
        }),
      }),
    },
    documentChunks: {
      where: vi.fn().mockReturnValue({
        anyOf: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([]),
        }),
      }),
    },
    documents: {
      where: vi.fn().mockReturnValue({
        anyOf: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([]),
        }),
      }),
    },
  },
}))

// Mock sources module
vi.mock('../sources', () => ({
  searchChunks: vi.fn().mockResolvedValue([]),
}))

// Mock requestGate to bypass concurrency/delay
vi.mock('../requestGate', () => ({
  embedGate: {},
  fetchWithGate: vi.fn((_gate: unknown, doFetch: () => Promise<Response>) => doFetch()),
}))

import {
  base64ToFloat32Array,
  cosineSimilarity,
  generateEmbeddings,
  embedQuery,
  embedAndStoreChunks,
  semanticSearch,
  hasEmbeddings,
  deleteEmbeddings,
} from '../embeddings'
import { db } from '../../db'
import { searchChunks } from '../sources'

// ─── Helpers ──────────────────────────────────────────────────────

/** Create a base64-encoded Float32Array from values */
function float32ToBase64(values: number[]): string {
  const floats = new Float32Array(values)
  const bytes = new Uint8Array(floats.buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

// ─── Tests ───────────────────────────────────────────────────────

describe('base64ToFloat32Array', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('converts base64 to Float32Array correctly', () => {
    const original = [1.0, 2.5, -3.0, 0.0]
    const b64 = float32ToBase64(original)
    const result = base64ToFloat32Array(b64)

    expect(result).toBeInstanceOf(Float32Array)
    expect(result.length).toBe(4)
    expect(result[0]).toBeCloseTo(1.0)
    expect(result[1]).toBeCloseTo(2.5)
    expect(result[2]).toBeCloseTo(-3.0)
    expect(result[3]).toBeCloseTo(0.0)
  })

  it('handles empty base64', () => {
    const b64 = float32ToBase64([])
    const result = base64ToFloat32Array(b64)
    expect(result.length).toBe(0)
  })
})

describe('cosineSimilarity', () => {
  it('returns 1 for identical vectors', () => {
    const a = new Float32Array([1, 2, 3])
    expect(cosineSimilarity(a, a)).toBeCloseTo(1.0)
  })

  it('returns 0 for orthogonal vectors', () => {
    const a = new Float32Array([1, 0])
    const b = new Float32Array([0, 1])
    expect(cosineSimilarity(a, b)).toBeCloseTo(0.0)
  })

  it('returns -1 for opposite vectors', () => {
    const a = new Float32Array([1, 0, 0])
    const b = new Float32Array([-1, 0, 0])
    expect(cosineSimilarity(a, b)).toBeCloseTo(-1.0)
  })

  it('returns 0 for zero vector', () => {
    const a = new Float32Array([0, 0, 0])
    const b = new Float32Array([1, 2, 3])
    expect(cosineSimilarity(a, b)).toBe(0)
  })

  it('returns 0 for both zero vectors', () => {
    const a = new Float32Array([0, 0, 0])
    expect(cosineSimilarity(a, a)).toBe(0)
  })

  it('computes correct similarity for arbitrary vectors', () => {
    const a = new Float32Array([1, 2, 3])
    const b = new Float32Array([4, 5, 6])
    // dot=32, normA=14, normB=77
    const expected = 32 / (Math.sqrt(14) * Math.sqrt(77))
    expect(cosineSimilarity(a, b)).toBeCloseTo(expected)
  })
})

describe('generateEmbeddings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sends texts to /api/embed and returns embeddings', async () => {
    const emb1 = float32ToBase64([1, 0])
    const emb2 = float32ToBase64([0, 1])
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      jsonResponse({ embeddings: [emb1, emb2] }),
    ))

    const result = await generateEmbeddings(['hello', 'world'], 'token')

    expect(result).toEqual([emb1, emb2])
    expect(fetch).toHaveBeenCalledOnce()
  })

  it('batches requests in groups of 50', async () => {
    const texts = Array.from({ length: 75 }, (_, i) => `text-${i}`)
    const batch1 = Array.from({ length: 50 }, () => float32ToBase64([1]))
    const batch2 = Array.from({ length: 25 }, () => float32ToBase64([2]))

    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ embeddings: batch1 }))
      .mockResolvedValueOnce(jsonResponse({ embeddings: batch2 }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await generateEmbeddings(texts, 'token')

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(result.length).toBe(75)
  })

  it('throws on non-retryable API error (401)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response('Unauthorized', { status: 401, headers: { 'Content-Type': 'text/plain' } }),
    ))

    await expect(generateEmbeddings(['test'], 'token'))
      .rejects.toThrow('Embedding API error: 401')
  })

  it('includes auth header', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ embeddings: [float32ToBase64([1])] }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await generateEmbeddings(['test'], 'my-token')

    const headers = fetchMock.mock.calls[0][1].headers
    expect(headers['Authorization']).toBe('Bearer my-token')
  })
})

describe('embedQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns Float32Array from single text embedding', async () => {
    const emb = float32ToBase64([0.5, 0.5])
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      jsonResponse({ embeddings: [emb] }),
    ))

    const result = await embedQuery('hello', 'token')

    expect(result).toBeInstanceOf(Float32Array)
    expect(result[0]).toBeCloseTo(0.5)
    expect(result[1]).toBeCloseTo(0.5)
  })
})

describe('embedAndStoreChunks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns immediately for empty chunks', async () => {
    await embedAndStoreChunks([], 'token')
    expect(fetch).not.toHaveBeenCalled?.()
  })

  it('generates embeddings and stores in db', async () => {
    const emb = float32ToBase64([1, 0])
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      jsonResponse({ embeddings: [emb] }),
    ))

    const chunks = [{
      id: 'c1',
      documentId: 'd1',
      examProfileId: 'p1',
      content: 'Test content',
      chunkIndex: 0,
      keywords: '',
    }]

    await embedAndStoreChunks(chunks, 'token')

    expect(db.chunkEmbeddings.bulkPut).toHaveBeenCalledOnce()
    const rows = vi.mocked(db.chunkEmbeddings.bulkPut).mock.calls[0][0]
    expect(rows[0].chunkId).toBe('c1')
    expect(rows[0].documentId).toBe('d1')
    expect(rows[0].embedding).toBe(emb)
  })

  it('uses contextPrefix when present', async () => {
    const emb = float32ToBase64([1])
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ embeddings: [emb] }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const chunks = [{
      id: 'c1',
      documentId: 'd1',
      examProfileId: 'p1',
      content: 'content',
      contextPrefix: 'This is about math.',
      chunkIndex: 0,
      keywords: '',
    }]

    await embedAndStoreChunks(chunks, 'token')

    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.texts[0]).toBe('This is about math.\ncontent')
  })
})

describe('semanticSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('falls back to TF-IDF when no auth token', async () => {
    vi.mocked(searchChunks).mockResolvedValue([])
    const result = await semanticSearch('p1', 'query', undefined)

    expect(searchChunks).toHaveBeenCalledWith('p1', 'query', 5)
    expect(result).toEqual([])
  })

  it('falls back to TF-IDF when no embeddings exist', async () => {
    vi.stubGlobal('fetch', vi.fn())
    vi.mocked(searchChunks).mockResolvedValue([])

    const result = await semanticSearch('p1', 'query', 'token')

    expect(searchChunks).toHaveBeenCalledWith('p1', 'query', 5)
    expect(result).toEqual([])
  })

  it('performs semantic search when embeddings exist', async () => {
    const emb1 = float32ToBase64([1, 0])
    const emb2 = float32ToBase64([0.9, 0.1])
    const queryEmb = float32ToBase64([1, 0])

    // Mock db.chunkEmbeddings query
    vi.mocked(db.chunkEmbeddings.where).mockReturnValue({
      equals: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue([
          { chunkId: 'c1', examProfileId: 'p1', embedding: emb1, documentId: 'd1' },
          { chunkId: 'c2', examProfileId: 'p1', embedding: emb2, documentId: 'd1' },
        ]),
        count: vi.fn().mockResolvedValue(2),
        delete: vi.fn(),
      }),
    } as never)

    // Mock embedQuery (fetch for the query itself)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      jsonResponse({ embeddings: [queryEmb] }),
    ))

    // Mock documentChunks
    vi.mocked(db.documentChunks.where).mockReturnValue({
      anyOf: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue([
          { id: 'c1', documentId: 'd1', content: 'chunk1', chunkIndex: 0 },
          { id: 'c2', documentId: 'd1', content: 'chunk2', chunkIndex: 1 },
        ]),
      }),
    } as never)

    // Mock documents
    vi.mocked(db.documents.where).mockReturnValue({
      anyOf: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue([
          { id: 'd1', title: 'Test Doc' },
        ]),
      }),
    } as never)

    const result = await semanticSearch('p1', 'test query', 'token', 5)

    expect(result.length).toBeGreaterThan(0)
    expect(result[0].documentTitle).toBe('Test Doc')
    expect(result[0].score).toBeGreaterThan(0.3)
  })

  it('falls back to TF-IDF on semantic search error', async () => {
    vi.mocked(db.chunkEmbeddings.where).mockReturnValue({
      equals: vi.fn().mockReturnValue({
        toArray: vi.fn().mockRejectedValue(new Error('DB error')),
      }),
    } as never)

    vi.mocked(searchChunks).mockResolvedValue([])

    const result = await semanticSearch('p1', 'query', 'token')
    expect(searchChunks).toHaveBeenCalledWith('p1', 'query', 5)
    expect(result).toEqual([])
  })
})

describe('hasEmbeddings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns true when count > 0', async () => {
    vi.mocked(db.chunkEmbeddings.where).mockReturnValue({
      equals: vi.fn().mockReturnValue({
        count: vi.fn().mockResolvedValue(5),
        toArray: vi.fn(),
        delete: vi.fn(),
      }),
    } as never)

    expect(await hasEmbeddings('d1')).toBe(true)
  })

  it('returns false when count is 0', async () => {
    vi.mocked(db.chunkEmbeddings.where).mockReturnValue({
      equals: vi.fn().mockReturnValue({
        count: vi.fn().mockResolvedValue(0),
        toArray: vi.fn(),
        delete: vi.fn(),
      }),
    } as never)

    expect(await hasEmbeddings('d1')).toBe(false)
  })
})

describe('deleteEmbeddings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('deletes embeddings by documentId', async () => {
    const deleteFn = vi.fn().mockResolvedValue(3)
    vi.mocked(db.chunkEmbeddings.where).mockReturnValue({
      equals: vi.fn().mockReturnValue({
        delete: deleteFn,
        toArray: vi.fn(),
        count: vi.fn(),
      }),
    } as never)

    await deleteEmbeddings('d1')
    expect(deleteFn).toHaveBeenCalledOnce()
  })
})
