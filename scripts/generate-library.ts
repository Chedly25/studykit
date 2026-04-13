#!/usr/bin/env npx tsx
/**
 * Batch script: process PDFs → chunk → embed → package as JSON for R2.
 *
 * Usage:
 *   npx tsx scripts/generate-library.ts \
 *     --exam-id cpge-mp \
 *     --input-dir corrections/ \
 *     --output-dir library-output/ \
 *     --api-url https://studieskit.com \
 *     --auth-token $AUTH_TOKEN
 *
 * After running, upload to R2:
 *   wrangler r2 object put studykit-library/library/cpge-mp/manifest.json --file library-output/manifest.json
 *   for f in library-output/docs/*.json; do
 *     wrangler r2 object put "studykit-library/library/cpge-mp/docs/$(basename $f)" --file "$f"
 *   done
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'fs'
import { join, basename, extname } from 'path'
import { parseArgs } from 'util'

// ─── CLI args ───────────────────────────────────────────

const { values } = parseArgs({
  options: {
    'exam-id': { type: 'string' },
    'input-dir': { type: 'string' },
    'output-dir': { type: 'string', default: 'library-output' },
    'api-url': { type: 'string', default: 'https://studieskit.com' },
    'auth-token': { type: 'string' },
  },
})

const examId = values['exam-id']
const inputDir = values['input-dir']
const outputDir = values['output-dir'] ?? 'library-output'
const apiUrl = values['api-url'] ?? 'https://studieskit.com'
const authToken = values['auth-token']

if (!examId || !inputDir) {
  console.error('Usage: npx tsx scripts/generate-library.ts --exam-id <id> --input-dir <dir> [--output-dir <dir>] [--api-url <url>] [--auth-token <token>]')
  process.exit(1)
}

// ─── PDF text extraction (Node-compatible) ──────────────

async function extractPdfText(filePath: string): Promise<{ text: string; pages: Array<{ pageNumber: number; text: string }> }> {
  // Use pdf-parse for Node.js
  const pdfParse = (await import('pdf-parse')).default
  const buffer = readFileSync(filePath)
  const data = await pdfParse(buffer)

  // pdf-parse returns full text but not per-page. Split by form feeds as approximation.
  const fullText = data.text
  const pageTexts = fullText.split('\f').filter(t => t.trim().length > 0)
  const pages = pageTexts.map((text, i) => ({ pageNumber: i + 1, text: text.trim() }))

  return { text: fullText, pages }
}

// ─── Chunking (mirrors src/lib/sources.ts logic) ────────

const FRENCH_STOPWORDS = new Set(['le', 'la', 'les', 'de', 'du', 'des', 'un', 'une', 'et', 'en', 'est', 'que', 'qui', 'dans', 'pour', 'pas', 'sur', 'ce', 'il', 'ne', 'se', 'au', 'aux', 'son', 'sa', 'ses', 'ou', 'par', 'avec', 'plus', 'tout', 'cette', 'mais', 'comme', 'on', 'sont', 'nous', 'vous', 'leur', 'bien', 'aussi', 'entre', 'après', 'donc', 'sans', 'sous', 'ces', 'fait'])
const ENGLISH_STOPWORDS = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'shall', 'can', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'out', 'off', 'over', 'under', 'again', 'further', 'then', 'once', 'and', 'but', 'or', 'nor', 'not', 'so', 'if', 'than', 'too', 'very', 'just', 'about', 'up', 'its', 'his', 'her', 'my', 'your', 'our', 'their', 'this', 'that', 'these', 'those', 'it', 'he', 'she', 'we', 'they', 'them', 'him'])

function computeKeywords(text: string): string {
  const words = text.toLowerCase().split(/[^a-zA-ZÀ-ÿ0-9]+/).filter(w => w.length >= 3 && !FRENCH_STOPWORDS.has(w) && !ENGLISH_STOPWORDS.has(w))
  const unique = [...new Set(words)]
  return unique.slice(0, 50).join(',')
}

interface Chunk {
  content: string
  pageNumber?: number
}

function chunkPages(pages: Array<{ pageNumber: number; text: string }>, maxTokens = 300): Chunk[] {
  const chunks: Chunk[] = []
  let currentContent = ''
  let currentPage = pages[0]?.pageNumber ?? 1

  for (const page of pages) {
    const paragraphs = page.text.split(/\n\s*\n/).filter(p => p.trim().length > 0)

    for (const para of paragraphs) {
      const paraWords = para.split(/\s+/).length
      const currentWords = currentContent.split(/\s+/).filter(Boolean).length

      if (currentWords + paraWords > maxTokens && currentContent.trim()) {
        chunks.push({ content: currentContent.trim(), pageNumber: currentPage })
        // Overlap: last sentence of previous chunk
        const sentences = currentContent.split(/[.!?]+/).filter(s => s.trim())
        const lastSentence = sentences.length > 0 ? sentences[sentences.length - 1].trim() : ''
        currentContent = lastSentence ? lastSentence + '. ' + para : para
        currentPage = page.pageNumber
      } else {
        currentContent += (currentContent ? '\n\n' : '') + para
        if (!currentContent.trim()) currentPage = page.pageNumber
      }
    }
  }

  if (currentContent.trim()) {
    chunks.push({ content: currentContent.trim(), pageNumber: currentPage })
  }

  return chunks
}

// ─── Embedding via API ──────────────────────────────────

async function generateEmbeddings(texts: string[], token: string): Promise<string[]> {
  const BATCH_SIZE = 50
  const allEmbeddings: string[] = []

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE).map(t => t.slice(0, 8192))
    const res = await fetch(`${apiUrl}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ texts: batch }),
    })
    if (!res.ok) {
      const err = await res.text().catch(() => '')
      throw new Error(`Embed API failed: ${res.status} ${err}`)
    }
    const data = await res.json() as { embeddings: string[] }
    allEmbeddings.push(...data.embeddings)

    if (i + BATCH_SIZE < texts.length) {
      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 1000))
    }
  }

  return allEmbeddings
}

// ─── Document ID from filename ──────────────────────────

function fileToDocId(filename: string, subdir: string): string {
  const name = basename(filename, extname(filename))
  // Normalize: lowercase, replace spaces/underscores with hyphens, remove duplicate hyphens
  const slug = name.toLowerCase().replace(/[\s_]+/g, '-').replace(/-+/g, '-').replace(/[^a-z0-9-]/g, '')
  // Prefix with subdir category if it's in a subdirectory
  if (subdir && subdir !== '.') {
    const catSlug = subdir.toLowerCase().replace(/[\s_/]+/g, '-').replace(/-+/g, '-').replace(/[^a-z0-9-]/g, '')
    return `${catSlug}-${slug}`
  }
  return slug
}

function inferCategory(filePath: string): 'exam' | 'course' {
  const lower = filePath.toLowerCase()
  if (lower.includes('sujet') || lower.includes('exam') || lower.includes('concours')) return 'exam'
  if (lower.includes('cours') || lower.includes('course') || lower.includes('programme')) return 'course'
  return 'exam' // default for papers
}

function inferYear(filename: string): number | undefined {
  const match = filename.match(/(20\d{2})/)
  return match ? parseInt(match[1], 10) : undefined
}

// ─── Main ───────────────────────────────────────────────

async function main() {
  console.log(`Processing library for exam: ${examId}`)
  console.log(`Input: ${inputDir}`)
  console.log(`Output: ${outputDir}`)

  mkdirSync(join(outputDir, 'docs'), { recursive: true })

  // Collect all PDFs recursively
  const pdfFiles: Array<{ path: string; subdir: string }> = []

  function collectPdfs(dir: string, relativeDir: string) {
    for (const entry of readdirSync(dir)) {
      const fullPath = join(dir, entry)
      const stat = statSync(fullPath)
      if (stat.isDirectory()) {
        collectPdfs(fullPath, relativeDir ? `${relativeDir}/${entry}` : entry)
      } else if (entry.toLowerCase().endsWith('.pdf')) {
        pdfFiles.push({ path: fullPath, subdir: relativeDir })
      }
    }
  }

  collectPdfs(inputDir, '')
  console.log(`Found ${pdfFiles.length} PDF files`)

  const manifestEntries: Array<{
    id: string
    title: string
    category: 'exam' | 'course'
    year?: number
    subject?: string
    chunkCount: number
    sizeBytes: number
  }> = []

  for (let fi = 0; fi < pdfFiles.length; fi++) {
    const { path: filePath, subdir } = pdfFiles[fi]
    const filename = basename(filePath)
    const docId = fileToDocId(filename, subdir)
    const category = inferCategory(filePath)
    const year = inferYear(filename)

    console.log(`[${fi + 1}/${pdfFiles.length}] Processing ${filename} → ${docId}`)

    // Extract text
    let text: string
    let pages: Array<{ pageNumber: number; text: string }>
    try {
      const result = await extractPdfText(filePath)
      text = result.text
      pages = result.pages
    } catch (err) {
      console.error(`  ✗ Failed to parse PDF: ${err}`)
      continue
    }

    if (!text.trim()) {
      console.error(`  ✗ Empty PDF (possibly scanned without OCR)`)
      continue
    }

    // Chunk
    const rawChunks = chunkPages(pages)
    console.log(`  Chunks: ${rawChunks.length}`)

    // Generate stable IDs
    const documentId = docId
    const chunks = rawChunks.map((c, i) => ({
      id: `${docId}-chunk-${String(i).padStart(4, '0')}`,
      documentId,
      content: c.content,
      chunkIndex: i,
      keywords: computeKeywords(c.content),
      pageNumber: c.pageNumber,
    }))

    // Embeddings
    let embeddings: Array<{ id: string; chunkId: string; documentId: string; embedding: string }> = []
    if (authToken) {
      try {
        const embeddingTexts = chunks.map(c => c.content)
        const embeddingResults = await generateEmbeddings(embeddingTexts, authToken)
        embeddings = chunks.map((c, i) => ({
          id: `${docId}-emb-${String(i).padStart(4, '0')}`,
          chunkId: c.id,
          documentId,
          embedding: embeddingResults[i],
        }))
        console.log(`  Embeddings: ${embeddings.length}`)
      } catch (err) {
        console.error(`  ✗ Embedding failed: ${err}`)
        // Continue without embeddings — they can be generated later
      }
    } else {
      console.log(`  ⚠ Skipping embeddings (no --auth-token)`)
    }

    // Package
    const pkg = {
      document: {
        id: documentId,
        title: filename.replace(/\.pdf$/i, '').replace(/[-_]/g, ' '),
        sourceType: 'pdf' as const,
        category,
        originalContent: text,
        chunkCount: chunks.length,
        wordCount: text.split(/\s+/).length,
        createdAt: new Date().toISOString(),
      },
      chunks,
      embeddings,
    }

    const json = JSON.stringify(pkg)
    writeFileSync(join(outputDir, 'docs', `${docId}.json`), json)

    manifestEntries.push({
      id: docId,
      title: pkg.document.title,
      category,
      year,
      chunkCount: chunks.length,
      sizeBytes: json.length,
    })

    console.log(`  ✓ ${docId} (${chunks.length} chunks, ${(json.length / 1024).toFixed(0)}KB)`)
  }

  // Write manifest
  const manifest = {
    examId,
    updatedAt: new Date().toISOString(),
    documents: manifestEntries,
  }
  writeFileSync(join(outputDir, 'manifest.json'), JSON.stringify(manifest, null, 2))

  console.log(`\nDone! ${manifestEntries.length} documents processed.`)
  console.log(`Output: ${outputDir}/`)
  console.log(`\nTo upload to R2:`)
  console.log(`  wrangler r2 object put studykit-library/library/${examId}/manifest.json --file ${outputDir}/manifest.json`)
  console.log(`  for f in ${outputDir}/docs/*.json; do`)
  console.log(`    wrangler r2 object put "studykit-library/library/${examId}/docs/$(basename $f)" --file "$f"`)
  console.log(`  done`)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
