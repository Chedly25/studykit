/**
 * In-app PDF viewer using pdfjs-dist.
 * Renders PDF pages to canvas with page navigation and zoom.
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Loader2, Highlighter, BookOpen } from 'lucide-react'
import { db } from '../../db'
import { usePdfHighlights } from '../../hooks/usePdfHighlights'
import { useExamProfile } from '../../hooks/useExamProfile'
import { HighlightLayer } from './HighlightLayer'

interface Props {
  documentId: string
  title: string
  onClose: () => void
}

export function PdfViewer({ documentId, title, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [pdf, setPdf] = useState<any>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [scale, setScale] = useState(1.2)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectionToolbar, setSelectionToolbar] = useState<{ x: number; y: number; text: string } | null>(null)
  const [flashcardModal, setFlashcardModal] = useState<{ highlightId: string; back: string } | null>(null)
  const [flashcardFront, setFlashcardFront] = useState('')

  const { activeProfile } = useExamProfile()
  const { highlights, addHighlight, updateNote, deleteHighlight, createFlashcardFromHighlight } = usePdfHighlights(documentId, activeProfile?.id)

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

  // Handle text selection for highlighting
  const handleMouseUp = useCallback(() => {
    const selection = window.getSelection()
    if (!selection || selection.isCollapsed || !selection.toString().trim()) {
      setSelectionToolbar(null)
      return
    }

    const text = selection.toString().trim()
    if (!text) return

    const range = selection.getRangeAt(0)
    const rect = range.getBoundingClientRect()
    const container = containerRef.current
    if (!container) return

    const containerRect = container.getBoundingClientRect()
    setSelectionToolbar({
      x: rect.left - containerRect.left + rect.width / 2,
      y: rect.top - containerRect.top - 10,
      text,
    })
  }, [])

  const handleHighlight = useCallback(async (color: string) => {
    if (!selectionToolbar) return
    const canvas = canvasRef.current
    if (!canvas) return

    // Approximate rect in PDF coords
    const rects = [{
      x: 0,
      y: (selectionToolbar.y + 10) / scale,
      width: canvas.width / scale,
      height: 16 / scale,
    }]

    await addHighlight(currentPage, selectionToolbar.text, rects, color)
    setSelectionToolbar(null)
    window.getSelection()?.removeAllRanges()
  }, [selectionToolbar, currentPage, scale, addHighlight])

  const handleCreateFlashcardFromSelection = useCallback(async () => {
    if (!selectionToolbar) return
    const canvas = canvasRef.current
    if (!canvas) return

    const rects = [{
      x: 0,
      y: (selectionToolbar.y + 10) / scale,
      width: canvas.width / scale,
      height: 16 / scale,
    }]

    const hId = await addHighlight(currentPage, selectionToolbar.text, rects, '#fbbf24')
    if (hId) {
      setFlashcardModal({ highlightId: hId, back: selectionToolbar.text })
      setFlashcardFront('')
    }
    setSelectionToolbar(null)
    window.getSelection()?.removeAllRanges()
  }, [selectionToolbar, currentPage, scale, addHighlight])

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
      <div ref={containerRef} className="flex-1 overflow-auto flex items-start justify-center p-4 bg-[var(--bg-body)] relative" onMouseUp={handleMouseUp}>
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
          <div className="relative inline-block">
            <canvas
              ref={canvasRef}
              className="shadow-lg rounded-sm"
            />

            {/* Highlight layer */}
            <HighlightLayer
              highlights={highlights}
              currentPage={currentPage}
              scale={scale}
              onUpdateNote={updateNote}
              onDelete={deleteHighlight}
              onCreateFlashcard={(id) => {
                const h = highlights.find(h => h.id === id)
                if (h) {
                  setFlashcardModal({ highlightId: id, back: h.text })
                  setFlashcardFront('')
                }
              }}
            />

            {/* Selection toolbar */}
            {selectionToolbar && (
              <div
                className="absolute z-50 flex items-center gap-1 glass-card px-2 py-1 shadow-lg"
                style={{ left: selectionToolbar.x, top: selectionToolbar.y, transform: 'translate(-50%, -100%)' }}
              >
                <button
                  onClick={() => handleHighlight('#fbbf24')}
                  className="p-1.5 rounded hover:bg-yellow-100 dark:hover:bg-yellow-900/30 transition-colors"
                  title="Highlight"
                >
                  <Highlighter className="w-4 h-4 text-yellow-500" />
                </button>
                <button
                  onClick={() => handleHighlight('#34d399')}
                  className="p-1.5 rounded hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors"
                  title="Highlight (green)"
                >
                  <Highlighter className="w-4 h-4 text-emerald-500" />
                </button>
                <button
                  onClick={() => handleHighlight('#60a5fa')}
                  className="p-1.5 rounded hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                  title="Highlight (blue)"
                >
                  <Highlighter className="w-4 h-4 text-blue-500" />
                </button>
                <div className="w-px h-4 bg-[var(--border-card)]" />
                <button
                  onClick={handleCreateFlashcardFromSelection}
                  className="p-1.5 rounded hover:bg-[var(--bg-input)] transition-colors"
                  title="Create Flashcard"
                >
                  <BookOpen className="w-4 h-4 text-[var(--accent-text)]" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Flashcard creation modal */}
        {flashcardModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50" onClick={() => setFlashcardModal(null)}>
            <div className="glass-card p-5 max-w-sm w-full mx-4 space-y-3" onClick={e => e.stopPropagation()}>
              <h3 className="font-semibold text-[var(--text-heading)]">Create Flashcard</h3>
              <div>
                <label className="text-xs text-[var(--text-muted)]">Front (Question)</label>
                <input
                  type="text"
                  value={flashcardFront}
                  onChange={e => setFlashcardFront(e.target.value)}
                  placeholder="What is...?"
                  className="w-full mt-1 px-3 py-2 text-sm bg-[var(--bg-input)] border border-[var(--border-card)] rounded-lg text-[var(--text-body)]"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs text-[var(--text-muted)]">Back (Answer from highlight)</label>
                <p className="text-sm text-[var(--text-body)] mt-1 p-2 bg-[var(--bg-input)] rounded-lg">{flashcardModal.back}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    if (flashcardFront.trim()) {
                      await createFlashcardFromHighlight(flashcardModal.highlightId, flashcardFront)
                      setFlashcardModal(null)
                    }
                  }}
                  disabled={!flashcardFront.trim()}
                  className="flex-1 btn-primary py-2 text-sm disabled:opacity-50"
                >
                  Create
                </button>
                <button onClick={() => setFlashcardModal(null)} className="btn-secondary py-2 text-sm px-4">Cancel</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
