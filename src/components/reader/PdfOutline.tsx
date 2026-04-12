/**
 * Renders a PDF outline (bookmarks/table of contents) as a collapsible tree.
 * Uses pdfjs getOutline() data. Each item resolves to a page number.
 */
import { useState, useEffect, useCallback } from 'react'
import { ChevronRight, ChevronDown } from 'lucide-react'

interface OutlineNode {
  title: string
  dest: string | any[] | null
  items?: OutlineNode[]
}

interface Props {
  outline: OutlineNode[]
  pdfDoc: any
  onJumpToPage: (page: number) => void
  onClose: () => void
}

function OutlineItem({ item, pdfDoc, onJumpToPage, depth }: {
  item: OutlineNode
  pdfDoc: any
  onJumpToPage: (page: number) => void
  depth: number
}) {
  const [expanded, setExpanded] = useState(depth < 2)
  const hasChildren = item.items && item.items.length > 0

  const handleClick = useCallback(async () => {
    if (!item.dest || !pdfDoc) return
    try {
      let dest = item.dest
      if (typeof dest === 'string') {
        dest = await pdfDoc.getDestination(dest)
      }
      if (Array.isArray(dest) && dest[0]) {
        const pageIndex = await pdfDoc.getPageIndex(dest[0])
        onJumpToPage(pageIndex + 1)
      }
    } catch { /* invalid destination */ }
  }, [item.dest, pdfDoc, onJumpToPage])

  return (
    <div>
      <div
        className="flex items-center gap-1 py-1 px-2 rounded hover:bg-[var(--bg-input)] transition-colors cursor-pointer group"
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        {hasChildren ? (
          <button onClick={() => setExpanded(!expanded)} className="p-0.5 shrink-0">
            {expanded
              ? <ChevronDown className="w-3 h-3 text-[var(--text-muted)]" />
              : <ChevronRight className="w-3 h-3 text-[var(--text-muted)]" />
            }
          </button>
        ) : (
          <span className="w-4" />
        )}
        <button
          onClick={handleClick}
          className="text-xs text-[var(--text-body)] group-hover:text-[var(--accent-text)] text-left truncate flex-1 transition-colors"
          title={item.title}
        >
          {item.title}
        </button>
      </div>
      {hasChildren && expanded && item.items!.map((child, i) => (
        <OutlineItem key={i} item={child} pdfDoc={pdfDoc} onJumpToPage={onJumpToPage} depth={depth + 1} />
      ))}
    </div>
  )
}

export function PdfOutline({ outline, pdfDoc, onJumpToPage, onClose }: Props) {
  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="absolute left-0 top-0 bottom-0 z-10 w-64 bg-[var(--bg-card)] border-r border-[var(--border-card)] shadow-lg flex flex-col animate-slide-in-left overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-card)] shrink-0">
        <span className="text-xs font-semibold text-[var(--text-heading)]">Table of Contents</span>
        <button onClick={onClose} className="text-xs text-[var(--text-muted)] hover:text-[var(--text-body)]">Close</button>
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        {outline.map((item, i) => (
          <OutlineItem key={i} item={item} pdfDoc={pdfDoc} onJumpToPage={onJumpToPage} depth={0} />
        ))}
      </div>
    </div>
  )
}
