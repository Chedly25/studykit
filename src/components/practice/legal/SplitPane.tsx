/**
 * Resizable split pane — left/right on desktop, stacked on mobile.
 * No external library — pure CSS flexbox + mouse drag.
 */
import { useState, useRef, useCallback, useEffect } from 'react'

interface SplitPaneProps {
  left: React.ReactNode
  right: React.ReactNode
  defaultLeftPercent?: number
  minLeftPercent?: number
  maxLeftPercent?: number
}

export function SplitPane({
  left,
  right,
  defaultLeftPercent = 50,
  minLeftPercent = 25,
  maxLeftPercent = 75,
}: SplitPaneProps) {
  const [leftPercent, setLeftPercent] = useState(defaultLeftPercent)
  const containerRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)
  const cleanupRef = useRef<(() => void) | null>(null)

  // Clean up listeners on unmount (fix: leak if unmount during drag)
  useEffect(() => {
    return () => { cleanupRef.current?.() }
  }, [])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isDragging.current = true

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const percent = ((e.clientX - rect.left) / rect.width) * 100
      setLeftPercent(Math.min(maxLeftPercent, Math.max(minLeftPercent, percent)))
    }

    const cleanup = () => {
      isDragging.current = false
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', cleanup)
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
      cleanupRef.current = null
    }

    cleanupRef.current = cleanup
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'col-resize'
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', cleanup)
  }, [minLeftPercent, maxLeftPercent])

  return (
    <>
      {/* Desktop: side-by-side */}
      <div
        ref={containerRef}
        className="hidden lg:flex h-[calc(100vh-4rem)] overflow-hidden"
      >
        <div style={{ width: `${leftPercent}%` }} className="overflow-auto">
          {left}
        </div>
        <div
          onMouseDown={handleMouseDown}
          className="w-1 bg-[var(--border-card)] hover:bg-[var(--accent-text)] cursor-col-resize shrink-0 transition-colors"
        />
        <div style={{ width: `${100 - leftPercent}%` }} className="overflow-auto">
          {right}
        </div>
      </div>

      {/* Mobile: stacked with toggle */}
      <div className="lg:hidden flex flex-col h-[calc(100vh-4rem)]">
        <MobileToggle left={left} right={right} />
      </div>
    </>
  )
}

function MobileToggle({ left, right }: { left: React.ReactNode; right: React.ReactNode }) {
  const [showRight, setShowRight] = useState(false)

  return (
    <>
      <div className="flex border-b border-[var(--border-card)]">
        <button
          onClick={() => setShowRight(false)}
          className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
            !showRight ? 'text-[var(--accent-text)] border-b-2 border-[var(--accent-text)]' : 'text-[var(--text-muted)]'
          }`}
        >
          Dossier
        </button>
        <button
          onClick={() => setShowRight(true)}
          className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
            showRight ? 'text-[var(--accent-text)] border-b-2 border-[var(--accent-text)]' : 'text-[var(--text-muted)]'
          }`}
        >
          Rédaction
        </button>
      </div>
      <div className="flex-1 overflow-auto">
        {showRight ? right : left}
      </div>
    </>
  )
}
