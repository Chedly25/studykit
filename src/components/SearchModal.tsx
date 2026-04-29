/**
 * Cmd+K command palette + content search.
 * Commands are read from the global CommandRegistry; semantic content search
 * remains via useSearch (documents, topics, exercises, concept-cards, flashcards).
 */
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Search,
  FileText,
  BookOpen,
  ListChecks,
  Layers,
  CreditCard,
  Loader2,
  Command as CommandIcon,
  Clock,
} from 'lucide-react'
import { useExamProfile } from '../hooks/useExamProfile'
import { useSearch, type SearchResult } from '../hooks/useSearch'
import { useCommandRegistry, type Command } from '../lib/commands'

const TYPE_CONFIG: Record<SearchResult['type'], { icon: typeof FileText; label: string; color: string }> = {
  document: { icon: FileText, label: 'Document', color: 'text-[var(--color-info)]' },
  topic: { icon: BookOpen, label: 'Topic', color: 'text-[var(--color-tag-flashcard)]' },
  exercise: { icon: ListChecks, label: 'Exercise', color: 'text-[var(--color-warning)]' },
  'concept-card': { icon: Layers, label: 'Concept', color: 'text-[var(--accent-text)]' },
  flashcard: { icon: CreditCard, label: 'Flashcard', color: 'text-[var(--color-error)]' },
}

const GROUP_ORDER = ['Navigate', 'Coaches', 'Study', 'Insight', 'Actions', 'Settings'] as const

interface Props {
  open: boolean
  onClose: () => void
}

type FlatItem =
  | { kind: 'command'; group: string; command: Command }
  | { kind: 'result'; group: string; result: SearchResult }

function fuzzyMatch(query: string, command: Command): boolean {
  const q = query.toLowerCase()
  if (command.label.toLowerCase().includes(q)) return true
  if (command.keywords?.some((k) => k.toLowerCase().includes(q))) return true
  if (command.group?.toLowerCase().includes(q)) return true
  return false
}

