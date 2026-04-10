/**
 * Shared file processing utility.
 * Parses PDFs and chunks text — used by both useSources and useAttachments.
 */
import { parsePdf } from './pdfParser'
import { chunkPages } from './sources'

export interface ProcessedFile {
  fileName: string
  title: string
  text: string
  pageCount: number
  chunks: Array<{ content: string; pageNumber: number }>
}

export async function processFile(file: File): Promise<ProcessedFile> {
  const { text, pages, pageCount } = await parsePdf(file)
  const title = file.name.replace(/\.pdf$/i, '')
  const chunks = chunkPages(pages)
  return { fileName: file.name, title, text, pageCount, chunks }
}
