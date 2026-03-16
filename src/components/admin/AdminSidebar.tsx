import { NavLink } from 'react-router-dom'
import { BarChart3, DollarSign, Users, Activity, ArrowLeft } from 'lucide-react'

const navItems = [
  { to: '/admin', label: 'Overview', icon: BarChart3, end: true },
  { to: '/admin/revenue', label: 'Revenue', icon: DollarSign, end: false },
  { to: '/admin/users', label: 'Users', icon: Users, end: false },
  { to: '/admin/usage', label: 'Usage', icon: Activity, end: false },
]

export function AdminSidebar() {
  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-56 border-r border-[var(--border-card)] bg-[var(--bg-card)] min-h-screen">
        <div className="p-4 border-b border-[var(--border-card)]">
          <h2 className="font-[family-name:var(--font-display)] font-bold text-[var(--text-heading)] text-lg">
            Admin
          </h2>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-[var(--accent-bg)] text-[var(--accent-text)]'
                    : 'text-[var(--text-body)] hover:text-[var(--text-heading)] hover:bg-[var(--bg-input)]'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-[var(--border-card)]">
          <NavLink
            to="/"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text-heading)] hover:bg-[var(--bg-input)] transition-colors"
          >
            <ArrowLeft size={18} />
            Back to app
          </NavLink>
        </div>
      </aside>

      {/* Mobile bottom tabs */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex border-t border-[var(--border-card)] bg-[var(--bg-card)] backdrop-blur-md">
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center gap-1 py-2 text-xs font-medium transition-colors ${
                isActive
                  ? 'text-[var(--accent-text)]'
                  : 'text-[var(--text-muted)]'
              }`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
        <NavLink
          to="/"
          className="flex-1 flex flex-col items-center gap-1 py-2 text-xs font-medium text-[var(--text-muted)]"
        >
          <ArrowLeft size={18} />
          App
        </NavLink>
      </nav>
    </>
  )
}
