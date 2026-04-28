/**
 * Filterable list of library items within a single category.
 * Renders read/unread badges from the libraryReadStatus table.
 */
import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { FileText, BookOpen, Scale, Search, CheckCircle2, Clock } from 'lucide-react'
import { db } from '../../../db'
import type { LibraryEntry } from '../../../lib/library/types'

interface Props {
  entries: readonly LibraryEntry[]
  selectedId: string | null
  onSelect: (id: string) => void
  examProfileId?: string
}

const FORMAT_ICON: Record<LibraryEntry['format'], React.ComponentType<{ className?: string }>> = {
  pdf: FileText,
  html: BookOpen,
  markdown: BookOpen,
  'code-tree': Scale,
  'grand-arret': Scale,
}

export function LibraryItemList({ entries, selectedId, onSelect, examProfileId }: Props) {
  const [search, setSearch] = useState('')

  const statuses = useLiveQuery(
    async () => {
      if (!examProfileId) return new Map<string, { status: string }>()
      const rows = await db.libraryReadStatus.where('examProfileId').equals(examProfileId).toArray()
      return new Map(rows.map(r => [r.libraryEntryId, { status: r.status }]))
    },
    [examProfileId],
    new Map<string, { status: string }>(),
  )

  const filtered = useMemo(() => {
    if (!search.trim()) return entries
    const q = search.toLowerCase().trim()
    return entries.filter(e =>
      e.title.toLowerCase().includes(q) ||
      e.subtitle?.toLowerCase().includes(q) ||
      e.tags.some(t => t.toLowerCase().includes(q)),
    )
  }, [entries, search])

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="p-3 border-b border-[var(--border-card)]">
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-[var(--bg-input)]">
          <Search className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Filtrer"
            className="flex-1 bg-transparent text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
          />
          <span className="text-[10px] text-[var(--text-muted)]">{filtered.length}</span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {filtered.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)] px-3 py-2">Aucun résultat.</p>
        ) : (
          filtered.map(entry => {
            const Icon = FORMAT_ICON[entry.format] ?? FileText
            const isActive = entry.id === selectedId
            const status = statuses?.get(entry.id)?.status
            return (
              <button
                key={entry.id}
                type="button"
                onClick={() => onSelect(entry.id)}
                className={`w-full text-left p-2.5 rounded-lg transition-colors flex items-start gap-2 ${
                  isActive
                    ? 'bg-[var(--accent-bg)]'
                    : 'hover:bg-[var(--bg-hover)]'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${isActive ? 'text-[var(--accent-text)]' : 'text-[var(--text-muted)]'}`} />
                <div className="flex-1 min-w-0">
                  <div className={`text-xs font-medium truncate ${isActive ? 'text-[var(--accent-text)]' : 'text-[var(--text-heading)]'}`}>
                    {entry.title}
                  </div>
                  {entry.subtitle && (
                    <div className="text-[10px] text-[var(--text-muted)] truncate mt-0.5">
                      {entry.subtitle}
                    </div>
                  )}
                </div>
                {status === 'read' && (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" aria-label="Lu" />
                )}
                {status === 'reading' && (
                  <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" aria-label="En cours" />
                )}
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
