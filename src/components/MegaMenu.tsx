import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, LayoutDashboard, GraduationCap, BarChart3, Focus, MessageCircle, Brain, ClipboardCheck } from 'lucide-react'
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
        className="flex items-center gap-1 text-[var(--text-body)] hover:text-[var(--accent-text)] transition-colors font-medium text-sm"
      >
        Tools
        <ChevronDown size={16} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 w-[600px] glass-card p-5 z-50 animate-fade-in">
          {/* AI-Powered Section */}
          <div className="mb-4 pb-4 border-b border-[var(--border-card)]">
            <span className="font-[family-name:var(--font-display)] font-semibold text-[var(--accent-text)] text-xs uppercase tracking-wider mb-2 block">
              Command Center
            </span>
            <div className="grid grid-cols-2 gap-1">
              {[
                { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
                { to: '/exam-profile', icon: GraduationCap, label: 'Exam Profile' },
                { to: '/analytics', icon: BarChart3, label: 'Analytics' },
                { to: '/focus', icon: Focus, label: 'Focus Mode' },
                { to: '/chat', icon: MessageCircle, label: 'AI Chat' },
                { to: '/socratic', icon: Brain, label: 'Socratic Mode' },
                { to: '/practice-exam', icon: ClipboardCheck, label: 'Practice Exam' },
              ].map(item => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-[var(--text-muted)] hover:text-[var(--accent-text)] hover:bg-[var(--accent-bg)] transition-colors"
                >
                  <item.icon size={14} />
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Tools Grid */}
          <div className="grid grid-cols-2 gap-5">
            {categories.map(cat => {
              const catTools = getToolsByCategory(cat.id)
              const CatIcon = cat.icon
              return (
                <div key={cat.id}>
                  <div className="flex items-center gap-2 mb-3">
                    <CatIcon size={16} className="text-[var(--accent-text)]" />
                    <span className="font-[family-name:var(--font-display)] font-semibold text-[var(--text-body)] text-sm">
                      {cat.label}
                    </span>
                  </div>
                  <ul className="space-y-1">
                    {catTools.map(tool => (
                      <li key={tool.id}>
                        <Link
                          to={`/${tool.slug}`}
                          onClick={() => setOpen(false)}
                          className="text-sm text-[var(--text-muted)] hover:text-[var(--accent-text)] transition-colors block py-0.5"
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
        </div>
      )}
    </div>
  )
}
