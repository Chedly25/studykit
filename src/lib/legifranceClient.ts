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
  num: string
  etat: string
  texteHtml: string
  texte?: string
}

export interface LegifranceSearchExtract {
  id: string
  num: string
  legalStatus: string
  dateDebut?: string
  dateFin?: string
  values?: string[]
}

export interface LegifranceSearchSection {
  id: string
  title: string | null
  extracts?: LegifranceSearchExtract[]
}

export interface LegifranceSearchResult {
  titles: Array<{
    id: string
    cid: string
    title: string | null
    legalStatus: string | null
    nature: string | null
  }>
  sections?: LegifranceSearchSection[]
  extracts?: string[]
  nature: string
}

export interface LegifranceSearchResponse {
  totalResultNumber: number
  results: LegifranceSearchResult[]
  executionTime: number
}

export interface LegifranceSectionResult {
  sectionTitle: string
  codeName: string
  articles: LegifranceArticle[]
  concatenatedText: string
  wordCount: number
  sourceUrl: string
}

// ─── API calls ───────────────────────────────────────────────────

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

export async function getArticle(id: string, authToken: string): Promise<LegifranceArticle | null> {
  const data = await callProxy({ action: 'getArticle', id }, authToken) as { article: LegifranceArticle | null }
  return data.article ?? null
}

export async function getArticlesBatch(ids: string[], authToken: string): Promise<LegifranceArticle[]> {
  const data = await callProxy({ action: 'getArticles', ids: ids.slice(0, 10) }, authToken) as {
    articles: LegifranceArticle[]
  }
  return data.articles ?? []
}

// ─── Relevance scoring ──────────────────────────────────────────

function scoreExtractRelevance(
  extract: LegifranceSearchExtract,
  queryTerms: string[],
): number {
  const text = [
    extract.num ?? '',
    ...(extract.values ?? []),
  ].join(' ').toLowerCase()
  let score = 0
  for (const term of queryTerms) {
    if (text.includes(term)) score++
  }
  // Bonus for VIGUEUR (in force)
  if (extract.legalStatus === 'VIGUEUR') score += 2
  // Penalty for ABROGE
  if (extract.legalStatus === 'ABROGE') score -= 10
  return score
}

function scoreSectionRelevance(
  section: LegifranceSearchSection,
  queryTerms: string[],
): number {
  const titleText = (section.title ?? '').replace(/<[^>]+>/g, '').toLowerCase()
  let score = 0
  for (const term of queryTerms) {
    if (titleText.includes(term)) score += 3 // title match is strong signal
  }
  // Add best extract score
  for (const extract of section.extracts ?? []) {
    score += scoreExtractRelevance(extract, queryTerms)
  }
  return score
}

// ─── Section-level fetch ────────────────────────────────────────

interface ScoredSection {
  section: LegifranceSearchSection
  codeName: string
  codeCid: string
  score: number
  articleIds: string[] // LEGIARTI IDs to fetch
}

/**
 * Search Legifrance and fetch an entire relevant section with all its articles.
 * Scores candidates by query relevance, fetches the best section.
 */
export async function searchAndFetchSection(
  query: string,
  authToken: string,
  options: {
    fond?: 'CODE_ETAT' | 'LODA_ETAT'
    codeNames?: string[]
    minWords?: number
  } = {},
): Promise<LegifranceSectionResult | null> {
  const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2)
  const minWords = options.minWords ?? 300

  for (const fond of [options.fond ?? 'CODE_ETAT', 'LODA_ETAT'] as const) {
    try {
      const searchResult = await searchLegifrance(query, authToken, {
        fond,
        codeNames: options.codeNames,
        pageSize: 5,
      })
      if (!searchResult.results?.length) continue

      // Collect and score ALL sections across ALL results
      const scoredSections: ScoredSection[] = []

      for (const result of searchResult.results) {
        const topTitle = result.titles?.[0]
        const codeName = (topTitle?.title ?? '').replace(/<[^>]+>/g, '')
        const codeCid = topTitle?.cid ?? ''

        for (const section of result.sections ?? []) {
          const articleIds = (section.extracts ?? [])
            .filter(e => e.id?.startsWith('LEGIARTI') && e.legalStatus !== 'ABROGE')
            .map(e => e.id)

          if (articleIds.length === 0) continue

          const score = scoreSectionRelevance(section, queryTerms)
          scoredSections.push({ section, codeName, codeCid, score, articleIds })
        }
      }

      // Sort by score descending
      scoredSections.sort((a, b) => b.score - a.score)

      // Try each section until we find one with enough content
      for (const candidate of scoredSections) {
        const articles = await getArticlesBatch(candidate.articleIds.slice(0, 10), authToken)
        if (articles.length === 0) continue

        // Filter out abrogated and build concatenated text
        const validArticles = articles.filter(a => a.etat !== 'ABROGE')
        if (validArticles.length === 0) continue

        const concatenated = validArticles
          .map(a => `Art. ${a.num} — ${stripHtml(a.texteHtml ?? a.texte ?? '')}`)
          .join('\n\n')

        const wordCount = concatenated.split(/\s+/).length
        if (wordCount < minWords) continue

        const sectionTitle = (candidate.section.title ?? '').replace(/<[^>]+>/g, '')

        return {
          sectionTitle,
          codeName: candidate.codeName,
          articles: validArticles,
          concatenatedText: concatenated,
          wordCount,
          sourceUrl: `https://www.legifrance.gouv.fr/codes/section_lc/${candidate.section.id}`,
        }
      }
    } catch { continue }
  }
  return null
}

// ─── HTML stripping ─────────────────────────────────────────────

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
