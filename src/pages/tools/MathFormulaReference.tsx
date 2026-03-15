import { useState, useMemo } from 'react'
import { Search, X } from 'lucide-react'
import { ToolSEO } from '../../components/SEO'
import { FormToolPage } from '../../components/FormToolPage'
import { getToolBySlug } from '../../lib/tools'
import {
  formulas,
  formulaCategories,
  categoryBadgeColors,
  type FormulaCategory,
} from '../../lib/mathFormulas'

const tool = getToolBySlug('math-formula-reference')!

type FilterCategory = FormulaCategory | 'all'

export default function MathFormulaReference() {
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<FilterCategory>('all')

  const query = search.trim().toLowerCase()

  const filtered = useMemo(() => {
    return formulas.filter(f => {
      if (activeCategory !== 'all' && f.category !== activeCategory) return false
      if (query) {
        return (
          f.name.toLowerCase().includes(query) ||
          f.description.toLowerCase().includes(query) ||
          f.formula.toLowerCase().includes(query)
        )
      }
      return true
    })
  }, [query, activeCategory])

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
              className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500"
            />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search formulas..."
              className="input-field pl-10"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-500 hover:text-surface-200"
                aria-label="Clear search"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Category tabs */}
          <div className="flex flex-wrap gap-2 justify-center">
            <button
              onClick={() => setActiveCategory('all')}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeCategory === 'all' ? 'btn-primary' : 'btn-secondary'
              }`}
            >
              All
            </button>
            {formulaCategories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  activeCategory === cat.id ? 'btn-primary' : 'btn-secondary'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Results count */}
          <p className="text-surface-500 text-sm text-center">
            {filtered.length} formula{filtered.length !== 1 ? 's' : ''}
            {query && <span> matching &ldquo;{search}&rdquo;</span>}
          </p>

          {/* Formula grid */}
          {filtered.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filtered.map(f => (
                <div key={f.name} className="glass-card glass-card-hover p-5">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <h3 className="font-[family-name:var(--font-display)] text-base font-bold text-surface-100">
                      {f.name}
                    </h3>
                    <span
                      className={`${categoryBadgeColors[f.category]} text-[10px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap`}
                    >
                      {formulaCategories.find(c => c.id === f.category)?.label}
                    </span>
                  </div>

                  <p className="font-mono text-lg text-primary-400 mb-2 break-all leading-relaxed">
                    {f.formula}
                  </p>

                  <p className="text-surface-400 text-sm">{f.description}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="glass-card p-8 text-center">
              <p className="text-surface-500">No formulas found. Try a different search.</p>
            </div>
          )}
        </div>
      </FormToolPage>
    </>
  )
}
