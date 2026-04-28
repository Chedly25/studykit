/**
 * Bibliothèque CRFPA — browse PDFs, codes, grands arrêts, Conseil constitutionnel
 * decisions, and curated foundational texts. Read-only viewer; no Vectorize
 * dependency. Each item type has its own viewer.
 */
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import {
  Library, BookOpen, Scale, ScrollText, FileText, BookMarked, CheckCircle2,
} from 'lucide-react'

import { LegalPageTabs } from '../components/legal/LegalPageTabs'
import { LIBRARY_MANIFEST } from '../lib/library/manifest.generated'
import type { LibraryCategory, LibraryEntry } from '../lib/library/types'
import { LibraryItemList } from '../components/legal/library/LibraryItemList'
import { LibraryPdfViewer } from '../components/legal/library/LibraryPdfViewer'
import { CodeTreeBrowser } from '../components/legal/library/CodeTreeBrowser'
import { GrandArretViewer } from '../components/legal/library/GrandArretViewer'
import { LibraryHtmlViewer } from '../components/legal/library/LibraryHtmlViewer'
import { LibraryMarkdownViewer } from '../components/legal/library/LibraryMarkdownViewer'
import { useExamProfile } from '../hooks/useExamProfile'
import { markOpened, markRead } from '../lib/library/readStatus'

const CATEGORY_DEFS: Array<{ id: LibraryCategory; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'codes', label: 'Codes', icon: Scale },
  { id: 'grands-arrets', label: 'Grands arrêts', icon: BookMarked },
  { id: 'cc', label: 'Conseil constitutionnel', icon: ScrollText },
  { id: 'textes', label: 'Textes fondamentaux', icon: BookOpen },
  { id: 'crfpa-officiel', label: 'CRFPA officiel', icon: FileText },
  { id: 'rapports', label: 'Rapports', icon: FileText },
]

