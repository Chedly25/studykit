/**
 * Citation parsing and rendering for AI responses.
 * Format: [Source: "Document Title", §N]
 */
import { useState, useCallback } from 'react'
import { BookOpen, X } from 'lucide-react'
import { db } from '../../db'

const CITATION_PATTERN = /\[Source:\s*"([^"]+)",\s*§(\d+)\]/

export interface Citation {
  fullMatch: string
  documentTitle: string
  chunkIndex: number
}

/**
 * Extract citations from text.
 */
export function parseCitations(text: string): Citation[] {
  const citations: Citation[] = []
  let match
  const regex = new RegExp(CITATION_PATTERN.source, 'g')
  while ((match = regex.exec(text)) !== null) {
    citations.push({
      fullMatch: match[0],
      documentTitle: match[1],
      chunkIndex: parseInt(match[2], 10),
    })
  }
  return citations
}

/**
 * Check if text contains any citations.
 */
export function hasCitations(text: string): boolean {
  return CITATION_PATTERN.test(text)
}

/**
 * Load chunk content + metadata for a citation.
 * Returns null if no matching document or chunk found.
 */
export async function loadChunkForCitation(
  examProfileId: string,
  docTitle: string,
  chunkIndex: number,
): Promise<{ content: string; pageNumber?: number; documentId: string } | null> {
  const docs = await db.documents
    .where('examProfileId')
    .equals(examProfileId)
    .filter(d => d.title === docTitle)
    .toArray()

  if (docs.length === 0) return null

  const chunks = await db.documentChunks
    .where('documentId')
    .equals(docs[0].id)
    .filter(c => c.chunkIndex === chunkIndex)
    .toArray()

  if (chunks.length === 0) return null
  return {
    content: chunks[0].content,
    pageNumber: chunks[0].pageNumber,
    documentId: docs[0].id,
  }
}

// ─── Components ─────────────────────────────────────────────────

interface CitationBadgeProps {
  citation: Citation
  index: number
  onClick: () => void
}

export function CitationBadge({ citation, index, onClick }: CitationBadgeProps) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-[var(--accent-bg)] text-[var(--accent-text)] hover:opacity-80 transition-opacity cursor-pointer align-baseline"
      title={`${citation.documentTitle}, chunk ${citation.chunkIndex}`}
    >
      <BookOpen className="w-2.5 h-2.5" />
      {index + 1}
    </button>
  )
}

interface CitationPopoverProps {
  citation: Citation
  content: string | null
  isLoading: boolean
  onClose: () => void
}

export function CitationPopover({ citation, content, isLoading, onClose }: CitationPopoverProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div className="glass-card p-4 max-w-lg mx-4 max-h-[60vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-[var(--accent-text)]" />
            <span className="text-sm font-semibold text-[var(--text-heading)]">
              {citation.documentTitle}
            </span>
            <span className="text-xs text-[var(--text-muted)]">§{citation.chunkIndex}</span>
          </div>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-body)]">
            <X className="w-4 h-4" />
          </button>
        </div>
        {isLoading ? (
          <p className="text-sm text-[var(--text-muted)]">Loading...</p>
        ) : content ? (
          <p className="text-sm text-[var(--text-body)] whitespace-pre-wrap leading-relaxed">{content}</p>
        ) : (
          <p className="text-sm text-[var(--text-muted)]">Source content not found.</p>
        )}
      </div>
    </div>
  )
}

/**
 * Hook for managing citation popover state.
 * Optionally takes an onJumpToPage callback that's called when the clicked
 * citation's chunk has a known pageNumber (only PDF uploads).
 */
export function useCitationPopover(
  examProfileId: string | undefined,
  onJumpToPage?: (pageNumber: number) => void,
) {
  const [activeCitation, setActiveCitation] = useState<Citation | null>(null)
  const [citationContent, setCitationContent] = useState<string | null>(null)
  const [isLoadingCitation, setIsLoadingCitation] = useState(false)

  const showCitation = useCallback(async (citation: Citation) => {
    if (!examProfileId) return
    setActiveCitation(citation)
    setIsLoadingCitation(true)
    setCitationContent(null)

    try {
      const result = await loadChunkForCitation(examProfileId, citation.documentTitle, citation.chunkIndex)
      setCitationContent(result?.content ?? null)
      // Jump to page if we have one and a handler is provided
      if (result?.pageNumber !== undefined && onJumpToPage) {
        onJumpToPage(result.pageNumber)
      }
    } catch {
      setCitationContent(null)
    } finally {
      setIsLoadingCitation(false)
    }
  }, [examProfileId, onJumpToPage])

  const closeCitation = useCallback(() => {
    setActiveCitation(null)
    setCitationContent(null)
  }, [])

  return { activeCitation, citationContent, isLoadingCitation, showCitation, closeCitation }
}
