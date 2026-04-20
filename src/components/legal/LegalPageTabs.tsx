/**
 * Shared tab bar displayed at the top of the /legal* pages.
 * Currently active: Chat, Syllogisme. Disabled placeholders telegraph future features.
 */
import { NavLink } from 'react-router-dom'
import { MessageSquare, PenSquare, FileText, ListTree, BookMarked, FileCheck } from 'lucide-react'

interface TabDef {
  to?: string
  label: string
  icon: typeof MessageSquare
  disabled?: boolean
  end?: boolean
}

const TABS: TabDef[] = [
  { to: '/legal', label: 'Chat', icon: MessageSquare, end: true },
  { to: '/legal/syllogisme', label: 'Syllogisme', icon: PenSquare },
  { to: '/legal/plan', label: 'Plan détaillé', icon: ListTree },
  { to: '/legal/fiche', label: 'Fiche d\'arrêt', icon: FileText },
  { to: '/legal/commentaire', label: 'Commentaire', icon: BookMarked },
  { to: '/legal/synthese', label: 'Synthèse', icon: FileCheck },
]

export function LegalPageTabs() {
  return (
    <div className="flex items-center gap-1 px-4 py-2 border-b border-[var(--border-card)] bg-[var(--bg-main)] overflow-x-auto">
      {TABS.map((tab, i) => {
        const Icon = tab.icon
        if (tab.disabled) {
          return (
            <span
              key={i}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-[var(--text-muted)] opacity-50 cursor-not-allowed shrink-0"
              title="Bientôt disponible"
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--bg-hover)] text-[var(--text-muted)]">
                Bientôt
              </span>
            </span>
          )
        }
        return (
          <NavLink
            key={i}
            to={tab.to!}
            end={tab.end}
            className={({ isActive }) =>
              `flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm shrink-0 transition-colors ${
                isActive
                  ? 'bg-[var(--accent-bg)] text-[var(--accent-text)] font-medium'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
              }`
            }
          >
            <Icon className="w-4 h-4" />
            <span>{tab.label}</span>
          </NavLink>
        )
      })}
    </div>
  )
}