export function SearchModal({ open, onClose }: Props) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { activeProfile } = useExamProfile()
  const { results, isSearching, search, clear } = useSearch(activeProfile?.id)
  const { commands, recents, recordExecution } = useCommandRegistry()

  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Filter & group commands
  const filteredCommands = useMemo(() => {
    if (!query.trim()) return commands
    return commands.filter((c) => fuzzyMatch(query, c))
  }, [commands, query])

  const recentCommands = useMemo(() => {
    if (query.trim()) return []
    const map = new Map(commands.map((c) => [c.id, c]))
    return recents.map((id) => map.get(id)).filter((c): c is Command => Boolean(c))
  }, [commands, recents, query])

  const groupedCommands = useMemo(() => {
    const groups = new Map<string, Command[]>()
    const recentIds = new Set(recentCommands.map((c) => c.id))
    for (const cmd of filteredCommands) {
      // Skip commands already in Recent (avoid duplicates when query is empty)
      if (recentIds.has(cmd.id)) continue
      const group = cmd.group ?? 'Actions'
      if (!groups.has(group)) groups.set(group, [])
      groups.get(group)!.push(cmd)
    }
    // Sort by GROUP_ORDER, with unknown groups appended alphabetically
    const knownGroups = GROUP_ORDER.filter((g) => groups.has(g))
    const unknownGroups = [...groups.keys()].filter((g) => !GROUP_ORDER.includes(g as never)).sort()
    return [...knownGroups, ...unknownGroups].map((group) => ({
      group,
      commands: groups.get(group)!,
    }))
  }, [filteredCommands, recentCommands])

  // Build a flat list of all selectable items in display order
  const flatItems = useMemo<FlatItem[]>(() => {
    const items: FlatItem[] = []
    for (const cmd of recentCommands) {
      items.push({ kind: 'command', group: 'Recent', command: cmd })
    }
    for (const { group, commands: cmds } of groupedCommands) {
      for (const cmd of cmds) items.push({ kind: 'command', group, command: cmd })
    }
    for (const result of results) {
      const cfg = TYPE_CONFIG[result.type]
      items.push({ kind: 'result', group: cfg ? `${cfg.label}s` : 'Search', result })
    }
    return items
  }, [recentCommands, groupedCommands, results])

  // Focus input + reset state when opened
  useEffect(() => {
    if (open) {
      setQuery('')
      clear()
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open, clear])

  // Debounced semantic search
  useEffect(() => {
    if (!query.trim()) {
      clear()
      return
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(query), 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, search, clear])

  // Reset selection when item set changes
  useEffect(() => {
    setSelectedIndex(0)
  }, [query, results.length, commands.length])

  const executeCommand = useCallback(
    (cmd: Command) => {
      onClose()
      recordExecution(cmd.id)
      // Defer perform to next tick so the modal close animation doesn't compete
      setTimeout(() => cmd.perform(), 0)
    },
    [onClose, recordExecution],
  )

  const openResult = useCallback(
    (result: SearchResult) => {
      onClose()
      navigate(result.linkTo)
    },
    [navigate, onClose],
  )

  const handleSelect = useCallback(
    (item: FlatItem) => {
      if (item.kind === 'command') executeCommand(item.command)
      else openResult(item.result)
    },
    [executeCommand, openResult],
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((i) => Math.min(i + 1, flatItems.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((i) => Math.max(i - 1, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const item = flatItems[selectedIndex]
        if (item) handleSelect(item)
      } else if (e.key === 'Escape') {
        onClose()
      }
    },
    [flatItems, selectedIndex, handleSelect, onClose],
  )

  if (!open) return null

  // Walk flatItems while rendering, tracking section transitions
  let renderIndex = -1
  const sections: { group: string; items: FlatItem[] }[] = []
  for (const item of flatItems) {
    const last = sections[sections.length - 1]
    if (!last || last.group !== item.group) {
      sections.push({ group: item.group, items: [item] })
    } else {
      last.items.push(item)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      <div
        className="relative w-full max-w-xl bg-[var(--bg-card)] border border-[var(--border-card)] rounded-xl shadow-2xl overflow-hidden animate-fade-in"
        onClick={(e) => e.stopPropagation()}
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
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('search.placeholder')}
            className="flex-1 bg-transparent text-[var(--text-body)] placeholder:text-[var(--text-muted)]/50 outline-none text-sm"
          />
          <kbd className="hidden sm:inline-flex text-[10px] text-[var(--text-faint)] border border-[var(--border-card)] rounded px-1.5 py-0.5">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[50vh] overflow-y-auto">
          {sections.map(({ group, items }) => (
            <div key={group}>
              <div className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] bg-[var(--bg-body)]/60 flex items-center gap-1.5">
                {group === 'Recent' && <Clock className="w-3 h-3" />}
                {group}
              </div>
              {items.map((item) => {
                renderIndex++
                const idx = renderIndex
                const isSelected = selectedIndex === idx

                if (item.kind === 'command') {
                  const Icon = item.command.icon ?? CommandIcon
                  return (
                    <button
                      key={`cmd-${item.command.id}-${idx}`}
                      onClick={() => handleSelect(item)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                        isSelected ? 'bg-[var(--accent-bg)]' : 'hover:bg-[var(--bg-input)]'
                      }`}
                    >
                      <Icon className="w-4 h-4 text-[var(--accent-text)] shrink-0" />
                      <span className="text-sm font-medium text-[var(--text-heading)] flex-1 truncate">
                        {item.command.label}
                      </span>
                      {item.command.hint && (
                        <span className="text-[11px] font-[family-name:var(--font-mono)] text-[var(--text-faint)] shrink-0">
                          {item.command.hint}
                        </span>
                      )}
                    </button>
                  )
                }

                // result
                const cfg = TYPE_CONFIG[item.result.type]
                const Icon = cfg?.icon ?? FileText
                return (
                  <button
                    key={`res-${item.result.id}-${idx}`}
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`w-full flex items-start gap-3 px-4 py-2.5 text-left transition-colors ${
                      isSelected ? 'bg-[var(--accent-bg)]' : 'hover:bg-[var(--bg-input)]'
                    }`}
                  >
                    <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${cfg?.color ?? 'text-[var(--text-muted)]'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-[var(--text-heading)] truncate">
                        {item.result.title}
                      </div>
                      {item.result.snippet && (
                        <div className="text-xs text-[var(--text-muted)] line-clamp-1 mt-0.5">
                          {item.result.snippet}
                        </div>
                      )}
                    </div>
                    {item.result.metadata?.mastery !== undefined && (
                      <span className="text-xs text-[var(--text-faint)] shrink-0">
                        {Math.round(item.result.metadata.mastery * 100)}%
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          ))}

          {flatItems.length === 0 && query.trim() && !isSearching && (
            <div className="px-4 py-8 text-center text-sm text-[var(--text-muted)]">
              {t('search.noResults')}
            </div>
          )}
        </div>

        {/* Footer hint */}
        {flatItems.length > 0 && (
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
