/**
 * Multi-page scrollable PDF viewer with IntersectionObserver virtualization.
 * Only renders canvas + text layer for pages visible in the viewport.
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { Loader2 } from 'lucide-react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { usePdfHighlights } from '../../hooks/usePdfHighlights'
import { PdfPageRenderer } from './PdfPageRenderer'

interface Props {
  pdfDoc: PDFDocumentProxy
  scale: number
  onPageChange: (page: number) => void
  onAskAI: (text: string, pageNumber: number) => void
  onAutoScale?: (fitScale: number) => void
  documentId: string
  examProfileId: string | undefined
  topicHighlightTexts?: string[]
}

interface PageDim {
  width: number
  height: number
}

export function PdfScrollViewer({ pdfDoc, scale, onPageChange, onAskAI, onAutoScale, documentId, examProfileId, topicHighlightTexts }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [pageDimensions, setPageDimensions] = useState<PageDim[]>([])
  const [visiblePages, setVisiblePages] = useState<Set<number>>(new Set([1]))
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map())
  const observerRef = useRef<IntersectionObserver | null>(null)

  const { highlights: _highlights, addHighlight, updateNote, deleteHighlight, createFlashcardFromHighlight, getHighlightsForPage } = usePdfHighlights(documentId, examProfileId)

  // Pre-calculate all page dimensions
  useEffect(() => {
    if (!pdfDoc) return
    let cancelled = false

    async function getDimensions() {
      const dims: PageDim[] = []
      for (let i = 1; i <= pdfDoc.numPages; i++) {
        const page = await pdfDoc.getPage(i)
        const vp = page.getViewport({ scale: 1 })
        dims.push({ width: vp.width, height: vp.height })
      }
      if (!cancelled) setPageDimensions(dims)
    }

    getDimensions()
    return () => { cancelled = true }
  }, [pdfDoc])

  // Auto-fit scale using ResizeObserver — fires on layout changes (chat resize, window resize)
  useEffect(() => {
    if (pageDimensions.length === 0 || !containerRef.current || !onAutoScale) return
    const el = containerRef.current

    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width
      if (width > 0 && pageDimensions[0]) {
        const fitScale = (width - 32) / pageDimensions[0].width
        onAutoScale(Math.min(fitScale, 2.5))
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [pageDimensions, onAutoScale])

  // Setup IntersectionObserver
  const setupObserver = useCallback(() => {
    if (observerRef.current) observerRef.current.disconnect()
    if (!containerRef.current) return

    const observer = new IntersectionObserver(
      (entries) => {
        setVisiblePages(prev => {
          const next = new Set(prev)
          for (const entry of entries) {
            const pageNum = parseInt(entry.target.getAttribute('data-page') ?? '0')
            if (!pageNum) continue
            if (entry.isIntersecting) next.add(pageNum)
            else next.delete(pageNum)
          }
          return next
        })

        // Track current page — highest intersection ratio
        let maxRatio = 0
        let maxPage = 1
        for (const entry of entries) {
          if (entry.intersectionRatio > maxRatio) {
            maxRatio = entry.intersectionRatio
            maxPage = parseInt(entry.target.getAttribute('data-page') ?? '1')
          }
        }
        if (maxRatio > 0) onPageChange(maxPage)
      },
      {
        root: containerRef.current,
        rootMargin: '300px 0px',
        threshold: [0, 0.1, 0.5],
      }
    )

    observerRef.current = observer
    pageRefs.current.forEach(el => observer.observe(el))

    return () => observer.disconnect()
  }, [onPageChange])

  // Re-setup observer when page dimensions are ready
  useEffect(() => {
    if (pageDimensions.length === 0) return
    // Refs are set synchronously during commit; useEffect fires post-commit
    setupObserver()
    return () => { observerRef.current?.disconnect() }
  }, [pageDimensions, setupObserver])

  const setPageRef = useCallback((pageNum: number, el: HTMLDivElement | null) => {
    if (el) pageRefs.current.set(pageNum, el)
    else pageRefs.current.delete(pageNum)
  }, [])

  if (pageDimensions.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--text-muted)]" />
      </div>
    )
  }

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto bg-neutral-100 dark:bg-neutral-900 flex flex-col items-center py-2 gap-2 min-h-0">
      {pageDimensions.map((dim, i) => {
        const pageNum = i + 1
        const isVisible = visiblePages.has(pageNum)
        const pageHighlights = getHighlightsForPage(pageNum)

        return (
          <div
            key={pageNum}
            ref={el => setPageRef(pageNum, el)}
            data-page={pageNum}
            style={{ width: dim.width * scale, height: dim.height * scale }}
            className="relative flex-shrink-0 shadow-md bg-white"
          >
            {isVisible && (
              <PdfPageRenderer
                pdfDoc={pdfDoc}
                pageNumber={pageNum}
                scale={scale}
                width={dim.width}
                height={dim.height}
                highlights={pageHighlights}
                onAddHighlight={(text, rects, color) => addHighlight(pageNum, text, rects, color)}
                onUpdateNote={updateNote}
                onDeleteHighlight={deleteHighlight}
                onAskAI={(text) => onAskAI(text, pageNum)}
                onCreateFlashcard={createFlashcardFromHighlight}
                topicHighlightTexts={topicHighlightTexts}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
