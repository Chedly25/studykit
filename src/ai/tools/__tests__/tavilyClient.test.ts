import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { tavilySearch, TavilyUnavailableError } from '../tavilyClient'

type FetchMock = ReturnType<typeof vi.fn<typeof fetch>>

function mockFetchWith(fn: (url: string, init: RequestInit) => Response | Promise<Response>): FetchMock {
  const m = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString()
    return fn(url, init ?? {})
  }) as unknown as FetchMock
  globalThis.fetch = m as unknown as typeof fetch
  return m
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const ALLOWLIST = ['courdecassation.fr', 'dalloz-actualite.fr']

afterEach(() => {
  vi.restoreAllMocks()
})

describe('tavilySearch', () => {
  it('POSTs to /api/tavily-search with the expected payload', async () => {
    const capturedBody: unknown[] = []
    mockFetchWith((url, init) => {
      expect(url).toContain('/api/tavily-search')
      expect(init.method).toBe('POST')
      expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok')
      capturedBody.push(JSON.parse(String(init.body)))
      return jsonResponse({ results: [] })
    })

    await tavilySearch(
      { query: 'test', includeDomains: ALLOWLIST, maxResults: 6, topic: 'news', days: 180 },
      'tok',
    )

    expect(capturedBody).toHaveLength(1)
    expect(capturedBody[0]).toEqual({
      query: 'test',
      includeDomains: ALLOWLIST,
      maxResults: 6,
      topic: 'news',
      days: 180,
    })
  })

  it('defaults maxResults / topic / days when caller omits them', async () => {
    let body: { maxResults?: number; topic?: string; days?: number } | undefined
    mockFetchWith((_, init) => {
      body = JSON.parse(String(init.body))
      return jsonResponse({ results: [] })
    })
    await tavilySearch({ query: 'x', includeDomains: ALLOWLIST }, 'tok')
    expect(body?.maxResults).toBe(10)
    expect(body?.topic).toBe('general')
    expect(body?.days).toBe(540)
  })

  it('returns server results as-is when every URL is in the allowlist', async () => {
    mockFetchWith(() => jsonResponse({
      results: [
        { url: 'https://courdecassation.fr/a', title: 'A', content: 'x', score: 0.9 },
        { url: 'https://www.dalloz-actualite.fr/b', title: 'B', content: 'y', score: 0.8 },
      ],
    }))

    const out = await tavilySearch({ query: 't', includeDomains: ALLOWLIST }, 'tok')
    expect(out.results).toHaveLength(2)
    expect(out.allAllowlisted).toBe(true)
    expect(out.reason).toBeUndefined()
  })

  it('DEFENSE-IN-DEPTH: strips off-allowlist URLs even when server mistakenly returns them', async () => {
    mockFetchWith(() => jsonResponse({
      results: [
        { url: 'https://courdecassation.fr/ok', title: 'OK', content: 'x', score: 0.9 },
        { url: 'https://evil.com/leak', title: 'Evil', content: 'y', score: 0.9 },
      ],
    }))

    const out = await tavilySearch({ query: 't', includeDomains: ALLOWLIST }, 'tok')
    expect(out.results.map(r => r.url)).toEqual(['https://courdecassation.fr/ok'])
    expect(out.allAllowlisted).toBe(false)
  })

  it('surfaces server reason when results are empty', async () => {
    mockFetchWith(() => jsonResponse({ results: [], reason: 'nothing relevant' }))
    const out = await tavilySearch({ query: 't', includeDomains: ALLOWLIST }, 'tok')
    expect(out.results).toEqual([])
    expect(out.reason).toBe('nothing relevant')
  })

  it('throws TavilyUnavailableError on 503 (missing key)', async () => {
    mockFetchWith(() => jsonResponse({ error: 'not configured' }, 503))
    await expect(
      tavilySearch({ query: 't', includeDomains: ALLOWLIST }, 'tok'),
    ).rejects.toBeInstanceOf(TavilyUnavailableError)
  })

  it('throws TavilyUnavailableError on non-503 non-OK responses', async () => {
    mockFetchWith(() => jsonResponse({ error: 'boom' }, 502))
    await expect(
      tavilySearch({ query: 't', includeDomains: ALLOWLIST }, 'tok'),
    ).rejects.toBeInstanceOf(TavilyUnavailableError)
  })

  it('throws TavilyUnavailableError on transport error', async () => {
    mockFetchWith(() => { throw new Error('network down') })
    await expect(
      tavilySearch({ query: 't', includeDomains: ALLOWLIST }, 'tok'),
    ).rejects.toBeInstanceOf(TavilyUnavailableError)
  })

  it('throws TavilyUnavailableError on unparseable body', async () => {
    mockFetchWith(() => new Response('not json', {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))
    await expect(
      tavilySearch({ query: 't', includeDomains: ALLOWLIST }, 'tok'),
    ).rejects.toBeInstanceOf(TavilyUnavailableError)
  })

  it('passes the AbortSignal through to fetch', async () => {
    const ac = new AbortController()
    const fetchMock = mockFetchWith(() => jsonResponse({ results: [] }))
    await tavilySearch({ query: 't', includeDomains: ALLOWLIST }, 'tok', ac.signal)
    const lastInit = fetchMock.mock.calls[0][1] as RequestInit
    expect(lastInit.signal).toBe(ac.signal)
  })

  it('maps publishedDate from snake_case if server normalized it', async () => {
    mockFetchWith(() => jsonResponse({
      results: [
        { url: 'https://courdecassation.fr/a', title: 'A', content: 'x', score: 0.9, publishedDate: '2025-03-14' },
      ],
    }))
    const out = await tavilySearch({ query: 't', includeDomains: ALLOWLIST }, 'tok')
    expect(out.results[0].publishedDate).toBe('2025-03-14')
  })
})
