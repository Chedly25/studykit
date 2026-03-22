/**
 * Retrieval agent — intelligent search utility used by other agents.
 * Wraps hybridSearch with optional cross-document synthesis.
 */
import type { AgentContext, SearchResult } from './types'

export interface RetrievalResult {
  chunks: SearchResult[]
  synthesis?: string
}

/**
 * Intelligent search with optional cross-document synthesis.
 * Call this from other agents instead of ctx.search() when you need
 * the AI to summarize how results from different documents relate.
 */
export async function intelligentSearch(
  ctx: AgentContext,
  query: string,
  topN = 8,
): Promise<RetrievalResult> {
  const chunks = await ctx.search(query, topN)

  if (chunks.length === 0) {
    return { chunks }
  }

  // Check if results span multiple documents
  const uniqueDocs = new Set(chunks.map(c => c.chunk.documentId))

  if (uniqueDocs.size >= 3) {
    // Synthesize how results from different documents relate
    try {
      const passageList = chunks.slice(0, 6).map((c, i) =>
        `[${i + 1}] (${c.documentTitle ?? 'Source'}): ${c.chunk.content.slice(0, 200)}`
      ).join('\n\n')

      const synthesis = await ctx.llm(
        `These passages from ${uniqueDocs.size} different documents are all relevant to: "${query}"

${passageList}

In 2-3 sentences, summarize how these sources relate to each other and to the query. Note any agreements, contradictions, or complementary perspectives.`,
        'You are a research synthesis assistant. Be concise.',
      )

      return { chunks, synthesis }
    } catch {
      return { chunks }
    }
  }

  return { chunks }
}