export default function Bibliotheque() {
  const [searchParams, setSearchParams] = useSearchParams()
  const categoryParam = searchParams.get('cat') as LibraryCategory | null
  const itemParam = searchParams.get('item')

  const [activeCategory, setActiveCategory] = useState<LibraryCategory>(
    categoryParam && CATEGORY_DEFS.some(c => c.id === categoryParam) ? categoryParam : 'codes',
  )
  const [selectedId, setSelectedId] = useState<string | null>(itemParam)

  const { activeProfile } = useExamProfile()

  // Group manifest by category once.
  const byCategory = useMemo(() => {
    const map = new Map<LibraryCategory, LibraryEntry[]>()
    for (const e of LIBRARY_MANIFEST) {
      const list = map.get(e.category) ?? []
      list.push(e)
      map.set(e.category, list)
    }
    return map
  }, [])

  const categoryEntries = byCategory.get(activeCategory) ?? []
  const selected = selectedId
    ? LIBRARY_MANIFEST.find(e => e.id === selectedId) ?? null
    : null

  // Mark opened when an item is selected.
  useEffect(() => {
    if (!selected || !activeProfile?.id) return
    markOpened(activeProfile.id, selected.id).catch(() => {})
  }, [selected, activeProfile?.id])

  // Sync URL with current selection.
  useEffect(() => {
    const next = new URLSearchParams(searchParams)
    next.set('cat', activeCategory)
    if (selectedId) next.set('item', selectedId); else next.delete('item')
    setSearchParams(next, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCategory, selectedId])

  const handleSelectCategory = (cat: LibraryCategory) => {
    setActiveCategory(cat)
    setSelectedId(null)
  }

  const handleMarkRead = () => {
    if (!selected || !activeProfile?.id) return
    markRead(activeProfile.id, selected.id).catch(() => {})
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <Helmet>
        <title>Bibliothèque — CRFPA | StudiesKit</title>
        <meta
          name="description"
          content="Codes, grands arrêts, jurisprudence du Conseil constitutionnel, sujets d'examen CRFPA et textes fondamentaux — tout dans une seule bibliothèque consultable hors ligne."
        />
      </Helmet>

      <LegalPageTabs />

      <div className="flex flex-1 min-h-0">
        {/* Left rail — categories */}
        <aside className="hidden md:flex flex-col w-56 border-r border-[var(--border-card)] shrink-0">
          <div className="p-3 border-b border-[var(--border-card)] flex items-center gap-2">
            <Library className="w-4 h-4 text-[var(--accent-text)]" />
            <span className="text-sm font-semibold text-[var(--text-heading)]">Bibliothèque</span>
          </div>
          <nav className="flex-1 overflow-y-auto p-2 space-y-1">
            {CATEGORY_DEFS.map(c => {
              const Icon = c.icon
              const count = byCategory.get(c.id)?.length ?? 0
              const isActive = c.id === activeCategory
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleSelectCategory(c.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${
                    isActive
                      ? 'bg-[var(--accent-bg)] text-[var(--accent-text)] font-semibold'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span className="flex-1 text-left">{c.label}</span>
                  <span className="text-[10px] text-[var(--text-muted)] tabular-nums">{count}</span>
                </button>
              )
            })}
          </nav>
        </aside>

        {/* Item list */}
        <aside className="hidden md:flex flex-col w-80 border-r border-[var(--border-card)] shrink-0">
          <LibraryItemList
            entries={categoryEntries}
            selectedId={selectedId}
            onSelect={setSelectedId}
            examProfileId={activeProfile?.id}
          />
        </aside>

        {/* Main viewer */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Mobile category bar */}
          <div className="md:hidden border-b border-[var(--border-card)] overflow-x-auto">
            <div className="flex gap-1 p-2 min-w-max">
              {CATEGORY_DEFS.map(c => {
                const isActive = c.id === activeCategory
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleSelectCategory(c.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs whitespace-nowrap ${
                      isActive
                        ? 'bg-[var(--accent-bg)] text-[var(--accent-text)] font-semibold'
                        : 'text-[var(--text-muted)]'
                    }`}
                  >
                    {c.label} ({byCategory.get(c.id)?.length ?? 0})
                  </button>
                )
              })}
            </div>
          </div>

          {!selected ? (
            <div className="md:hidden flex-1">
              <LibraryItemList
                entries={categoryEntries}
                selectedId={selectedId}
                onSelect={setSelectedId}
                examProfileId={activeProfile?.id}
              />
            </div>
          ) : (
            <>
              {/* Action bar: mark-read button */}
              {activeProfile?.id && (
                <div className="hidden md:flex items-center justify-end gap-2 px-3 py-1.5 border-b border-[var(--border-card)]">
                  <button
                    type="button"
                    onClick={handleMarkRead}
                    className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider px-2 py-1 rounded text-[var(--text-muted)] hover:bg-[var(--bg-hover)]"
                    title="Marquer comme lu"
                  >
                    <CheckCircle2 className="w-3 h-3" />
                    Marquer comme lu
                  </button>
                </div>
              )}

              <div className="flex-1 min-h-0">
                <Viewer entry={selected} />
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  )
}

function Viewer({ entry }: { entry: LibraryEntry }) {
  switch (entry.format) {
    case 'pdf':
      return (
        <LibraryPdfViewer
          url={entry.path}
          libraryEntryId={entry.id}
          title={entry.title}
          subtitle={entry.subtitle}
        />
      )
    case 'code-tree':
      return <CodeTreeBrowser url={entry.path} title={entry.title} />
    case 'grand-arret':
      // entry.path is the seed slug (no leading /).
      return <GrandArretViewer slug={entry.path} />
    case 'html':
      return (
        <LibraryHtmlViewer
          url={entry.path}
          title={entry.title}
          subtitle={entry.subtitle}
        />
      )
    case 'markdown':
      return (
        <LibraryMarkdownViewer
          url={entry.path}
          title={entry.title}
          subtitle={entry.subtitle}
        />
      )
    default:
      return <p className="p-4 text-sm text-[var(--text-muted)]">Format inconnu.</p>
  }
}

