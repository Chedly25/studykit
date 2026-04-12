import { useRef, useEffect } from 'react'
import { ArrowLeft, ZoomIn, ZoomOut, MessageCircle, Brain, Search, ChevronUp, ChevronDown, X, List } from 'lucide-react'

interface Props {
  currentPage: number
  totalPages: number
  scale: number
  onZoomIn: () => void
  onZoomOut: () => void
  chatOpen: boolean
  onToggleChat: () => void
  onClose: () => void
  title: string
  highlightCount?: number
  onQuizHighlights?: () => void
  // Search
  searchOpen?: boolean
  onToggleSearch?: () => void
  searchQuery?: string
  onSearchQueryChange?: (q: string) => void
  searchMatchCount?: number
  searchCurrentIndex?: number
  onSearchNext?: () => void
  onSearchPrev?: () => void
  onSearchClose?: () => void
  // TOC
  hasOutline?: boolean
  onToggleOutline?: () => void
}

export function ReaderToolbar({
  currentPage, totalPages, scale, onZoomIn, onZoomOut, chatOpen, onToggleChat,
  onClose, title, highlightCount, onQuizHighlights,
  searchOpen, onToggleSearch, searchQuery, onSearchQueryChange, searchMatchCount,
  searchCurrentIndex, onSearchNext, onSearchPrev, onSearchClose,
  hasOutline, onToggleOutline,
}: Props) {
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus()
  }, [searchOpen])

  return (
    <div className="border-t border-[var(--border-card)] bg-[var(--bg-card)] flex-shrink-0">
      {/* Search bar (slides in above main toolbar) */}
      {searchOpen && (
        <div className="flex items-center gap-2 px-4 py-1.5 border-b border-[var(--border-card)] bg-[var(--bg-input)]/30">
          <Search className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery ?? ''}
            onChange={e => onSearchQueryChange?.(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') e.shiftKey ? onSearchPrev?.() : onSearchNext?.()
              if (e.key === 'Escape') onSearchClose?.()
            }}
            placeholder="Find in document..."
            className="flex-1 text-sm bg-transparent text-[var(--text-body)] placeholder:text-[var(--text-faint)] outline-none"
          />
          {(searchMatchCount ?? 0) > 0 && (
            <span className="text-xs text-[var(--text-muted)] tabular-nums shrink-0">
              {(searchCurrentIndex ?? 0) + 1} / {searchMatchCount}
            </span>
          )}
          {searchQuery && searchMatchCount === 0 && (
            <span className="text-xs text-[var(--text-faint)] shrink-0">No matches</span>
          )}
          <button onClick={onSearchPrev} className="p-1 rounded text-[var(--text-muted)] hover:bg-[var(--bg-input)]" title="Previous (Shift+Enter)">
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
          <button onClick={onSearchNext} className="p-1 rounded text-[var(--text-muted)] hover:bg-[var(--bg-input)]" title="Next (Enter)">
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
          <button onClick={onSearchClose} className="p-1 rounded text-[var(--text-muted)] hover:bg-[var(--bg-input)]" title="Close (Esc)">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main toolbar */}
      <div className="flex items-center justify-between px-4 py-2">
        {/* Left: back + title */}
        <button onClick={onClose} className="flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text-body)] transition-colors">
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Back</span>
        </button>
        <span className="text-xs text-[var(--text-muted)] truncate max-w-[200px] mx-4 hidden sm:inline">{title}</span>

        {/* Center: page + zoom */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--text-muted)]">{currentPage} / {totalPages}</span>
          <div className="w-px h-4 bg-[var(--border-card)]" />
          <button onClick={onZoomOut} className="p-1 rounded text-[var(--text-muted)] hover:bg-[var(--bg-input)] transition-colors">
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs text-[var(--text-muted)] min-w-[3ch] text-center">{Math.round(scale * 100)}%</span>
          <button onClick={onZoomIn} className="p-1 rounded text-[var(--text-muted)] hover:bg-[var(--bg-input)] transition-colors">
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>

        {/* Right: search + TOC + quiz + chat toggle */}
        <div className="flex items-center gap-1">
          <button
            onClick={onToggleSearch}
            className={`p-1.5 rounded-lg transition-colors ${
              searchOpen ? 'bg-[var(--accent-bg)] text-[var(--accent-text)]' : 'text-[var(--text-muted)] hover:bg-[var(--bg-input)]'
            }`}
            title="Find in document (Ctrl+F)"
          >
            <Search className="w-4 h-4" />
          </button>
          {hasOutline && (
            <button
              onClick={onToggleOutline}
              className="p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-input)] transition-colors"
              title="Table of contents"
            >
              <List className="w-4 h-4" />
            </button>
          )}
          {highlightCount !== undefined && highlightCount > 0 && onQuizHighlights && (
            <button
              onClick={onQuizHighlights}
              className="p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-input)] hover:text-[var(--accent-text)] transition-colors"
              title={`Quiz me on ${highlightCount} highlight${highlightCount > 1 ? 's' : ''}`}
            >
              <Brain className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onToggleChat}
            className={`p-1.5 rounded-lg transition-colors ${
              chatOpen
                ? 'bg-[var(--accent-bg)] text-[var(--accent-text)]'
                : 'text-[var(--text-muted)] hover:bg-[var(--bg-input)]'
            }`}
            title="Toggle AI chat"
          >
            <MessageCircle className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
