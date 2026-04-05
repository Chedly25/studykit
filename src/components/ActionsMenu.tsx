/**
 * Actions menu — categorized feature discovery menu.
 * Triggered from header (desktop dropdown) or bottom nav (mobile sheet).
 */
import { useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Zap, ClipboardCheck, Timer, CalendarDays, UserCircle,
  FolderOpen, Dumbbell, BarChart3, FileText, X,
} from 'lucide-react'
import { useSubscription } from '../hooks/useSubscription'

interface ActionsMenuProps {
  open: boolean
  onClose: () => void
  mode?: 'dropdown' | 'sheet'
}

interface ActionItem {
  icon: React.ReactNode
  label: string
  link: string
  pro?: boolean
}

interface ActionCategory {
  title: string
  items: ActionItem[]
}

export function ActionsMenu({ open, onClose, mode = 'dropdown' }: ActionsMenuProps) {
  const { t } = useTranslation()
  const { isPro } = useSubscription()
  const navigate = useNavigate()
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click (dropdown mode)
  useEffect(() => {
    if (!open || mode !== 'dropdown') return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open, onClose, mode])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  const categories: ActionCategory[] = [
    {
      title: t('nav.actionsStudy'),
      items: [
        { icon: <Zap className="w-4 h-4" />, label: t('nav.todaySession'), link: '/queue' },
        { icon: <ClipboardCheck className="w-4 h-4" />, label: t('nav.practiceExam'), link: '/practice-exam', pro: true },
        { icon: <Timer className="w-4 h-4" />, label: t('nav.focusTimer'), link: '/focus' },
      ],
    },
    {
      title: t('nav.actionsPlan'),
      items: [
        { icon: <CalendarDays className="w-4 h-4" />, label: t('nav.studyPlan'), link: '/study-plan' },
        { icon: <UserCircle className="w-4 h-4" />, label: t('nav.examProfile'), link: '/exam-profile' },
      ],
    },
    {
      title: t('nav.actionsMaterials'),
      items: [
        { icon: <FolderOpen className="w-4 h-4" />, label: t('nav.sources'), link: '/sources' },
        { icon: <Dumbbell className="w-4 h-4" />, label: t('nav.exercises'), link: '/exercises' },
      ],
    },
    {
      title: t('nav.actionsInsights'),
      items: [
        { icon: <BarChart3 className="w-4 h-4" />, label: t('nav.analytics'), link: '/analytics' },
        { icon: <FileText className="w-4 h-4" />, label: t('nav.report'), link: '/report' },
      ],
    },
  ]

  const handleClick = (link: string) => {
    navigate(link)
    onClose()
  }

  const content = (
    <div className="space-y-4">
      {categories.map(cat => (
        <div key={cat.title}>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-faint)] mb-1.5 px-1">
            {cat.title}
          </p>
          <div className="space-y-0.5">
            {cat.items.map(item => (
              <button
                key={item.link}
                onClick={() => handleClick(item.link)}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-[var(--text-body)] hover:bg-[var(--bg-input)] transition-colors text-left"
              >
                <span className="text-[var(--text-muted)]">{item.icon}</span>
                <span className="flex-1">{item.label}</span>
                {item.pro && !isPro && (
                  <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--accent-text)] bg-[var(--accent-bg)] px-1.5 py-0.5 rounded">
                    PRO
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )

  if (mode === 'sheet') {
    return (
      <>
        <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose} />
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-[var(--bg-card)] rounded-t-2xl border-t border-[var(--border-card)] pb-[env(safe-area-inset-bottom)] animate-slide-up">
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <span className="text-sm font-semibold text-[var(--text-heading)]">
              {t('nav.actions')}
            </span>
            <button onClick={onClose} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-input)]">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="px-3 pb-4 max-h-[60vh] overflow-y-auto">
            {content}
          </div>
        </div>
      </>
    )
  }

  // Dropdown mode
  return (
    <div ref={ref} className="absolute top-full right-0 mt-2 w-64 glass-card p-3 shadow-lg animate-scale-in z-50">
      {content}
    </div>
  )
}
