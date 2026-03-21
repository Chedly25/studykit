/**
 * Full document reader — "Cursor for PDFs"
 * Route: /read/:documentId
 *
 * Split-pane layout: scrollable multi-page PDF viewer on the left,
 * AI chat pane on the right. Native text selection via pdfjs text layer,
 * context menu with "Ask AI", highlight, flashcard creation.
 */
import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { db } from '../db'
import { useExamProfile } from '../hooks/useExamProfile'
import { PdfScrollViewer } from '../components/reader/PdfScrollViewer'
import { ReaderChatPane } from '../components/reader/ReaderChatPane'
import { ReaderToolbar } from '../components/reader/ReaderToolbar'
import type { Document } from '../db/schema'

export default function DocumentReader() {
  const { documentId } = useParams<{ documentId: string }>()
  const navigate = useNavigate()
  const { activeProfile } = useExamProfile()
  const profileId = activeProfile?.id

  const [pdfDoc, setPdfDoc] = useState<any>(null)
  const [documentMeta, setDocumentMeta] = useState<Document | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [scale, setScale] = useState(1.2)
  const [chatOpen, setChatOpen] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [chatPrefill, setChatPrefill] = useState<string | undefined>()

  // Load document metadata + PDF blob
  useEffect(() => {
    if (!documentId) return
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
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'Escape') navigate(-1)
      else if (e.key === '+' || e.key === '=') setScale(s => Math.min(3, s + 0.2))
      else if (e.key === '-') setScale(s => Math.max(0.5, s - 0.2))
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [navigate])

  const handleAskAI = useCallback((text: string, pageNumber: number) => {
    setChatOpen(true)
    setChatPrefill(
      `From page ${pageNumber} of "${documentMeta?.title ?? 'this document'}":\n\n"${text.slice(0, 500)}"\n\nExplain this.`
    )
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
          <PdfScrollViewer
            pdfDoc={pdfDoc}
            scale={scale}
            onPageChange={setCurrentPage}
            onAskAI={handleAskAI}
            documentId={documentId!}
            examProfileId={profileId}
          />
        )}

        {/* Chat pane */}
        {chatOpen && documentMeta && (
          <div className="w-[400px] flex-shrink-0">
            <ReaderChatPane
              documentId={documentId!}
              documentTitle={documentMeta.title}
              prefill={chatPrefill}
              onPrefillConsumed={() => setChatPrefill(undefined)}
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
        onZoomIn={() => setScale(s => Math.min(3, s + 0.2))}
        onZoomOut={() => setScale(s => Math.max(0.5, s - 0.2))}
        chatOpen={chatOpen}
        onToggleChat={() => setChatOpen(prev => !prev)}
        onClose={() => navigate(-1)}
        title={documentMeta?.title ?? ''}
      />
    </div>
  )
}
