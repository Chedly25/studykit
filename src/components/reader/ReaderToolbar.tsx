import { ArrowLeft, ZoomIn, ZoomOut, MessageCircle, Brain } from 'lucide-react'

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
}

export function ReaderToolbar({ currentPage, totalPages, scale, onZoomIn, onZoomOut, chatOpen, onToggleChat, onClose, title, highlightCount, onQuizHighlights }: Props) {
  return (
    <div className="flex items-center justify-between px-4 py-2 border-t border-[var(--border-card)] bg-[var(--bg-card)] flex-shrink-0">
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

      {/* Right: quiz + chat toggle */}
      <div className="flex items-center gap-1">
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
  )
}
