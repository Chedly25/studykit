/**
 * Client for the Judilibre API (Cour de cassation open data).
 * Sandbox: https://sandbox-api.piste.gouv.fr/cassation/judilibre/v1.0
 * Production: https://api.piste.gouv.fr/cassation/judilibre/v1.0
 *
 * Auth: KeyId header (from PISTE sandbox/production app).
 */

const JUDILIBRE_BASE = import.meta.env.VITE_JUDILIBRE_URL
  ?? 'https://sandbox-api.piste.gouv.fr/cassation/judilibre/v1.0'

const JUDILIBRE_KEY = import.meta.env.VITE_JUDILIBRE_KEY ?? ''

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

// ─── API calls ───────────────────────────────────────────────────

export async function searchDecisions(
  query: string,
  options: {
    pageSize?: number
    chamber?: string
    dateStart?: string
    dateEnd?: string
    publication?: string  // 'b' = published au bulletin
  } = {},
): Promise<JudilibreSearchResponse> {
  const params = new URLSearchParams({
    query,
    page_size: String(options.pageSize ?? 10),
  })
  if (options.chamber) params.set('chamber', options.chamber)
  if (options.dateStart) params.set('date_start', options.dateStart)
  if (options.dateEnd) params.set('date_end', options.dateEnd)
  if (options.publication) params.set('publication', options.publication)

  const res = await fetch(`${JUDILIBRE_BASE}/search?${params}`, {
    headers: { KeyId: JUDILIBRE_KEY },
  })
  if (!res.ok) throw new Error(`Judilibre search failed: ${res.status}`)
  return res.json()
}

export async function getDecision(id: string): Promise<JudilibreDecision> {
  const res = await fetch(`${JUDILIBRE_BASE}/decision?id=${id}`, {
    headers: { KeyId: JUDILIBRE_KEY },
  })
  if (!res.ok) throw new Error(`Judilibre decision failed: ${res.status}`)
  return res.json()
}
