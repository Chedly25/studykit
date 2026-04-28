import { useState, useMemo, useCallback } from 'react'
import { Search, X } from 'lucide-react'
import { ToolSEO } from '../../components/SEO'
import { FormToolPage } from '../../components/FormToolPage'
import { getToolBySlug } from '../../lib/tools'
import {
  elements,
  categoryColors,
  categoryLabels,
  type Element,
  type ElementCategory,
} from '../../lib/periodicTableData'

const tool = getToolBySlug('periodic-table')!

const ALL_CATEGORIES = Object.keys(categoryColors) as ElementCategory[]

function getGridColumn(el: Element): number {
  if (el.group !== null) return el.group
  if (el.atomicNumber >= 57 && el.atomicNumber <= 71) {
    return el.atomicNumber - 57 + 4
  }
  if (el.atomicNumber >= 89 && el.atomicNumber <= 103) {
    return el.atomicNumber - 89 + 4
  }
  return 1
}

function getGridRow(el: Element): number {
  if (el.category === 'lanthanide') return 9
  if (el.category === 'actinide') return 10
  return el.period
}

interface ElementCellProps {
  element: Element
  onClick: (el: Element) => void
  dimmed: boolean
}

function ElementCell({ element, onClick, dimmed }: ElementCellProps) {
  const colors = categoryColors[element.category]
  return (
    <button
      onClick={() => onClick(element)}
      className={`${colors} rounded-md p-0.5 sm:p-1 text-center transition-all hover:scale-110 hover:z-10 cursor-pointer border border-transparent hover:border-current/20 ${
        dimmed ? 'opacity-25' : ''
      }`}
      style={{
        gridColumn: getGridColumn(element),
        gridRow: getGridRow(element),
      }}
      title={element.name}
    >
      <div className="text-[8px] sm:text-[9px] leading-none opacity-60">
        {element.atomicNumber}
      </div>
      <div className="text-xs sm:text-sm font-bold leading-tight">
        {element.symbol}
      </div>
      <div className="text-[7px] sm:text-[8px] leading-none truncate opacity-70 hidden sm:block">
        {element.name}
      </div>
    </button>
  )
}

interface DetailPanelProps {
  element: Element
  onClose: () => void
}

