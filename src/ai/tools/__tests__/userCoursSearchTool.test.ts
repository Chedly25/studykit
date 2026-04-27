import { describe, it, expect, vi, afterEach } from 'vitest'

// Mock semanticSearch — the underlying primitive — and assert behavior of the
// LLM-formatted wrapper that callers actually use.
vi.mock('../../../lib/embeddings', () => ({
  semanticSearch: vi.fn(),
}))

import { semanticSearch } from '../../../lib/embeddings'
import { searchUserCoursForLLM } from '../userCoursSearchTool'

const mockedSemanticSearch = semanticSearch as unknown as ReturnType<typeof vi.fn>

afterEach(() => {
  vi.restoreAllMocks()
  mockedSemanticSearch.mockReset()
})

describe('searchUserCoursForLLM', () => {
  it('returns resultCount=0 with a French no-results message when no chunks match', async () => {
    mockedSemanticSearch.mockResolvedValueOnce([])
    const out = JSON.parse(await searchUserCoursForLLM('responsabilité', 'profile-1', 'tok'))
    expect(out.resultCount).toBe(0)
    expect(out.results).toBe('')
    expect(out.message).toMatch(/Aucun cours téléversé/)
  })

  it('formats results with [Cours: …] prefix, extrait number, and 2-decimal score', async () => {
    mockedSemanticSearch.mockResolvedValueOnce([
      {
        id: 'c1',
        documentId: 'd1',
        documentTitle: 'Droit des obligations - Pr. Dupond',
        chunkIndex: 2,
        content: 'La responsabilité contractuelle suppose un manquement à une obligation préexistante.',
        score: 0.789,
      },
      {
        id: 'c2',
        documentId: 'd2',
        documentTitle: 'Civil L3',
        chunkIndex: 11,
        content: 'Distinction faute lourde / faute simple selon la chambre commerciale.',
        score: 0.612,
      },
    ])

    const out = JSON.parse(await searchUserCoursForLLM('responsabilité contractuelle', 'profile-1', 'tok'))
    expect(out.resultCount).toBe(2)
    expect(out.results).toContain('[Cours: Droit des obligations - Pr. Dupond]')
    expect(out.results).toContain('(extrait 3, score 0.79)')
    expect(out.results).toContain('[Cours: Civil L3]')
    expect(out.results).toContain('(extrait 12, score 0.61)')
  })

  it('truncates content longer than 600 chars and appends ellipsis', async () => {
    const long = 'a'.repeat(800)
    mockedSemanticSearch.mockResolvedValueOnce([
      { id: 'c1', documentId: 'd1', documentTitle: 'Doc', chunkIndex: 0, content: long, score: 0.9 },
    ])
    const out = JSON.parse(await searchUserCoursForLLM('q', 'profile-1', 'tok'))
    // 600 chars + "…"
    expect(out.results).toMatch(/a{600}…/)
    expect(out.results).not.toMatch(/a{601}/)
  })

  it('honors topK by forwarding it to semanticSearch', async () => {
    mockedSemanticSearch.mockResolvedValueOnce([])
    await searchUserCoursForLLM('q', 'profile-1', 'tok', { topK: 3 })
    expect(mockedSemanticSearch).toHaveBeenCalledWith('profile-1', 'q', 'tok', 3)
  })

  it('filters out results below the configured minScore', async () => {
    mockedSemanticSearch.mockResolvedValueOnce([
      { id: 'c1', documentId: 'd1', documentTitle: 'A', chunkIndex: 0, content: 'high', score: 0.9 },
      { id: 'c2', documentId: 'd2', documentTitle: 'B', chunkIndex: 1, content: 'low', score: 0.2 },
    ])
    const out = JSON.parse(await searchUserCoursForLLM('q', 'profile-1', 'tok', { minScore: 0.5 }))
    expect(out.resultCount).toBe(1)
    expect(out.results).toContain('[Cours: A]')
    expect(out.results).not.toContain('[Cours: B]')
  })

  it('falls back to "Cours" when documentTitle is missing', async () => {
    mockedSemanticSearch.mockResolvedValueOnce([
      { id: 'c1', documentId: 'd1', documentTitle: undefined, chunkIndex: 0, content: 'x', score: 0.9 },
    ])
    const out = JSON.parse(await searchUserCoursForLLM('q', 'profile-1', 'tok'))
    expect(out.results).toContain('[Cours: Cours]')
  })

  it('returns an error envelope when semanticSearch throws', async () => {
    mockedSemanticSearch.mockRejectedValueOnce(new Error('IndexedDB unavailable'))
    const out = JSON.parse(await searchUserCoursForLLM('q', 'profile-1', 'tok'))
    expect(out.error).toMatch(/IndexedDB unavailable/)
  })
})
