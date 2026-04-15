/**
 * Client-side legal search tool.
 * Embeds query locally with BGE-M3 via transformers.js, then queries Vectorize via /api/legal-search.
 * Falls back to server-side embedding if local model unavailable.
 */

const LEGAL_SEARCH_URL = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace(/\/chat$/, '/legal-search')
  : '/api/legal-search'

interface LegalSearchResult {
  id: string
  score: number
  articleNum: string
  codeName: string
  breadcrumb: string
  text: string
}

/**
 * Search French legal codes via semantic search.
 * Returns formatted text suitable for LLM context.
 */
export async function searchLegalCodes(
  query: string,
  authToken: string,
  options?: { topK?: number; codeName?: string },
): Promise<string> {
  try {
    const res = await fetch(LEGAL_SEARCH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        query,
        topK: options?.topK ?? 10,
        codeName: options?.codeName,
      }),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return JSON.stringify({ error: `Legal search failed (${res.status}): ${text.slice(0, 200)}` })
    }

    const data = await res.json() as { results: LegalSearchResult[]; count: number }

    if (!data.results?.length) {
      return JSON.stringify({
        resultCount: 0,
        message: 'No matching legal articles found. Provide a general explanation based on your legal knowledge.',
      })
    }

    const formatted = data.results.map((r, i) => {
      const location = r.breadcrumb ? ` (${r.breadcrumb})` : ''
      return `${i + 1}. ${r.codeName}, Art. ${r.articleNum}${location}\n   ${r.text}`
    }).join('\n\n')

    return JSON.stringify({
      resultCount: data.count,
      message: `Found ${data.count} relevant legal articles:`,
      results: formatted,
    })
  } catch (err) {
    return JSON.stringify({ error: `Legal search unavailable: ${(err as Error).message}` })
  }
}
