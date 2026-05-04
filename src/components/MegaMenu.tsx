import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronDown, LayoutDashboard, GraduationCap, BarChart3, Focus, ClipboardCheck, FileText, Calendar, PenTool, Users, StickyNote } from 'lucide-react'
import { useKeyboardShortcut } from '../lib/keyboard'
import { ProBadge } from './subscription/ProBadge'
import { useProfileMode } from '../hooks/useProfileMode'

export function MegaMenu() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { t } = useTranslation()
  const { isResearch } = useProfileMode()

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => {
      document.removeEventListener('mousedown', handleClick)
    }
  }, [])

  useKeyboardShortcut('escape', () => setOpen(false), {
    label: 'Close mega menu',
    scope: 'Global',
    enabled: open,
  })

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-[var(--text-body)] hover:text-[var(--accent-text)] transition-colors font-medium text-sm"
      >
        {t('nav.features')}
        <ChevronDown size={16} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 w-[400px] glass-card p-5 z-50 animate-fade-in">
          <span className="font-[family-name:var(--font-display)] font-semibold text-[var(--accent-text)] text-xs uppercase tracking-wider mb-2 block">
            Command Center
          </span>
          <div className="grid grid-cols-2 gap-1">
            {[
              { to: '/dashboard', icon: LayoutDashboard, label: t('nav.dashboard'), pro: false },
              { to: '/exam-profile', icon: GraduationCap, label: t('profile.studyProfile'), pro: false },
              { to: '/analytics', icon: BarChart3, label: t('nav.analytics'), pro: false },
              ...(isResearch ? [
                { to: '/writing', icon: PenTool, label: t('research.writingSession'), pro: true },
                { to: '/notes', icon: StickyNote, label: t('research.notes'), pro: true },
                { to: '/meetings', icon: Users, label: t('research.meetings'), pro: true },
              ] : [
                { to: '/focus', icon: Focus, label: t('focus.title'), pro: false },
              ]),
              ...(!isResearch ? [
                { to: '/practice-exam', icon: ClipboardCheck, label: t('ai.practiceSession'), pro: true },
              ] : []),
              { to: '/study-plan', icon: Calendar, label: t('ai.studyPlan'), pro: true },
              { to: '/sources', icon: FileText, label: isResearch ? t('research.literature') : t('sources.title'), pro: true },
            ].map(item => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-[var(--text-muted)] hover:text-[var(--accent-text)] hover:bg-[var(--accent-bg)] transition-colors"
              >
                <item.icon size={14} />
                {item.label}
                {item.pro && <ProBadge />}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
