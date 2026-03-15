import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'
import { categories, getToolsByCategory } from '../lib/tools'

export function MegaMenu() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-surface-300 hover:text-primary-400 transition-colors font-medium text-sm"
      >
        Tools
        <ChevronDown size={16} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 w-[720px] glass-card p-6 grid grid-cols-3 gap-6 z-50 animate-fade-in">
          {categories.map(cat => {
            const catTools = getToolsByCategory(cat.id)
            const CatIcon = cat.icon
            return (
              <div key={cat.id}>
                <div className="flex items-center gap-2 mb-3">
                  <CatIcon size={16} className="text-primary-400" />
                  <span className="font-[family-name:var(--font-display)] font-semibold text-surface-200 text-sm">
                    {cat.label}
                  </span>
                </div>
                <ul className="space-y-1">
                  {catTools.map(tool => (
                    <li key={tool.id}>
                      <Link
                        to={`/${tool.slug}`}
                        onClick={() => setOpen(false)}
                        className="text-sm text-surface-400 hover:text-primary-400 transition-colors block py-0.5"
                      >
                        {tool.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
