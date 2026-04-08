/**
 * Shared PDF.js initialization — sets the worker source URL once.
 * Import this instead of duplicating the dynamic import + worker setup.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cached: any = null

export async function getPdfLib() {
  if (cached) return cached
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfjsLib: any = await import('pdfjs-dist/build/pdf.mjs')
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`
  cached = pdfjsLib
  return pdfjsLib
}
