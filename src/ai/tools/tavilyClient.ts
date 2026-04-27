/**
 * Client-side wrapper over our `/api/tavily-search` endpoint.
 *
 * Why go through our own endpoint (and not Tavily directly):
 *  - TAVILY_API_KEY stays server-side.
 *  - Server-side re-validation of `includeDomains` against our whitelist
 *    prevents client bypass.
 *  - Centralised rate limiting + cost protection (same pattern as /api/embed).
 *  - Single place to evolve the response shape.
 *
 * Used by the legal fiche coach to assemble the Actualité section.
 */

import { isHostInAllowlist } from '../../lib/domainAllowlist'

export interface TavilySearchOptions {
  /** The user-phrased query — typically `{theme} jurisprudence 2024 2025 2026`. */
  query: string
  /** Bare domains (no protocol, no path). Server re-checks this list. */
  includeDomains: string[]
  /** Max results Tavily should return. Default 10, hard-capped to 20 server-side. */
  maxResults?: number
  /** Default 'general'. Use 'news' when we explicitly want very recent press-style coverage. */
  topic?: 'general' | 'news'
  /** Restrict to last N days. Default 540 (~18 months). */
  days?: number
}

export interface TavilyResult {
  url: string
  title: string
  /** Snippet from Tavily, typically 200-400 chars of surrounding context. */
  content: string
  /** Relevance score Tavily attaches. Higher is better. */
  score: number
  /** ISO 8601 if Tavily could parse a publication date from the page. */
  publishedDate?: string
}

export interface TavilySearchResult {
  results: TavilyResult[]
  /** True when every result's host was in the allowlist (server side check). */
  allAllowlisted: boolean
  /** Populated only if Tavily returned zero usable results. */
  reason?: string
}

export class TavilyUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TavilyUnavailableError'
  }
}

const DEFAULT_DAYS = 540
const DEFAULT_MAX_RESULTS = 10

/**
 * Hit `/api/tavily-search`. Throws `TavilyUnavailableError` on transport /
 * server errors (500, 502, key-missing). Returns an empty result array on 200
 * with no hits — that's a normal outcome.
 *
 * Defense-in-depth: the client re-filters the server's response against the
 * caller-supplied `includeDomains`, so if the server misbehaved we still don't
 * let off-list URLs through.
 */
export async function tavilySearch(
  opts: TavilySearchOptions,
  authToken: string,
  signal?: AbortSignal,
): Promise<TavilySearchResult> {
  const body = {
    query: opts.query,
    includeDomains: opts.includeDomains,
    maxResults: opts.maxResults ?? DEFAULT_MAX_RESULTS,
    topic: opts.topic ?? 'general',
    days: opts.days ?? DEFAULT_DAYS,
  }

  let res: Response
  try {
    res = await fetch('/api/tavily-search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(body),
      signal,
    })
  } catch (err) {
    throw new TavilyUnavailableError(`Requête Tavily interrompue : ${(err as Error).message}`)
  }

  if (res.status === 503) {
    throw new TavilyUnavailableError('Recherche web non configurée sur le serveur (clé Tavily manquante)')
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new TavilyUnavailableError(`Échec recherche Tavily (${res.status}) : ${text.slice(0, 200)}`)
  }

  let payload: { results?: TavilyResult[]; reason?: string }
  try {
    payload = await res.json() as { results?: TavilyResult[]; reason?: string }
  } catch {
    throw new TavilyUnavailableError('Réponse Tavily illisible')
  }

  const raw = payload.results ?? []
  // Defense-in-depth: re-filter against the caller's allowlist
  const filtered = raw.filter(r => isHostInAllowlist(r.url, opts.includeDomains))
  const allAllowlisted = filtered.length === raw.length

  return {
    results: filtered,
    allAllowlisted,
    reason: filtered.length === 0 ? (payload.reason ?? 'Aucun résultat pertinent') : undefined,
  }
}
