import { useEffect, useRef } from 'react'
import { X, Keyboard } from 'lucide-react'

const isMac = typeof navigator !== 'undefined' && /Mac/.test(navigator.userAgent)
const mod = isMac ? '\u2318' : 'Ctrl'

const SHORTCUTS = [
  { keys: `${mod} + K`, description: 'Open search' },
  { keys: `${mod} + Enter`, description: 'Send chat message' },
  { keys: 'Space', description: 'Flip flashcard' },
  { keys: '1 / 2 / 3 / 4', description: 'Rate flashcard (Again/Hard/Good/Easy)' },
  { keys: 'Escape', description: 'Close panel or modal' },
  { keys: '?', description: 'Show this help' },
]

export function KeyboardShortcutsModal({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in">
      <div ref={ref} className="glass-card w-full max-w-sm mx-4 p-6 shadow-xl">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Keyboard size={18} className="text-[var(--text-muted)]" />
            <h2 className="text-lg font-semibold text-[var(--text-heading)]">Keyboard Shortcuts</h2>
          </div>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-body)] transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="space-y-3">
          {SHORTCUTS.map(s => (
            <div key={s.keys} className="flex items-center justify-between">
              <span className="text-sm text-[var(--text-body)]">{s.description}</span>
              <kbd className="text-xs font-mono px-2 py-1 rounded bg-[var(--bg-input)] border border-[var(--border-card)] text-[var(--text-muted)]">
                {s.keys}
              </kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
