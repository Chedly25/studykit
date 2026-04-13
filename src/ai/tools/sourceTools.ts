/**
 * AI tool implementations for source retrieval.
 */
import { getChunksByDocumentId } from '../../lib/sources'
import { hybridSearch } from '../../lib/hybridSearch'
import { db } from '../../db'

export async function searchSourcesTool(
  examProfileId: string,
  query: string,
  topN = 5,
  authToken?: string,
): Promise<string> {
  const results = await hybridSearch(examProfileId, query, authToken, { topN })
  const uniqueDocs = new Set(results.map(r => r.documentTitle)).size
  if (results.length === 0) {
    return JSON.stringify({
      results: [],
      resultCount: 0,
      documentsSearched: 0,
      message: `No matching content found in uploaded sources for query: "${query}". Tell the student you could not find this in their materials and provide a general explanation instead.`,
    })
  }
  return JSON.stringify({
    resultCount: results.length,
    documentsMatched: uniqueDocs,
    message: `Found ${results.length} relevant passage(s) across ${uniqueDocs} document(s). Cite the sources using [Source: "Title", §ChunkIndex] format.`,
    results: results.map(r => ({
      documentTitle: r.documentTitle,
      content: r.content,
      score: Math.round(r.score * 1000) / 1000,
      chunkIndex: r.chunkIndex,
    })),
  })
}

export async function getDocumentContentTool(
  examProfileId: string,
  documentId: string,
): Promise<string> {
  const doc = await db.documents.get(documentId)
  if (!doc || doc.examProfileId !== examProfileId) {
    return JSON.stringify({ error: 'Document not found' })
  }

  const chunks = await getChunksByDocumentId(documentId)
  // Truncate to ~2000 tokens worth of content
  let content = ''
  for (const chunk of chunks) {
    if ((content + chunk.content).split(/\s+/).length > 2000) break
    content += (content ? '\n\n' : '') + chunk.content
  }

  return JSON.stringify({
    title: doc.title,
    sourceType: doc.sourceType,
    wordCount: doc.wordCount,
    chunkCount: doc.chunkCount,
    content,
  })
}

export async function listSourcesTool(examProfileId: string): Promise<string> {
  const docs = await db.documents
    .where('examProfileId')
    .equals(examProfileId)
    .toArray()

  return JSON.stringify({
    documents: docs.map(d => ({
      id: d.id,
      title: d.title,
      sourceType: d.sourceType,
      wordCount: d.wordCount,
      chunkCount: d.chunkCount,
      hasSummary: !!d.summary,
      createdAt: d.createdAt,
    })),
  })
}
