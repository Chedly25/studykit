/**
 * Renders a single PDF page: canvas + text layer + highlight overlay + context menu.
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import * as Sentry from '@sentry/react'
import { Loader2, RefreshCw } from 'lucide-react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { useFlashcardGenerator } from '../../hooks/useFlashcardGenerator'
import type { PdfHighlight } from '../../db/schema'
import { HighlightLayer } from '../sources/HighlightLayer'
import { PdfContextMenu } from './PdfContextMenu'

interface Props {
  pdfDoc: PDFDocumentProxy
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
  topicHighlightTexts?: string[]
}

export function PdfPageRenderer({
  pdfDoc, pageNumber, scale, width: _width, height: _height, highlights,
  onAddHighlight, onUpdateNote, onDeleteHighlight, onAskAI, onCreateFlashcard,
  topicHighlightTexts,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const textLayerRef = useRef<HTMLDivElement>(null)
  const annotationLayerRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; text: string } | null>(null)
  const [flashcardModal, setFlashcardModal] = useState<{ highlightId: string; back: string } | null>(null)
  const [flashcardFront, setFlashcardFront] = useState('')
  const renderTaskRef = useRef<any>(null)
  const flashcardGen = useFlashcardGenerator()

  // Auto-generate question when flashcard modal opens
  useEffect(() => {
    if (flashcardModal) {
      flashcardGen.generate(flashcardModal.back)
    } else {
      flashcardGen.reset()
    }
  }, [flashcardModal?.highlightId])

  // Pre-fill input when AI generates question
  useEffect(() => {
    if (flashcardGen.generatedQuestion && !flashcardFront) {
      setFlashcardFront(flashcardGen.generatedQuestion)
    }
  }, [flashcardGen.generatedQuestion])

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

        const renderTask = page.render({ canvas: null, canvasContext: ctx, viewport })
        renderTaskRef.current = renderTask
        await renderTask.promise

        // Render text layer
        if (!cancelled && textLayerRef.current) {
          textLayerRef.current.innerHTML = ''
          // CRITICAL: PDF.js uses this CSS var to compute span positioning
          // and the text layer container dimensions. Must be set BEFORE
          // constructing the TextLayer. Do NOT set width/height manually —
          // PDF.js sets them via calc(var(--total-scale-factor) * ...).
          textLayerRef.current.style.setProperty('--total-scale-factor', String(scale))
          try {
            const pdfjsLib: any = await import('pdfjs-dist/build/pdf.mjs')
            if (cancelled || !textLayerRef.current) return
            const textContent = await page.getTextContent()
            if (cancelled || !textLayerRef.current) return
            const tl = new pdfjsLib.TextLayer({
              textContentSource: textContent,
              container: textLayerRef.current,
              viewport,
            })
            await tl.render()

            // Topic highlighting: mark spans whose text matches chunk content
            if (topicHighlightTexts && topicHighlightTexts.length > 0 && textLayerRef.current) {
              const spans = textLayerRef.current.querySelectorAll('span')
              // Build key phrases from chunk content (first 30 chars, trimmed)
              const phrases = topicHighlightTexts
                .map(t => t.replace(/\s+/g, ' ').trim().slice(0, 40).toLowerCase())
                .filter(p => p.length >= 10)

              if (phrases.length > 0) {
                spans.forEach(span => {
                  const text = (span.textContent ?? '').toLowerCase()
                  if (text.length < 3) return
                  for (const phrase of phrases) {
                    if (phrase.includes(text) || text.includes(phrase.slice(0, 20))) {
                      ;(span as HTMLElement).style.backgroundColor = 'rgba(251, 191, 36, 0.2)'
                      break
                    }
                  }
                })
              }
            }
          } catch {
            // TextLayer might not be available — fallback: no text selection
          }
        }

        // Render annotation layer (links, form fields, etc.)
        if (!cancelled && annotationLayerRef.current) {
          annotationLayerRef.current.innerHTML = ''
          annotationLayerRef.current.style.setProperty('--total-scale-factor', String(scale))
          try {
            const [{ AnnotationLayer }, { SimpleLinkService }] = await Promise.all([
              import('pdfjs-dist/build/pdf.mjs') as Promise<any>,
              import('pdfjs-dist/web/pdf_viewer.mjs') as Promise<any>,
            ])
            if (cancelled || !annotationLayerRef.current) return

            const annotations = await page.getAnnotations()
            if (cancelled || !annotationLayerRef.current || annotations.length === 0) return

            // Configure SimpleLinkService to open external URLs in new tabs
            const linkService = new SimpleLinkService()
            linkService.externalLinkTarget = 2 // LinkTarget.BLANK — opens in new tab
            linkService.externalLinkRel = 'noopener noreferrer nofollow'

            const annotationLayer = new AnnotationLayer({
              div: annotationLayerRef.current,
              page,
              viewport: viewport.clone({ dontFlip: true }),
              linkService,
              annotationStorage: undefined,
              downloadManager: null,
              renderForms: false,
            })

            await annotationLayer.render({
              annotations,
              linkService,
              renderForms: false,
              imageResourcesPath: '',
            })
          } catch {
            // AnnotationLayer unavailable — links won't be clickable but viewer still works
          }
        }
      } catch (err) {
        if (!cancelled && !(err instanceof Error && err.message.includes('cancelled'))) {
          Sentry.captureException(err instanceof Error ? err : new Error(`Page ${pageNumber} render error: ` + String(err)))
        }
      }
    }

    render()
    return () => {
      cancelled = true
      try { renderTaskRef.current?.cancel() } catch { /* ignore */ }
    }
  }, [pdfDoc, pageNumber, scale])

  // Handle text selection → context menu
  const handleMouseUp = useCallback(() => {
    setTimeout(() => {
      const sel = window.getSelection()
      if (!sel || sel.isCollapsed || !sel.rangeCount) return

      const range = sel.getRangeAt(0)
      if (!textLayerRef.current || !containerRef.current) return

      // Collect text from all spans intersecting the selection range.
      // This is more reliable than sel.toString() for absolutely-positioned spans
      // where the browser may skip spans that aren't in DOM flow order.
      const spans = textLayerRef.current.querySelectorAll('span')
      const parts: string[] = []
      for (const span of spans) {
        if (range.intersectsNode(span)) {
          parts.push(span.textContent ?? '')
        }
      }
      const text = parts.join(' ').replace(/\s+/g, ' ').trim()
      if (!text) return

      const rect = range.getBoundingClientRect()

      setContextMenu({
        x: rect.right,
        y: rect.bottom + 4,
        text,
      })
    }, 50)
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
      <canvas ref={canvasRef} className="pdf-page-canvas absolute inset-0" />
      <div ref={textLayerRef} className="textLayer" />
      <div ref={annotationLayerRef} className="annotationLayer" />

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
              <div className="flex items-center justify-between">
                <label className="text-xs text-[var(--text-muted)]">Front (Question)</label>
                {flashcardGen.generatedQuestion && (
                  <span className="text-[10px] text-[var(--accent-text)]">AI-suggested — edit if needed</span>
                )}
              </div>
              <div className="relative mt-1">
                <input
                  type="text"
                  value={flashcardFront}
                  onChange={e => setFlashcardFront(e.target.value)}
                  placeholder={flashcardGen.isGenerating ? 'Generating question...' : 'What is...?'}
                  disabled={flashcardGen.isGenerating}
                  className="w-full px-3 py-2 pr-10 text-sm bg-[var(--bg-input)] border border-[var(--border-card)] rounded-lg text-[var(--text-body)] disabled:opacity-50"
                  autoFocus={!flashcardGen.isGenerating}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && flashcardFront.trim()) {
                      onCreateFlashcard(flashcardModal.highlightId, flashcardFront)
                      setFlashcardModal(null)
                    }
                  }}
                />
                {flashcardGen.isGenerating ? (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--accent-text)] animate-spin" />
                ) : flashcardGen.generatedQuestion ? (
                  <button
                    onClick={() => { setFlashcardFront(''); flashcardGen.generate(flashcardModal.back) }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-[var(--text-muted)] hover:text-[var(--accent-text)]"
                    title="Regenerate"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                ) : null}
              </div>
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
