/**
 * Bibliothèque PDF viewer — wraps the existing virtualized PdfScrollViewer
 * for URL-based public/library/ assets. Differs from src/components/sources/PdfViewer.tsx
 * which loads from a Blob in IndexedDB.
 */
import { useEffect, useRef, useState } from 'react'
import { Loader2, AlertTriangle } from 'lucide-react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { getPdfLib } from '../../../lib/pdfInit'
import { PdfScrollViewer, type PdfScrollViewerHandle } from '../../reader/PdfScrollViewer'

interface Props {
  /** Public URL of the PDF (e.g. "/library/pdfs/crfpa/sujet-2023-obligations.pdf"). */
  url: string
  /** Stable id used for highlight scoping. We pass the library entry id; PdfScrollViewer
   *  treats it as documentId so any highlights persist per library entry. */
  libraryEntryId: string
  examProfileId?: string
  /** Optional title shown in a toolbar above the viewer. */
  title?: string
  /** Optional subtitle (year, matière, etc.). */
  subtitle?: string
}

export function LibraryPdfViewer({ url, libraryEntryId, examProfileId, title, subtitle }: Props) {
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [scale, setScale] = useState(1.2)
  const [, setCurrentPage] = useState(1)
  const viewerRef = useRef<PdfScrollViewerHandle>(null)

  useEffect(() => {
    let cancelled = false
    setPdfDoc(null)
    setError(null)
    ;(async () => {
      try {
        const pdfjsLib = await getPdfLib()
        const doc = (await pdfjsLib.getDocument({ url }).promise) as PDFDocumentProxy
        if (!cancelled) setPdfDoc(doc)
      } catch (err) {
        if (!cancelled) setError(`Impossible de charger le PDF : ${(err as Error).message}`)
      }
    })()
    return () => { cancelled = true }
  }, [url])

  const handleAskAI = (_text: string, _pageNumber: number) => {
    // Routing library selections to Oracle is a v2 polish item.
    // The required wiring point lives here.
  }

  if (error) {
    return (
      <div className="flex items-start gap-3 p-4 rounded-lg border border-amber-500/30 bg-amber-500/5 text-sm text-amber-700 dark:text-amber-400">
        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
        <div>{error}</div>
      </div>
    )
  }

  if (!pdfDoc) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-[var(--text-muted)]">
        <Loader2 className="w-6 h-6 animate-spin" />
        <p className="text-sm">Chargement du PDF…</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {(title || subtitle) && (
        <div className="px-4 py-3 border-b border-[var(--border-card)]">
          {title && <h2 className="text-base font-semibold text-[var(--text-heading)]">{title}</h2>}
          {subtitle && <p className="text-xs text-[var(--text-muted)] mt-0.5">{subtitle}</p>}
        </div>
      )}
      <div className="flex flex-1 min-h-0">
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center justify-end gap-2 px-3 py-1.5 border-b border-[var(--border-card)] text-xs text-[var(--text-muted)]">
            <button
              type="button"
              onClick={() => setScale(s => Math.max(0.5, s - 0.1))}
              className="px-2 py-1 rounded hover:bg-[var(--bg-hover)]"
              aria-label="Zoom out"
            >
              −
            </button>
            <span className="w-10 text-center tabular-nums">{Math.round(scale * 100)}%</span>
            <button
              type="button"
              onClick={() => setScale(s => Math.min(3, s + 0.1))}
              className="px-2 py-1 rounded hover:bg-[var(--bg-hover)]"
              aria-label="Zoom in"
            >
              +
            </button>
          </div>
          <div className="flex-1 overflow-y-auto bg-[var(--bg-elev)]">
            <PdfScrollViewer
              ref={viewerRef}
              pdfDoc={pdfDoc}
              scale={scale}
              onPageChange={setCurrentPage}
              onAskAI={handleAskAI}
              onAutoScale={(fit) => setScale(fit)}
              documentId={libraryEntryId}
              examProfileId={examProfileId}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
