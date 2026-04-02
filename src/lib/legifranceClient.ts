/**
 * Client for Legifrance API (legislation, codes, JORF).
 * Calls /api/legifrance proxy — PISTE OAuth credentials stay server-side.
 */

const API_URL = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace(/\/chat$/, '/legifrance')
  : '/api/legifrance'

// ─── Types ───────────────────────────────────────────────────────

export interface LegifranceArticle {
  id: string
  num: string       // e.g. "L135-4"
  etat: string      // "VIGUEUR", "MODIFIE", "ABROGE"
  texteHtml: string  // HTML content
  texte?: string     // plain text fallback
}

export interface LegifranceSearchResult {
  titles: Array<{
    id: string
    cid: string
    title: string | null
    legalStatus: string | null
    nature: string | null
  }>
  sections?: Array<{
    id: string
    title: string | null
    extracts?: Array<{
      id: string       // LEGIARTI ID — usable with getArticle
      num: string      // article number
      legalStatus: string
      values?: string[]
    }>
  }>
  extracts?: string[]
  nature: string
}

export interface LegifranceSearchResponse {
  totalResultNumber: number
  results: LegifranceSearchResult[]
  executionTime: number
}

// ─── API calls (via server proxy) ────────────────────────────────

async function callProxy(body: Record<string, unknown>, authToken: string): Promise<unknown> {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Legifrance proxy ${res.status}: ${text.slice(0, 200)}`)
  }
  return res.json()
}

/**
 * Search legislation (codes or laws/decrees).
 * fond: "CODE_ETAT" for current code articles, "LODA_ETAT" for laws/decrees
 */
export async function searchLegifrance(
  query: string,
  authToken: string,
  options: {
    fond?: 'CODE_ETAT' | 'LODA_ETAT' | 'CODE_DATE' | 'LODA_DATE'
    codeNames?: string[]
    typeRecherche?: 'UN_DES_MOTS' | 'EXACTE' | 'TOUS_LES_MOTS_DANS_UN_CHAMP'
    pageSize?: number
  } = {},
): Promise<LegifranceSearchResponse> {
  return callProxy({
    action: 'search',
    query,
    fond: options.fond ?? 'CODE_ETAT',
    codeNames: options.codeNames,
    typeRecherche: options.typeRecherche ?? 'UN_DES_MOTS',
    pageSize: options.pageSize ?? 5,
  }, authToken) as Promise<LegifranceSearchResponse>
}

/**
 * Get a specific article by its LEGIARTI ID.
 */
export async function getArticle(
  id: string,
  authToken: string,
): Promise<LegifranceArticle | null> {
  const data = await callProxy({ action: 'getArticle', id }, authToken) as {
    article: LegifranceArticle | null
  }
  return data.article ?? null
}

/**
 * Search and return the first matching article with its full text.
 * Searches both CODE_ETAT and LODA_ETAT, extracts article IDs from results,
 * then fetches the full article content.
 */
export async function searchAndFetchArticle(
  query: string,
  authToken: string,
  options: {
    fond?: 'CODE_ETAT' | 'LODA_ETAT'
    codeNames?: string[]
  } = {},
): Promise<{ article: LegifranceArticle; title: string; sourceUrl: string } | null> {
  try {
    const searchResult = await searchLegifrance(query, authToken, {
      fond: options.fond ?? 'CODE_ETAT',
      codeNames: options.codeNames,
      pageSize: 3,
    })

    if (!searchResult.results?.length) return null

    // Extract LEGIARTI IDs from search results (in sections > extracts)
    for (const result of searchResult.results) {
      // Get the code/law title
      const topTitle = result.titles?.[0]
      const codeName = topTitle?.title?.replace(/<[^>]+>/g, '') ?? ''

      for (const section of result.sections ?? []) {
        for (const extract of section.extracts ?? []) {
          if (!extract.id?.startsWith('LEGIARTI')) continue
          if (extract.legalStatus === 'ABROGE') continue // skip abrogated

          const article = await getArticle(extract.id, authToken)
          if (!article || article.etat === 'ABROGE') continue

          const sectionTitle = section.title?.replace(/<[^>]+>/g, '') ?? ''
          return {
            article,
            title: `${codeName} — Art. ${article.num}${sectionTitle ? ` (${sectionTitle})` : ''}`,
            sourceUrl: `https://www.legifrance.gouv.fr/codes/article_lc/${extract.id}`,
          }
        }
      }
    }
  } catch { /* fall through */ }
  return null
}

/**
 * Strip HTML tags from Legifrance article content.
 */
export function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}
