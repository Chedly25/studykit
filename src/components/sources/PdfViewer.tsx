/**
 * In-app PDF viewer using pdfjs-dist.
 * Renders PDF pages to canvas with page navigation and zoom.
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Loader2 } from 'lucide-react'
import { db } from '../../db'

interface Props {
  documentId: string
  title: string
  onClose: () => void
}

export function PdfViewer({ documentId, title, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [pdf, setPdf] = useState<any>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [scale, setScale] = useState(1.2)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load PDF from IndexedDB
  useEffect(() => {
    let cancelled = false

    async function loadPdf() {
      try {
        const docFile = await db.documentFiles
          .where('documentId')
          .equals(documentId)
          .first()

        if (!docFile) {
          setError('Original PDF file not found. Only PDFs uploaded after this feature was added can be viewed.')
          setLoading(false)
          return
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pdfjsLib: any = await import('pdfjs-dist/build/pdf.mjs')
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`

        const arrayBuffer = await docFile.file.arrayBuffer()
        const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

        if (!cancelled) {
          setPdf(pdfDoc)
          setTotalPages(pdfDoc.numPages)
          setLoading(false)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load PDF')
          setLoading(false)
        }
      }
    }

    loadPdf()
    return () => { cancelled = true }
  }, [documentId])

  // Render current page
  useEffect(() => {
    if (!pdf || !canvasRef.current) return
    let cancelled = false

    async function renderPage() {
      try {
        const page = await pdf.getPage(currentPage)
        const viewport = page.getViewport({ scale })
        const canvas = canvasRef.current!
        canvas.width = viewport.width
        canvas.height = viewport.height
        const ctx = canvas.getContext('2d')!
        if (!cancelled) {
          await page.render({ canvasContext: ctx, viewport }).promise
        }
      } catch {
        // Page render error — usually harmless
      }
    }

    renderPage()
    return () => { cancelled = true }
  }, [pdf, currentPage, scale])

  const goToPrev = useCallback(() => setCurrentPage(p => Math.max(1, p - 1)), [])
  const goToNext = useCallback(() => setCurrentPage(p => Math.min(totalPages, p + 1)), [totalPages])
  const zoomIn = useCallback(() => setScale(s => Math.min(3, s + 0.2)), [])
  const zoomOut = useCallback(() => setScale(s => Math.max(0.5, s - 0.2)), [])

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goToPrev()
      else if (e.key === 'ArrowRight') goToNext()
      else if (e.key === 'Escape') onClose()
      else if (e.key === '+' || e.key === '=') zoomIn()
      else if (e.key === '-') zoomOut()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [goToPrev, goToNext, onClose, zoomIn, zoomOut])

  return (
    <div className="fixed inset-0 z-[90] flex flex-col bg-[var(--bg-body)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border-card)] bg-[var(--bg-card)]">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-sm font-medium text-[var(--text-heading)] truncate">{title}</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Zoom */}
          <button onClick={zoomOut} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-input)] transition-colors" title="Zoom out (-)">
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs text-[var(--text-muted)] min-w-[3ch] text-center">{Math.round(scale * 100)}%</span>
          <button onClick={zoomIn} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-input)] transition-colors" title="Zoom in (+)">
            <ZoomIn className="w-4 h-4" />
          </button>

          <div className="w-px h-5 bg-[var(--border-card)] mx-1" />

          {/* Page nav */}
          <button onClick={goToPrev} disabled={currentPage <= 1} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-input)] transition-colors disabled:opacity-30">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs text-[var(--text-muted)]">
            {currentPage} / {totalPages}
          </span>
          <button onClick={goToNext} disabled={currentPage >= totalPages} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-input)] transition-colors disabled:opacity-30">
            <ChevronRight className="w-4 h-4" />
          </button>

          <div className="w-px h-5 bg-[var(--border-card)] mx-1" />

          <button onClick={onClose} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-input)] transition-colors" title="Close (Esc)">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto flex items-start justify-center p-4 bg-[var(--bg-body)]">
        {loading && (
          <div className="flex items-center gap-2 mt-20 text-[var(--text-muted)]">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Loading PDF...</span>
          </div>
        )}

        {error && (
          <div className="mt-20 text-center max-w-sm">
            <p className="text-sm text-[var(--text-muted)]">{error}</p>
          </div>
        )}

        {!loading && !error && (
          <canvas
            ref={canvasRef}
            className="shadow-lg rounded-sm"
          />
        )}
      </div>
    </div>
  )
}
