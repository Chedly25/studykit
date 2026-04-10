/**
 * Sources library — CRUD, chunking, keyword extraction, TF-IDF search.
 */
import { db } from '../db'
import type { Document, DocumentChunk, DocumentSourceType, DocumentCategory } from '../db/schema'

// ─── Stopwords ──────────────────────────────────────────────────
const STOPWORDS = new Set([
  // English
  'a','an','the','and','or','but','in','on','at','to','for','of','with',
  'by','from','is','it','as','be','was','were','are','been','being',
  'have','has','had','do','does','did','will','would','shall','should',
  'may','might','must','can','could','this','that','these','those',
  'i','you','he','she','we','they','me','him','her','us','them',
  'my','your','his','its','our','their','what','which','who','whom',
  'not','no','nor','so','if','then','than','too','very','just','about',
  'up','out','into','over','after','before','between','under','again',
  'each','every','all','both','few','more','most','other','some','such',
  // French
  'les','des','est','une','son','ses','aux','par','sur','dans','pas',
  'plus','que','qui','ont','été','fait','avec','ces','mais','pour',
  'tout','tous','sans','elle','nous','vous','leur','leurs','bien',
  'même','très','peu','trop','donc','car','soit','dont','comme',
  'cette','entre','après','avant','chez','vers','lors','aussi',
  'toute','chaque','peut','sont','elles','quand','quel',
])

// ─── Helpers ────────────────────────────────────────────────────
function generateId(): string {
  return crypto.randomUUID()
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-zà-öø-ÿ0-9]+/)
    .filter(w => w.length > 2 && !STOPWORDS.has(w))
}

// ─── Keyword Extraction ────────────────────────────────────────
export function computeKeywords(text: string): string {
  const words = tokenize(text)
  const unique = [...new Set(words)]
  return unique.slice(0, 50).join(',')
}

// ─── Text Chunking ─────────────────────────────────────────────
export function chunkText(text: string, maxTokens = 300): string[] {
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim())
  const chunks: string[] = []
  let current = ''

  for (const para of paragraphs) {
    const combined = current ? `${current}\n\n${para}` : para
    const wordCount = combined.split(/\s+/).length

    if (wordCount > maxTokens && current) {
      chunks.push(current.trim())
      // Overlap: take last sentence of previous chunk
      const sentences = current.split(/[.!?]+\s+/)
      const overlap = sentences.length > 1 ? sentences[sentences.length - 1] : ''
      current = overlap ? `${overlap}\n\n${para}` : para
    } else if (wordCount > maxTokens) {
      // Single paragraph exceeds max — split by sentences
      const sentences = para.split(/(?<=[.!?])\s+/)
      for (const sent of sentences) {
        const check = current ? `${current} ${sent}` : sent
        if (check.split(/\s+/).length > maxTokens && current) {
          chunks.push(current.trim())
          current = sent
        } else {
          current = check
        }
      }
    } else {
      current = combined
    }
  }

  if (current.trim()) {
    chunks.push(current.trim())
  }

  return chunks.length > 0 ? chunks : [text.trim()]
}

// ─── CRUD ──────────────────────────────────────────────────────
export async function createDocument(
  examProfileId: string,
  title: string,
  sourceType: DocumentSourceType,
  content: string,
  sourceUrl?: string,
  category?: DocumentCategory,
): Promise<Document> {
  const doc: Document = {
    id: generateId(),
    examProfileId,
    title,
    sourceType,
    category: category ?? 'course',
    originalContent: content,
    chunkCount: 0,
    wordCount: content.split(/\s+/).length,
    sourceUrl,
    createdAt: new Date().toISOString(),
  }
  await db.documents.put(doc)
  return doc
}

export async function deleteDocument(documentId: string): Promise<void> {
  await db.documentChunks.where('documentId').equals(documentId).delete()
  await db.documents.delete(documentId)
}

/**
 * Save chunks to the database. Accepts either plain strings (for pasted text,
 * notes — no page tracking) or objects with pageNumber (for PDF uploads).
 */
