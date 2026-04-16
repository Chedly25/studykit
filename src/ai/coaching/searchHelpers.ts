/**
 * Shared helpers for CRFPA coaching workflows.
 * Parses the JSON-string response from searchLegalCodes into structured article refs.
 */

import type { SyllogismeArticleRef } from './types'

/**
 * searchLegalCodes returns a JSON-stringified payload with a pre-formatted
 * "results" string (see legalSearchTool.ts:57-60). We re-parse each block
 * into an object so callers can feed them into prompts or display them.
 */
export function parseSearchResults(rawJson: string): SyllogismeArticleRef[] {
  try {
    const parsed = JSON.parse(rawJson) as { results?: string; resultCount?: number; error?: string }
    if (parsed.error) return []
    if (!parsed.results) return []
    const blocks = parsed.results.split(/\n\n/)
    const articles: SyllogismeArticleRef[] = []
    for (const block of blocks) {
      const match = block.match(/^\d+\.\s*(.+?),\s*Art\.\s*(.+?)(?:\s*\((.+?)\))?\s*\n\s*(.+)$/s)
      if (!match) continue
      articles.push({
        codeName: match[1].trim(),
        articleNum: match[2].trim(),
        breadcrumb: match[3]?.trim(),
        text: match[4].trim(),
      })
    }
    return articles
  } catch {
    return []
  }
}
