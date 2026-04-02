/**
 * Client-side web search function.
 * Calls the /api/search endpoint (Tavily proxy).
 */

const SEARCH_URL = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace(/\/chat$/, '/search')
  : '/api/search'

export interface SearchResult {
  title: string
  url: string
  content: string
  score: number
}

interface SearchResponse {
  results: SearchResult[]
  answer?: string
  unavailable?: boolean
  error?: string
}

/**
 * Search the web via the backend Tavily proxy.
 * Returns formatted text suitable for LLM context, or empty string on failure.
 */
export async function searchWeb(
  query: string,
  authToken: string,
  maxResults = 5,
): Promise<string> {
  try {
    const response = await fetch(SEARCH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ query, maxResults }),
    })

    if (!response.ok) return ''

    const data = (await response.json()) as SearchResponse

    if (data.unavailable || data.results.length === 0) return ''

    const parts: string[] = []
    if (data.answer) {
      parts.push(`Web search summary: ${data.answer}`)
    }
    for (const r of data.results) {
      parts.push(`[${r.title}](${r.url})\n${r.content}`)
    }
    return parts.join('\n\n---\n\n')
  } catch {
    return ''
  }
}

/**
 * Search web and return structured results (not formatted string).
 */
export async function searchWebStructured(
  query: string,
  authToken: string,
  maxResults = 5,
): Promise<SearchResult[]> {
  try {
    const response = await fetch(SEARCH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ query, maxResults }),
    })
    if (!response.ok) return []
    const data = (await response.json()) as SearchResponse
    if (data.unavailable) return []
    return data.results ?? []
  } catch {
    return []
  }
}

/**
 * Extract full page content from a URL via Tavily extract.
 */
export async function extractUrlContent(
  url: string,
  authToken: string,
): Promise<{ content: string; title: string } | null> {
  try {
    const response = await fetch(SEARCH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ action: 'extract', urls: [url] }),
    })
    if (!response.ok) return null
    const data = (await response.json()) as { results?: Array<{ url: string; raw_content?: string; title?: string }> }
    const result = data.results?.[0]
    if (!result?.raw_content) return null
    return { content: result.raw_content, title: result.title ?? '' }
  } catch {
    return null
  }
}
