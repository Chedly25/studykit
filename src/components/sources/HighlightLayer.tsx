/**
 * Highlight rendering layer for PDF viewer.
 * Renders colored rectangles over the PDF canvas for saved highlights.
 */
import { useState } from 'react'
import { X, BookOpen, Trash2 } from 'lucide-react'
import type { PdfHighlight } from '../../db/schema'

interface Rect {
  x: number
  y: number
  width: number
  height: number
}

interface Props {
  highlights: PdfHighlight[]
  currentPage: number
  scale: number
  onUpdateNote: (id: string, note: string) => void
  onDelete: (id: string) => void
  onCreateFlashcard: (id: string) => void
}

export function HighlightLayer({ highlights, currentPage, scale, onUpdateNote, onDelete, onCreateFlashcard }: Props) {
  const [activeHighlight, setActiveHighlight] = useState<string | null>(null)
  const [editingNote, setEditingNote] = useState<string>('')

  const pageHighlights = highlights.filter(h => h.pageNumber === currentPage)

  if (pageHighlights.length === 0) return null

  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 10 }}>
      {pageHighlights.map(highlight => {
        let rects: Rect[] = []
        try { rects = JSON.parse(highlight.rects) } catch { return null }

        return rects.map((rect, ri) => (
          <div
            key={`${highlight.id}-${ri}`}
            className="absolute pointer-events-auto cursor-pointer"
            style={{
              left: rect.x * scale,
              top: rect.y * scale,
              width: rect.width * scale,
              height: rect.height * scale,
              backgroundColor: `${highlight.color}33`,
              borderBottom: `2px solid ${highlight.color}66`,
            }}
            onClick={() => {
              setActiveHighlight(activeHighlight === highlight.id ? null : highlight.id)
              setEditingNote(highlight.note ?? '')
            }}
          >
            {/* Popover for the first rect of active highlight */}
            {ri === 0 && activeHighlight === highlight.id && (
              <div
                className="absolute top-full left-0 mt-1 z-50 glass-card p-3 min-w-[200px] max-w-[300px] shadow-lg"
                onClick={e => e.stopPropagation()}
              >
                {/* Note */}
                {highlight.note && (
                  <p className="text-xs text-[var(--text-body)] mb-2">{highlight.note}</p>
                )}

                {/* Note input */}
                <input
                  type="text"
                  value={editingNote}
                  onChange={e => setEditingNote(e.target.value)}
                  onBlur={() => onUpdateNote(highlight.id, editingNote)}
                  onKeyDown={e => { if (e.key === 'Enter') { onUpdateNote(highlight.id, editingNote); setActiveHighlight(null) } }}
                  placeholder="Add a note..."
                  className="w-full text-xs bg-[var(--bg-input)] border border-[var(--border-card)] rounded px-2 py-1 mb-2 text-[var(--text-body)]"
                />

                {/* Actions */}
                <div className="flex gap-1">
                  <button
                    onClick={() => { onCreateFlashcard(highlight.id); setActiveHighlight(null) }}
                    className="flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-[var(--accent-bg)] text-[var(--accent-text)] hover:opacity-80"
                    title="Create Flashcard"
                  >
                    <BookOpen className="w-3 h-3" /> Flashcard
                  </button>
                  <button
                    onClick={() => { onDelete(highlight.id); setActiveHighlight(null) }}
                    className="flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-red-500/10 text-red-500 hover:opacity-80"
                    title="Delete"
                  >
                    <Trash2 className="w-3 h-3" /> Delete
                  </button>
                  <button
                    onClick={() => setActiveHighlight(null)}
                    className="ml-auto p-1 text-[var(--text-muted)] hover:text-[var(--text-body)]"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))
      })}
    </div>
  )
}
