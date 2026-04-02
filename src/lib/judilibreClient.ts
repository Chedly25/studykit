/**
 * Client for Judilibre (Cour de cassation case law).
 * Calls /api/judilibre proxy — API key stays server-side.
 */

const API_URL = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace(/\/chat$/, '/judilibre')
  : '/api/judilibre'

// ─── Types ───────────────────────────────────────────────────────

export interface JudilibreSearchResult {
  id: string
  jurisdiction: string  // 'cc' = Cour de cassation
  chamber: string       // 'soc', 'civ1', 'civ2', 'civ3', 'com', 'crim'
  number: string        // pourvoi number e.g. '21-24.271'
  ecli: string
  decision_date: string // YYYY-MM-DD
  solution: string      // 'cassation', 'rejet', etc.
  summary: string
  themes: string[]
  highlights?: { text?: string[] }
}

export interface JudilibreSearchResponse {
  page: number
  page_size: number
  total: number
  results: JudilibreSearchResult[]
  next_page: string | null
}

export interface JudilibreDecision {
  id: string
  number: string
  ecli: string
  jurisdiction: string
  chamber: string
  decision_date: string
  solution: string
  text: string          // Full decision text
  summary: string
  themes: string[]
  zones?: Record<string, { start: number; end: number }>
}

// ─── Chamber labels ──────────────────────────────────────────────

const CHAMBER_LABELS: Record<string, string> = {
  soc: 'Chambre sociale',
  civ1: 'Première chambre civile',
  civ2: 'Deuxième chambre civile',
  civ3: 'Troisième chambre civile',
  com: 'Chambre commerciale',
  crim: 'Chambre criminelle',
  mi: 'Chambre mixte',
  pl: 'Assemblée plénière',
}

export function formatChamber(code: string): string {
  return CHAMBER_LABELS[code] ?? code
}

export function formatDecisionTitle(d: { chamber: string; decision_date: string; number: string }): string {
  const date = new Date(d.decision_date).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
  return `Cour de cassation, ${formatChamber(d.chamber)}, ${date}, n° ${d.number}`
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
    throw new Error(`Judilibre proxy ${res.status}: ${text.slice(0, 200)}`)
  }
  return res.json()
}

export async function searchDecisions(
  query: string,
  authToken: string,
  options: {
    pageSize?: number
    chamber?: string
    dateStart?: string
    dateEnd?: string
    publication?: string
  } = {},
): Promise<JudilibreSearchResponse> {
  return callProxy({
    action: 'search',
    query,
    pageSize: options.pageSize ?? 10,
    chamber: options.chamber,
    dateStart: options.dateStart,
    dateEnd: options.dateEnd,
    publication: options.publication,
  }, authToken) as Promise<JudilibreSearchResponse>
}

export async function getDecision(id: string, authToken: string): Promise<JudilibreDecision> {
  return callProxy({ action: 'decision', id }, authToken) as Promise<JudilibreDecision>
}

/**
 * Search for a decision not already used. Skips IDs in usedIds set.
 * Enforces minimum word count on full decision text.
 */
export async function searchUnusedDecision(
  query: string,
  authToken: string,
  usedIds: Set<string>,
  options: {
    pageSize?: number
    chamber?: string
    publication?: string
    minWords?: number
  } = {},
): Promise<{ searchResult: JudilibreSearchResult; decision: JudilibreDecision } | null> {
  const results = await searchDecisions(query, authToken, {
    pageSize: options.pageSize ?? 10,
    chamber: options.chamber,
    publication: options.publication ?? 'b',
  })
  for (const candidate of results.results) {
    if (usedIds.has(candidate.id)) continue
    try {
      const decision = await getDecision(candidate.id, authToken)
      const wordCount = decision.text.split(/\s+/).length
      if (wordCount < (options.minWords ?? 300)) {
        usedIds.add(candidate.id) // prevent re-fetching this short decision
        continue
      }
      return { searchResult: candidate, decision }
    } catch { continue }
  }
  return null
}
