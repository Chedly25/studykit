import { useEffect, useMemo, useRef } from 'react'
import { X, Keyboard } from 'lucide-react'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { useKeyboardShortcutsRegistry } from '../lib/keyboard'

const SCOPE_ORDER = ['Global', 'Navigate', 'Page', 'Modal'] as const

export function KeyboardShortcutsModal({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useFocusTrap(ref)
  const { shortcuts } = useKeyboardShortcutsRegistry()

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const grouped = useMemo(() => {
    const map = new Map<string, typeof shortcuts>()
    for (const s of shortcuts) {
      if (!s.enabled) continue
      const scope = s.scope || 'Global'
      if (!map.has(scope)) map.set(scope, [])
      map.get(scope)!.push(s)
    }
    const knownScopes = SCOPE_ORDER.filter((g) => map.has(g))
    const unknownScopes = [...map.keys()].filter((g) => !SCOPE_ORDER.includes(g as never)).sort()
    return [...knownScopes, ...unknownScopes].map((scope) => ({
      scope,
      items: map.get(scope)!.slice().sort((a, b) => a.label.localeCompare(b.label)),
    }))
  }, [shortcuts])

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in">
      <div ref={ref} className="glass-card w-full max-w-md mx-4 p-6 shadow-xl max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5 sticky top-0 bg-[var(--bg-card)] -mt-2 pt-2">
          <div className="flex items-center gap-2">
            <Keyboard size={18} className="text-[var(--text-muted)]" />
            <h2 className="text-lg font-semibold text-[var(--text-heading)] font-[family-name:var(--font-display)]">
              Keyboard Shortcuts
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--text-muted)] hover:text-[var(--text-body)] transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {grouped.length === 0 && (
          <p className="text-sm text-[var(--text-muted)] text-center py-6">
            No keyboard shortcuts registered yet.
          </p>
        )}

        <div className="space-y-5">
          {grouped.map(({ scope, items }) => (
            <div key={scope}>
              <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">
                {scope}
              </h3>
              <div className="space-y-2">
                {items.map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-3">
                    <span className="text-sm text-[var(--text-body)] flex-1">{s.label}</span>
                    <kbd className="text-xs font-[family-name:var(--font-mono)] px-2 py-1 rounded bg-[var(--bg-subtle)] border border-[var(--border-card)] text-[var(--text-muted)] shrink-0">
                      {s.display}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
