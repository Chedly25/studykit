/**
 * Mobile bottom navigation — 5 direct nav tabs.
 * Hidden on desktop (md+).
 */
import { Link, useLocation } from 'react-router-dom'
import { Zap, BookOpen, FolderOpen, BarChart3, ClipboardCheck } from 'lucide-react'

const NAV_ITEMS = [
  { to: '/queue', icon: Zap, label: 'Today' },
  { to: '/practice-exam', icon: ClipboardCheck, label: 'Exams' },
  { to: '/dashboard', icon: BookOpen, label: 'Study' },
  { to: '/sources', icon: FolderOpen, label: 'Library' },
  { to: '/analytics', icon: BarChart3, label: 'Progress' },
] as const

export function BottomNav() {
  const { pathname } = useLocation()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-[var(--bg-card)] border-t border-[var(--border-card)]">
      <div className="flex items-stretch h-16 pb-[env(safe-area-inset-bottom)]">
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => {
          const active = pathname === to || (to === '/dashboard' && pathname === '/')
          return (
            <Link
              key={to}
              to={to}
              aria-current={active ? 'page' : undefined}
              className={`flex-1 flex flex-col items-center justify-center gap-1 transition-colors ${
                active
                  ? 'text-[var(--accent-text)]'
                  : 'text-[var(--text-muted)]'
              }`}
            >
              <Icon size={20} strokeWidth={active ? 2.5 : 2} />
              <span className={`text-[10px] font-medium ${active ? 'font-semibold' : ''}`}>{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
