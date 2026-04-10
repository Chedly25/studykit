/**
 * Client-side PDF text extraction using pdfjs-dist.
 * Dynamically imported to avoid loading the ~400KB lib unless needed.
 */
import { getPdfLib } from './pdfInit'

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB
const PAGE_BATCH_SIZE = 20

export interface PdfPage {
  pageNumber: number  // 1-based
  text: string
}

export interface PdfParseResult {
  /** Concatenated text of all pages (kept for backward compat + document.originalContent) */
  text: string
  /** Per-page text with 1-based page numbers */
  pages: PdfPage[]
  pageCount: number
}

export async function parsePdf(file: File): Promise<PdfParseResult> {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`PDF exceeds maximum file size of ${MAX_FILE_SIZE / 1024 / 1024}MB`)
  }

  // Dynamic import — only loaded when user uploads a PDF
  const pdfjsLib = await getPdfLib()

  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

  // Extract text from pages in parallel batches for speed
  const pageTexts: string[] = new Array(pdf.numPages)

  for (let start = 0; start < pdf.numPages; start += PAGE_BATCH_SIZE) {
    const end = Math.min(start + PAGE_BATCH_SIZE, pdf.numPages)
    const batch = Array.from({ length: end - start }, (_, i) => start + i + 1)

    await Promise.all(batch.map(async (pageNum) => {
      const page = await pdf.getPage(pageNum)
      const textContent = await page.getTextContent()
      pageTexts[pageNum - 1] = textContent.items
        .map((item: { str?: string }) => item.str ?? '')
        .join(' ')
    }))
  }

  const pages: PdfPage[] = pageTexts.map((text, i) => ({
    pageNumber: i + 1,
    text: text.trim(),
  })).filter(p => p.text.length > 0)

  const text = pageTexts.join('\n\n').trim()

  if (!text) {
    throw new Error('No text content found in PDF — it may be a scanned document or contain only images.')
  }

  return { text, pages, pageCount: pdf.numPages }
}
