/**
 * Renders a single PDF page: canvas + text layer + highlight overlay + context menu.
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import { BookOpen } from 'lucide-react'
import type { PdfHighlight } from '../../db/schema'
import { HighlightLayer } from '../sources/HighlightLayer'
import { PdfContextMenu } from './PdfContextMenu'

interface Props {
  pdfDoc: any
  pageNumber: number
  scale: number
  width: number
  height: number
  highlights: PdfHighlight[]
  onAddHighlight: (text: string, rects: Array<{ x: number; y: number; width: number; height: number }>, color: string) => Promise<string>
  onUpdateNote: (id: string, note: string) => void
  onDeleteHighlight: (id: string) => void
  onAskAI: (text: string) => void
  onCreateFlashcard: (highlightId: string, front: string) => Promise<string | null>
}

export function PdfPageRenderer({
  pdfDoc, pageNumber, scale, width, height, highlights,
  onAddHighlight, onUpdateNote, onDeleteHighlight, onAskAI, onCreateFlashcard,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const textLayerRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; text: string } | null>(null)
  const [flashcardModal, setFlashcardModal] = useState<{ highlightId: string; back: string } | null>(null)
  const [flashcardFront, setFlashcardFront] = useState('')
  const renderTaskRef = useRef<any>(null)

  // Render canvas + text layer
  useEffect(() => {
    let cancelled = false

    async function render() {
      try {
        const page = await pdfDoc.getPage(pageNumber)
        const viewport = page.getViewport({ scale })
        const canvas = canvasRef.current
        if (!canvas || cancelled) return

        canvas.width = viewport.width
        canvas.height = viewport.height
        const ctx = canvas.getContext('2d')!

        // Cancel previous render if still in progress
        if (renderTaskRef.current) {
          try { renderTaskRef.current.cancel() } catch { /* ignore */ }
        }

        const renderTask = page.render({ canvasContext: ctx, viewport })
        renderTaskRef.current = renderTask
        await renderTask.promise

        // Render text layer
        if (!cancelled && textLayerRef.current) {
          textLayerRef.current.innerHTML = ''
          try {
            const pdfjsLib: any = await import('pdfjs-dist/build/pdf.mjs')
            const textContent = await page.getTextContent()
            const tl = new pdfjsLib.TextLayer({
              textContentSource: textContent,
              container: textLayerRef.current,
              viewport,
            })
            await tl.render()
          } catch {
            // TextLayer might not be available — fallback: no text selection
          }
        }
      } catch (err) {
        if (!cancelled && !(err instanceof Error && err.message.includes('cancelled'))) {
          console.warn(`Page ${pageNumber} render error:`, err)
        }
      }
    }

    render()
    return () => { cancelled = true }
  }, [pdfDoc, pageNumber, scale])

  // Handle text selection → context menu
  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    // Small delay to let the selection settle
    setTimeout(() => {
      const sel = window.getSelection()
      if (!sel || sel.isCollapsed || !sel.toString().trim()) {
        return
      }

      const text = sel.toString().trim()
      if (!text || !containerRef.current) return

      const range = sel.getRangeAt(0)
      const rect = range.getBoundingClientRect()

      setContextMenu({
        x: rect.right,
        y: rect.bottom + 4,
        text,
      })
    }, 10)
  }, [])

  // Capture highlight rects from text layer selection
  const captureRects = useCallback((): Array<{ x: number; y: number; width: number; height: number }> => {
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0 || !containerRef.current) return []
    const range = sel.getRangeAt(0)
    const clientRects = range.getClientRects()
    const containerRect = containerRef.current.getBoundingClientRect()

    return Array.from(clientRects).map(r => ({
      x: (r.left - containerRect.left) / scale,
      y: (r.top - containerRect.top) / scale,
      width: r.width / scale,
      height: r.height / scale,
    }))
  }, [scale])

  const handleHighlight = useCallback(async (color: string) => {
    if (!contextMenu) return
    const rects = captureRects()
    if (rects.length === 0) return
    await onAddHighlight(contextMenu.text, rects, color)
    setContextMenu(null)
    window.getSelection()?.removeAllRanges()
  }, [contextMenu, captureRects, onAddHighlight])

  const handleCreateFlashcardFromMenu = useCallback(async () => {
    if (!contextMenu) return
    const rects = captureRects()
    if (rects.length === 0) return
    const hId = await onAddHighlight(contextMenu.text, rects, '#fbbf24')
    if (hId) {
      setFlashcardModal({ highlightId: hId, back: contextMenu.text })
      setFlashcardFront('')
    }
    setContextMenu(null)
    window.getSelection()?.removeAllRanges()
  }, [contextMenu, captureRects, onAddHighlight])

  return (
    <div ref={containerRef} className="relative w-full h-full" onMouseUp={handleMouseUp}>
      <canvas ref={canvasRef} className="absolute inset-0" />
      <div ref={textLayerRef} className="textLayer" />

      {/* Highlights */}
      <HighlightLayer
        highlights={highlights}
        currentPage={pageNumber}
        scale={scale}
        onUpdateNote={onUpdateNote}
        onDelete={onDeleteHighlight}
        onCreateFlashcard={(id) => {
          const h = highlights.find(h => h.id === id)
          if (h) {
            setFlashcardModal({ highlightId: id, back: h.text })
            setFlashcardFront('')
          }
        }}
      />

      {/* Context menu */}
      {contextMenu && (
        <PdfContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          selectedText={contextMenu.text}
          onAskAI={() => { onAskAI(contextMenu.text); setContextMenu(null); window.getSelection()?.removeAllRanges() }}
          onHighlight={handleHighlight}
          onCreateFlashcard={handleCreateFlashcardFromMenu}
          onCopy={() => { navigator.clipboard.writeText(contextMenu.text); setContextMenu(null); window.getSelection()?.removeAllRanges() }}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Flashcard creation modal */}
      {flashcardModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50" onClick={() => setFlashcardModal(null)}>
          <div className="glass-card p-5 max-w-sm w-full mx-4 space-y-3 animate-scale-in" onClick={e => e.stopPropagation()}>
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
                onKeyDown={e => {
                  if (e.key === 'Enter' && flashcardFront.trim()) {
                    onCreateFlashcard(flashcardModal.highlightId, flashcardFront)
                    setFlashcardModal(null)
                  }
                }}
              />
            </div>
            <div>
              <label className="text-xs text-[var(--text-muted)]">Back (Answer from highlight)</label>
              <p className="text-sm text-[var(--text-body)] mt-1 p-2 bg-[var(--bg-input)] rounded-lg line-clamp-4">{flashcardModal.back}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  if (flashcardFront.trim()) {
                    await onCreateFlashcard(flashcardModal.highlightId, flashcardFront)
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
  )
}
