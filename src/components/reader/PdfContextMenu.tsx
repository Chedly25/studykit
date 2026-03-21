import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Sparkles, Highlighter, BookOpen, Copy } from 'lucide-react'

interface Props {
  x: number
  y: number
  selectedText: string
  onAskAI: () => void
  onHighlight: (color: string) => void
  onCreateFlashcard: () => void
  onCopy: () => void
  onClose: () => void
}

export function PdfContextMenu({ x, y, onAskAI, onHighlight, onCreateFlashcard, onCopy, onClose }: Props) {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose()
    }
    const handleScroll = () => onClose()

    document.addEventListener('keydown', handleKey)
    document.addEventListener('mousedown', handleClick, true)
    document.addEventListener('scroll', handleScroll, true)
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.removeEventListener('mousedown', handleClick, true)
      document.removeEventListener('scroll', handleScroll, true)
    }
  }, [onClose])

  // Clamp position to viewport
  const menuWidth = 200
  const menuHeight = 160
  const clampedX = Math.min(x, window.innerWidth - menuWidth - 8)
  const clampedY = Math.min(y, window.innerHeight - menuHeight - 8)

  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-[200] bg-[var(--bg-card)] border border-[var(--border-card)] shadow-md rounded-sm py-1 min-w-[180px]"
      style={{ left: clampedX, top: clampedY }}
    >
      <button
        onClick={onAskAI}
        className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-[var(--text-body)] hover:bg-[var(--bg-input)] transition-colors text-left"
      >
        <Sparkles className="w-3.5 h-3.5 text-[var(--accent-text)]" />
        Ask AI about this
      </button>

      <div className="flex items-center gap-1 px-3 py-1.5 hover:bg-[var(--bg-input)] transition-colors">
        <Highlighter className="w-3.5 h-3.5 text-[var(--text-muted)]" />
        <span className="text-xs text-[var(--text-body)] flex-1 ml-1">Highlight</span>
        <button onClick={() => onHighlight('#fbbf24')} className="w-4 h-4 rounded-sm bg-yellow-400 hover:ring-2 ring-yellow-400/50" />
        <button onClick={() => onHighlight('#34d399')} className="w-4 h-4 rounded-sm bg-emerald-400 hover:ring-2 ring-emerald-400/50" />
        <button onClick={() => onHighlight('#60a5fa')} className="w-4 h-4 rounded-sm bg-blue-400 hover:ring-2 ring-blue-400/50" />
      </div>

      <button
        onClick={onCreateFlashcard}
        className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-[var(--text-body)] hover:bg-[var(--bg-input)] transition-colors text-left"
      >
        <BookOpen className="w-3.5 h-3.5 text-[var(--accent-text)]" />
        Create Flashcard
      </button>

      <div className="border-t border-[var(--border-card)] my-0.5" />

      <button
        onClick={onCopy}
        className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-[var(--text-body)] hover:bg-[var(--bg-input)] transition-colors text-left"
      >
        <Copy className="w-3.5 h-3.5 text-[var(--text-muted)]" />
        Copy
      </button>
    </div>,
    document.body
  )
}
