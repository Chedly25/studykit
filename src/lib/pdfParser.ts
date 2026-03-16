/**
 * Client-side PDF text extraction using pdfjs-dist.
 * Dynamically imported to avoid loading the ~400KB lib unless needed.
 */

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB
const PAGE_BATCH_SIZE = 20

export interface PdfParseResult {
  text: string
  pageCount: number
}

export async function parsePdf(file: File): Promise<PdfParseResult> {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`PDF exceeds maximum file size of ${MAX_FILE_SIZE / 1024 / 1024}MB`)
  }

  // Dynamic import — only loaded when user uploads a PDF
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfjsLib: any = await import('pdfjs-dist/build/pdf.mjs')
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`

  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

  // Extract text from pages in parallel batches for speed
  const pages: string[] = new Array(pdf.numPages)

  for (let start = 0; start < pdf.numPages; start += PAGE_BATCH_SIZE) {
    const end = Math.min(start + PAGE_BATCH_SIZE, pdf.numPages)
    const batch = Array.from({ length: end - start }, (_, i) => start + i + 1)

    await Promise.all(batch.map(async (pageNum) => {
      const page = await pdf.getPage(pageNum)
      const textContent = await page.getTextContent()
      pages[pageNum - 1] = textContent.items
        .map((item: { str?: string }) => item.str ?? '')
        .join(' ')
    }))
  }

  const text = pages.join('\n\n').trim()

  if (!text) {
    throw new Error('No text content found in PDF — it may be a scanned document or contain only images.')
  }

  return { text, pageCount: pdf.numPages }
}
