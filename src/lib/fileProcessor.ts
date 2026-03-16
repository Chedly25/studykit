/**
 * Shared file processing utility.
 * Parses PDFs and chunks text — used by both useSources and useAttachments.
 */
import { parsePdf } from './pdfParser'
import { chunkText } from './sources'

export interface ProcessedFile {
  fileName: string
  title: string
  text: string
  pageCount: number
  chunks: string[]
}

export async function processFile(file: File): Promise<ProcessedFile> {
  const { text, pageCount } = await parsePdf(file)
  const title = file.name.replace(/\.pdf$/i, '')
  const chunks = chunkText(text)
  return { fileName: file.name, title, text, pageCount, chunks }
}