function DetailPanel({ element, onClose }: DetailPanelProps) {
  const colors = categoryColors[element.category]
  return (
    <div className="glass-card p-6 relative">
      <button
        onClick={onClose}
        className="absolute top-3 right-3 p-1.5 text-[var(--text-muted)] hover:text-[var(--text-body)] transition-colors"
        aria-label="Close detail panel"
      >
        <X size={18} />
      </button>

      <div className="flex items-start gap-5">
        <div
          className={`${colors} w-20 h-20 rounded-xl flex flex-col items-center justify-center`}
        >
          <span className="text-3xl font-bold leading-none">{element.symbol}</span>
          <span className="text-xs opacity-70 mt-0.5">{element.atomicNumber}</span>
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--text-heading)]">
            {element.name}
          </h3>
          <span
            className={`${colors} inline-block text-xs font-medium px-2.5 py-0.5 rounded-full mt-1`}
          >
            {categoryLabels[element.category]}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-5">
        <div className="bg-[var(--bg-input)] rounded-lg p-3">
          <p className="text-[var(--text-faint)] text-xs mb-0.5">Atomic Number</p>
          <p className="text-[var(--text-heading)] font-semibold">{element.atomicNumber}</p>
        </div>
        <div className="bg-[var(--bg-input)] rounded-lg p-3">
          <p className="text-[var(--text-faint)] text-xs mb-0.5">Atomic Mass</p>
          <p className="text-[var(--text-heading)] font-semibold">{element.atomicMass}</p>
        </div>
        <div className="bg-[var(--bg-input)] rounded-lg p-3 col-span-2">
          <p className="text-[var(--text-faint)] text-xs mb-0.5">Electron Configuration</p>
          <p className="text-[var(--text-heading)] font-semibold font-mono text-sm">
            {element.electronConfig}
          </p>
        </div>
        {element.group !== null && (
          <>
            <div className="bg-[var(--bg-input)] rounded-lg p-3">
              <p className="text-[var(--text-faint)] text-xs mb-0.5">Group</p>
              <p className="text-[var(--text-heading)] font-semibold">{element.group}</p>
            </div>
            <div className="bg-[var(--bg-input)] rounded-lg p-3">
              <p className="text-[var(--text-faint)] text-xs mb-0.5">Period</p>
              <p className="text-[var(--text-heading)] font-semibold">{element.period}</p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function PeriodicTable() {
  const [search, setSearch] = useState('')
  const [selectedElement, setSelectedElement] = useState<Element | null>(null)
  const [highlightCategory, setHighlightCategory] = useState<ElementCategory | null>(null)

  const query = search.trim().toLowerCase()

  const filteredElements = useMemo(() => {
    if (!query) return elements
    return elements.filter(
      el =>
        el.name.toLowerCase().includes(query) ||
        el.symbol.toLowerCase().includes(query) ||
        String(el.atomicNumber) === query
    )
  }, [query])

  const filteredSet = useMemo(() => new Set(filteredElements.map(el => el.atomicNumber)), [filteredElements])

  const handleElementClick = useCallback((el: Element) => {
    setSelectedElement(prev => (prev?.atomicNumber === el.atomicNumber ? null : el))
  }, [])

  const handleCategoryClick = useCallback((cat: ElementCategory) => {
    setHighlightCategory(prev => (prev === cat ? null : cat))
  }, [])

  const isDimmed = useCallback(
    (el: Element): boolean => {
      if (query && !filteredSet.has(el.atomicNumber)) return true
      if (highlightCategory !== null && el.category !== highlightCategory) return true
      return false
    },
    [query, filteredSet, highlightCategory]
  )

  return (
    <>
      <ToolSEO
        title={tool.seoTitle}
        description={tool.seoDescription}
        slug={tool.slug}
        keywords={tool.keywords}
      />
      <FormToolPage toolId={tool.id} title={tool.name} description={tool.description}>
        <div className="space-y-6">
          {/* Search bar */}
          <div className="relative max-w-md mx-auto">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)]"
            />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, symbol, or number..."
              className="input-field pl-10"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)] hover:text-[var(--text-body)]"
                aria-label="Clear search"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Category legend */}
          <div className="flex flex-wrap gap-2 justify-center">
            {ALL_CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => handleCategoryClick(cat)}
                className={`${categoryColors[cat]} text-[10px] sm:text-xs px-2 py-1 rounded-full transition-all ${
                  highlightCategory !== null && highlightCategory !== cat
                    ? 'opacity-30'
                    : ''
                }`}
              >
                {categoryLabels[cat]}
              </button>
            ))}
          </div>

          {/* Desktop periodic table grid */}
          <div className="hidden lg:block overflow-x-auto">
            <div
              className="grid gap-0.5 min-w-[900px]"
              style={{
                gridTemplateColumns: 'repeat(18, minmax(0, 1fr))',
                gridTemplateRows: 'repeat(10, auto)',
              }}
            >
              <div style={{ gridColumn: '1 / -1', gridRow: 8, height: '0.75rem' }} />

              {elements.map(el => (
                <ElementCell
                  key={el.atomicNumber}
                  element={el}
                  onClick={handleElementClick}
                  dimmed={isDimmed(el)}
                />
              ))}

              <div
                className="text-[9px] text-[var(--color-error)] flex items-center justify-end pr-1"
                style={{ gridColumn: 3, gridRow: 9 }}
              >
                La-Lu
              </div>
              <div
                className="text-[9px] text-[var(--color-error)] flex items-center justify-end pr-1"
                style={{ gridColumn: 3, gridRow: 10 }}
              >
                Ac-Lr
              </div>
            </div>
          </div>

          {/* Mobile / tablet: scrollable list */}
          <div className="lg:hidden">
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-1">
              {elements
                .filter(el => !isDimmed(el))
                .map(el => (
                  <button
                    key={el.atomicNumber}
                    onClick={() => handleElementClick(el)}
                    className={`${categoryColors[el.category]} rounded-lg p-1.5 text-center transition-all`}
                  >
                    <div className="text-[9px] opacity-60">{el.atomicNumber}</div>
                    <div className="text-sm font-bold">{el.symbol}</div>
                    <div className="text-[8px] truncate opacity-70">{el.name}</div>
                  </button>
                ))}
            </div>
            {query && filteredElements.length === 0 && (
              <p className="text-[var(--text-faint)] text-sm text-center mt-4">
                No elements match &ldquo;{search}&rdquo;
              </p>
            )}
          </div>

          {/* Detail panel */}
          {selectedElement && (
            <DetailPanel
              element={selectedElement}
              onClose={() => setSelectedElement(null)}
            />
          )}
        </div>
      </FormToolPage>
    </>
  )
}
