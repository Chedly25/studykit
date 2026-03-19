/**
 * Cmd+K search modal — searches across documents, topics, exercises, concept cards, flashcards.
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Search, FileText, BookOpen, ListChecks, Layers, CreditCard, Loader2 } from 'lucide-react'
import { useExamProfile } from '../hooks/useExamProfile'
import { useSearch, type SearchResult } from '../hooks/useSearch'

const TYPE_CONFIG: Record<SearchResult['type'], { icon: typeof FileText; label: string; color: string }> = {
  document: { icon: FileText, label: 'Document', color: 'text-blue-500' },
  topic: { icon: BookOpen, label: 'Topic', color: 'text-purple-500' },
  exercise: { icon: ListChecks, label: 'Exercise', color: 'text-amber-500' },
  'concept-card': { icon: Layers, label: 'Concept', color: 'text-emerald-500' },
  flashcard: { icon: CreditCard, label: 'Flashcard', color: 'text-pink-500' },
}

interface Props {
  open: boolean
  onClose: () => void
}

export function SearchModal({ open, onClose }: Props) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { activeProfile } = useExamProfile()
  const { results, isSearching, search, clear } = useSearch(activeProfile?.id)

  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('')
      clear()
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open, clear])

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      clear()
      return
    }
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(query), 300)
    return () => clearTimeout(debounceRef.current)
  }, [query, search, clear])

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0)
  }, [results])

  const handleSelect = useCallback((result: SearchResult) => {
    onClose()
    navigate(result.linkTo)
  }, [navigate, onClose])

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(i => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      e.preventDefault()
      handleSelect(results[selectedIndex])
    } else if (e.key === 'Escape') {
      onClose()
    }
  }, [results, selectedIndex, handleSelect, onClose])

  if (!open) return null

  // Group results by type
  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    if (!acc[r.type]) acc[r.type] = []
    acc[r.type].push(r)
    return acc
  }, {})

  let globalIndex = -1

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative w-full max-w-xl bg-[var(--bg-card)] border border-[var(--border-card)] rounded-xl shadow-2xl overflow-hidden animate-fade-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border-card)]">
          {isSearching ? (
            <Loader2 className="w-5 h-5 text-[var(--accent-text)] animate-spin shrink-0" />
          ) : (
            <Search className="w-5 h-5 text-[var(--text-muted)] shrink-0" />
          )}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('search.placeholder', 'Search documents, topics, exercises...')}
            className="flex-1 bg-transparent text-[var(--text-body)] placeholder:text-[var(--text-muted)]/50 outline-none text-sm"
          />
          <kbd className="hidden sm:inline-flex text-[10px] text-[var(--text-faint)] border border-[var(--border-card)] rounded px-1.5 py-0.5">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[50vh] overflow-y-auto">
          {query.trim() && results.length === 0 && !isSearching && (
            <div className="px-4 py-8 text-center text-sm text-[var(--text-muted)]">
              {t('search.noResults', 'No results found')}
            </div>
          )}

          {Object.entries(grouped).map(([type, items]) => {
            const config = TYPE_CONFIG[type as SearchResult['type']]
            if (!config) return null

            return (
              <div key={type}>
                <div className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] bg-[var(--bg-body)]/50">
                  {config.label}s
                </div>
                {items.map(result => {
                  globalIndex++
                  const idx = globalIndex
                  const Icon = config.icon

                  return (
                    <button
                      key={result.id}
                      onClick={() => handleSelect(result)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`w-full flex items-start gap-3 px-4 py-2.5 text-left transition-colors ${
                        selectedIndex === idx
                          ? 'bg-[var(--accent-bg)]'
                          : 'hover:bg-[var(--bg-input)]'
                      }`}
                    >
                      <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${config.color}`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-[var(--text-heading)] truncate">
                          {result.title}
                        </div>
                        {result.snippet && (
                          <div className="text-xs text-[var(--text-muted)] line-clamp-1 mt-0.5">
                            {result.snippet}
                          </div>
                        )}
                      </div>
                      {result.metadata?.mastery !== undefined && (
                        <span className="text-xs text-[var(--text-faint)] shrink-0">
                          {Math.round(result.metadata.mastery * 100)}%
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>

        {/* Footer hint */}
        {results.length > 0 && (
          <div className="px-4 py-2 border-t border-[var(--border-card)] flex items-center gap-4 text-[10px] text-[var(--text-faint)]">
            <span><kbd className="border border-[var(--border-card)] rounded px-1">↑↓</kbd> navigate</span>
            <span><kbd className="border border-[var(--border-card)] rounded px-1">↵</kbd> open</span>
            <span><kbd className="border border-[var(--border-card)] rounded px-1">esc</kbd> close</span>
          </div>
        )}
      </div>
    </div>
  )
}