export async function saveChunks(
  documentId: string,
  examProfileId: string,
  chunks: string[] | Array<{ content: string; pageNumber?: number }>,
): Promise<DocumentChunk[]> {
  const rows: DocumentChunk[] = chunks.map((chunk, i) => {
    const content = typeof chunk === 'string' ? chunk : chunk.content
    const pageNumber = typeof chunk === 'string' ? undefined : chunk.pageNumber
    return {
      id: generateId(),
      documentId,
      examProfileId,
      content,
      chunkIndex: i,
      keywords: computeKeywords(content),
      ...(pageNumber !== undefined ? { pageNumber } : {}),
    }
  })

  await db.documentChunks.bulkPut(rows)
  await db.documents.update(documentId, { chunkCount: rows.length })

  return rows
}

/**
 * Chunk an array of pages, preserving page numbers on each chunk.
 * Each page is chunked independently so chunk boundaries never cross pages.
 */
export function chunkPages(
  pages: Array<{ pageNumber: number; text: string }>,
  maxTokens = 300,
): Array<{ content: string; pageNumber: number }> {
  const result: Array<{ content: string; pageNumber: number }> = []
  for (const page of pages) {
    const pageChunks = chunkText(page.text, maxTokens)
    for (const content of pageChunks) {
      result.push({ content, pageNumber: page.pageNumber })
    }
  }
  return result
}

export async function getChunksByDocumentId(documentId: string): Promise<DocumentChunk[]> {
  return db.documentChunks.where('documentId').equals(documentId).sortBy('chunkIndex')
}

export async function getChunksByTopicId(examProfileId: string, topicId: string): Promise<DocumentChunk[]> {
  return db.documentChunks
    .where('[examProfileId+topicId]')
    .equals([examProfileId, topicId])
    .toArray()
    .catch(() =>
      // Fallback if compound index doesn't exist
      db.documentChunks
        .where('examProfileId')
        .equals(examProfileId)
        .filter(c => c.topicId === topicId)
        .toArray()
    )
}

// ─── TF-IDF Search ─────────────────────────────────────────────
export async function searchChunks(
  examProfileId: string,
  query: string,
  topN = 5,
): Promise<(DocumentChunk & { score: number; documentTitle?: string })[]> {
  const queryTerms = tokenize(query)
  if (queryTerms.length === 0) return []

  // Load all chunks for this profile
  const allChunks = await db.documentChunks
    .where('examProfileId')
    .equals(examProfileId)
    .toArray()

  if (allChunks.length === 0) return []

  // Pre-filter: only consider chunks with keyword overlap
  const queryTermSet = new Set(queryTerms)
  const candidates = allChunks.filter(chunk => {
    const chunkKeywords = chunk.keywords.split(',')
    return chunkKeywords.some(kw => queryTermSet.has(kw))
  })

  if (candidates.length === 0) return []

  // Compute IDF for each query term
  const docCount = candidates.length
  const idf = new Map<string, number>()
  for (const term of queryTerms) {
    const docsWithTerm = candidates.filter(c => c.keywords.includes(term)).length
    idf.set(term, docsWithTerm > 0 ? Math.log(docCount / docsWithTerm) + 1 : 0)
  }

  // Score each candidate
  const scored = candidates.map(chunk => {
    const chunkWords = tokenize(chunk.content)
    const wordCount = chunkWords.length || 1
    let score = 0

    for (const term of queryTerms) {
      const tf = chunkWords.filter(w => w === term).length / wordCount
      score += tf * (idf.get(term) ?? 0)
    }

    return { ...chunk, score }
  })

  // Sort by score descending, take top N
  scored.sort((a, b) => b.score - a.score)
  const topResults = scored.slice(0, topN).filter(r => r.score > 0)

  // Attach document titles
  const docIds = [...new Set(topResults.map(r => r.documentId))]
  const docs = await db.documents.where('id').anyOf(docIds).toArray()
  const docMap = new Map(docs.map(d => [d.id, d.title]))

  return topResults.map(r => ({
    ...r,
    documentTitle: docMap.get(r.documentId),
  }))
}
