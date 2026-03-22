/**
 * Full document reader — "Cursor for PDFs"
 * Route: /read/:documentId
 *
 * Split-pane layout: scrollable multi-page PDF viewer on the left,
 * AI chat pane on the right. Native text selection via pdfjs text layer,
 * context menu with "Ask AI", highlight, flashcard creation.
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { useExamProfile } from '../hooks/useExamProfile'
import { PdfScrollViewer } from '../components/reader/PdfScrollViewer'
import { ReaderChatPane } from '../components/reader/ReaderChatPane'
import { ReaderToolbar } from '../components/reader/ReaderToolbar'
import { RecallSuggestion } from '../components/reader/RecallSuggestion'
import type { Document } from '../db/schema'

export default function DocumentReader() {
  const { documentId } = useParams<{ documentId: string }>()
  const [searchParams] = useSearchParams()
  const topicId = searchParams.get('topicId')
  const navigate = useNavigate()
  const { activeProfile } = useExamProfile()
  const profileId = activeProfile?.id

  const [pdfDoc, setPdfDoc] = useState<any>(null)
  const [documentMeta, setDocumentMeta] = useState<Document | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [scale, setScale] = useState(1.2)
  const manualZoom = useRef(false)
  const [chatOpen, setChatOpen] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [selectionContext, setSelectionContext] = useState<{ text: string; pageNumber: number; documentTitle: string } | null>(null)

  // Active recall suggestion
  const [showRecallSuggestion, setShowRecallSuggestion] = useState(false)
  const lastQuizPageRef = useRef(0)
  const PAGE_INTERVAL = 5

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page)
    if (page - lastQuizPageRef.current >= PAGE_INTERVAL) {
      setShowRecallSuggestion(true)
    }
  }, [])

  const handleRecallQuiz = useCallback(() => {
    setShowRecallSuggestion(false)
    const fromPage = Math.max(1, currentPage - PAGE_INTERVAL + 1)
    lastQuizPageRef.current = currentPage
    setChatOpen(true)
    setSelectionContext({
      text: `Quick recall check: generate a 2-question quiz about what I just read (pages ${fromPage} to ${currentPage}).`,
      pageNumber: currentPage,
      documentTitle: documentMeta?.title ?? 'this document',
    })
  }, [currentPage, documentMeta])

  const handleRecallDismiss = useCallback(() => {
    setShowRecallSuggestion(false)
    lastQuizPageRef.current = currentPage
  }, [currentPage])

  // Fix 1: Resizable chat panel
  const [chatWidth, setChatWidth] = useState(400)
  const isDragging = useRef(false)
  const dragStartX = useRef(0)
  const dragStartWidth = useRef(0)

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return
      const newWidth = dragStartWidth.current - (e.clientX - dragStartX.current)
      setChatWidth(Math.max(280, Math.min(700, newWidth)))
    }
    const handleMouseUp = () => {
      if (!isDragging.current) return
      isDragging.current = false
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
    }
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    isDragging.current = true
    dragStartX.current = e.clientX
    dragStartWidth.current = chatWidth
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'col-resize'
  }, [chatWidth])

  // Fix 3: Load topic chunks for highlighting
  const topicChunkTexts = useLiveQuery(
    async () => {
      if (!topicId || !documentId) return []
      const chunks = await db.documentChunks
        .where('documentId').equals(documentId)
        .filter(c => c.topicId === topicId)
        .toArray()
      return chunks.map(c => c.content)
    },
    [topicId, documentId],
  ) ?? []

  // Load document metadata + PDF blob
  useEffect(() => {
    if (!documentId) {
      setError('Invalid document URL.')
      setLoading(false)
      return
    }
    let cancelled = false

    async function load() {
      try {
        // Load document metadata
        const doc = await db.documents.get(documentId!)
        if (!doc) {
          setError('Document not found')
          setLoading(false)
          return
        }
        if (!cancelled) setDocumentMeta(doc)

        // Load PDF file blob
        const docFile = await db.documentFiles
          .where('documentId')
          .equals(documentId!)
          .first()

        if (!docFile) {
          setError('PDF file not available. Only PDFs uploaded recently can be viewed.')
          setLoading(false)
          return
        }

        // Load pdfjs-dist
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pdfjsLib: any = await import('pdfjs-dist/build/pdf.mjs')
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`

        const arrayBuffer = await docFile.file.arrayBuffer()
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

        if (!cancelled) {
          setPdfDoc(pdf)
          setLoading(false)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load PDF')
          setLoading(false)
        }
      }
    }

    load()
    return () => { cancelled = true }
  }, [documentId])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || (e.target instanceof HTMLElement && e.target.isContentEditable)) return
      if (e.key === 'Escape') navigate(-1)
      else if (e.key === '+' || e.key === '=') { manualZoom.current = true; setScale(s => Math.min(3, s + 0.2)) }
      else if (e.key === '-') { manualZoom.current = true; setScale(s => Math.max(0.5, s - 0.2)) }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [navigate])

  // Auto-fit scale — respects manual zoom
  const handleAutoScale = useCallback((fitScale: number) => {
    if (!manualZoom.current) {
      setScale(fitScale)
    }
  }, [])

  const handleAskAI = useCallback((text: string, pageNumber: number) => {
    setChatOpen(true)
    setSelectionContext({
      text: text.slice(0, 500),
      pageNumber,
      documentTitle: documentMeta?.title ?? 'this document',
    })
  }, [documentMeta])

  if (loading) {
    return (
      <div className="h-[calc(100vh-3.5rem)] flex items-center justify-center">
        <div className="flex items-center gap-3 text-[var(--text-muted)]">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading document...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-[calc(100vh-3.5rem)] flex items-center justify-center">
        <div className="text-center max-w-sm">
          <p className="text-sm text-[var(--text-muted)] mb-4">{error}</p>
          <button onClick={() => navigate(-1)} className="btn-primary px-4 py-2 text-sm">Go Back</button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col">
      {/* Split pane: PDF + Chat */}
      <div className="flex-1 flex min-h-0">
        {/* PDF viewer */}
        {pdfDoc && (
          <div className="flex-1 relative min-w-0">
            <PdfScrollViewer
              pdfDoc={pdfDoc}
              scale={scale}
              onPageChange={handlePageChange}
              onAskAI={handleAskAI}
              onAutoScale={handleAutoScale}
              documentId={documentId!}
              examProfileId={profileId}
              topicHighlightTexts={topicChunkTexts}
            />
            {showRecallSuggestion && (
              <RecallSuggestion
                onQuizMe={handleRecallQuiz}
                onDismiss={handleRecallDismiss}
              />
            )}
          </div>
        )}

        {/* Drag handle */}
        {chatOpen && (
          <div
            onMouseDown={handleDragStart}
            className="w-1 flex-shrink-0 cursor-col-resize hover:bg-[var(--accent-text)]/30 active:bg-[var(--accent-text)]/50 transition-colors"
          />
        )}

        {/* Chat pane */}
        {chatOpen && documentMeta && (
          <div style={{ width: chatWidth }} className="flex-shrink-0">
            <ReaderChatPane
              documentId={documentId!}
              documentTitle={documentMeta.title}
              documentCategory={documentMeta.category}
              selectionContext={selectionContext}
              onSelectionContextConsumed={() => setSelectionContext(null)}
              onClose={() => setChatOpen(false)}
            />
          </div>
        )}
      </div>

      {/* Toolbar */}
      <ReaderToolbar
        currentPage={currentPage}
        totalPages={pdfDoc?.numPages ?? 0}
        scale={scale}
        onZoomIn={() => { manualZoom.current = true; setScale(s => Math.min(3, s + 0.2)) }}
        onZoomOut={() => { manualZoom.current = true; setScale(s => Math.max(0.5, s - 0.2)) }}
        chatOpen={chatOpen}
        onToggleChat={() => setChatOpen(prev => !prev)}
        onClose={() => navigate(-1)}
        title={documentMeta?.title ?? ''}
      />
    </div>
  )
}
