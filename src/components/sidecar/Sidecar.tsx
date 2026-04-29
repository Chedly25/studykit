import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  MessageCircle,
  Pin,
  PinOff,
  Sparkles,
  ListTodo,
  Upload,
  ClipboardCheck,
  BookOpen,
  Scale,
  TrendingUp,
  CalendarDays,
  type LucideIcon,
} from 'lucide-react'
import { useKeyboardShortcut } from '../../lib/keyboard'
import { useCommand } from '../../lib/commands'

const PIN_STORAGE_KEY = 'studieskit:sidecar-pinned'

const HIDDEN_ROUTES = ['/', '/sign-in', '/sign-up', '/welcome', '/pricing', '/privacy', '/terms']

interface QuickAction {
  id: string
  label: string
  icon: LucideIcon
  perform: () => void
}

interface SidecarContext {
  scope: string
  intro: string
  actions: QuickAction[]
}

function readPinned(): boolean {
  try {
    return localStorage.getItem(PIN_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function writePinned(value: boolean) {
  try {
    localStorage.setItem(PIN_STORAGE_KEY, value ? '1' : '0')
  } catch {
    /* localStorage unavailable */
  }
}

function isHidden(pathname: string): boolean {
  if (HIDDEN_ROUTES.includes(pathname)) return true
  if (pathname.startsWith('/read/')) return true
  if (pathname.startsWith('/admin')) return true
  return false
}

function openChat(prefill?: string, context?: Record<string, string>) {
  window.dispatchEvent(
    new CustomEvent('open-chat-panel', { detail: { prefill, context } }),
  )
}

function getContextForRoute(pathname: string, navigate: (p: string) => void): SidecarContext {
  if (pathname === '/queue') {
    return {
      scope: 'Daily Queue',
      intro: 'Stuck on an item? Ask the Oracle for a hint without leaving the flow.',
      actions: [
        {
          id: 'queue-explain',
          label: 'Explain the current item',
          icon: Sparkles,
          perform: () => openChat('Explain the current question simply.'),
        },
        {
          id: 'queue-related',
          label: 'Show related concepts',
          icon: BookOpen,
          perform: () => openChat('What related concepts should I revise alongside this one?'),
        },
        {
          id: 'queue-practice',
          label: 'Open practice exam',
          icon: ClipboardCheck,
          perform: () => navigate('/practice-exam'),
        },
      ],
    }
  }

  if (pathname === '/accueil') {
    return {
      scope: 'Atelier',
      intro: "Plan today's session, jump into a coach, or ask for a recap.",
      actions: [
        {
          id: 'home-queue',
          label: 'Start daily queue',
          icon: ListTodo,
          perform: () => navigate('/queue'),
        },
        {
          id: 'home-progress',
          label: 'Recap my progress',
          icon: TrendingUp,
          perform: () => openChat('Give me a one-paragraph recap of my progress this week.'),
        },
        {
          id: 'home-plan',
          label: 'Plan this week',
          icon: CalendarDays,
          perform: () => openChat('Help me plan this week of CRFPA prep.'),
        },
      ],
    }
  }

  if (pathname.startsWith('/legal')) {
    return {
      scope: 'Legal Oracle',
      intro: 'Quick jumps into coaches and the Bibliothèque.',
      actions: [
        {
          id: 'legal-bib',
          label: 'Open Bibliothèque',
          icon: BookOpen,
          perform: () => navigate('/legal/bibliotheque'),
        },
        {
          id: 'legal-cas',
          label: 'Cas pratique coach',
          icon: Scale,
          perform: () => navigate('/legal/cas-pratique'),
        },
        {
          id: 'legal-fiche',
          label: 'Fiche d’arrêt coach',
          icon: BookOpen,
          perform: () => navigate('/legal/fiche'),
        },
      ],
    }
  }

  if (pathname === '/sources' || pathname === '/historique') {
    return {
      scope: 'Documents',
      intro: 'Process documents and turn highlights into flashcards.',
      actions: [
        {
          id: 'src-upload',
          label: 'Upload a document',
          icon: Upload,
          perform: () => navigate('/sources'),
        },
        {
          id: 'src-summarise',
          label: 'Summarise a recent document',
          icon: Sparkles,
          perform: () => openChat('Summarise the document I most recently uploaded.'),
        },
      ],
    }
  }

  if (pathname === '/analytics' || pathname === '/exam-dna') {
    return {
      scope: 'Insights',
      intro: 'Turn the metrics into a focus prompt.',
      actions: [
        {
          id: 'an-focus',
          label: 'What should I focus on next?',
          icon: TrendingUp,
          perform: () => openChat('Based on my analytics, what should I focus on next?'),
        },
        {
          id: 'an-plan',
          label: 'Adjust my study plan',
          icon: CalendarDays,
          perform: () => navigate('/study-plan'),
        },
      ],
    }
  }

  // Default
  return {
    scope: 'Oracle',
    intro: 'Open the Oracle anytime, or jump to a key surface.',
    actions: [
      {
        id: 'def-queue',
        label: 'Open Daily Queue',
        icon: ListTodo,
        perform: () => navigate('/queue'),
      },
      {
        id: 'def-bib',
        label: 'Open Bibliothèque',
        icon: BookOpen,
        perform: () => navigate('/legal/bibliotheque'),
      },
    ],
  }
}

export function Sidecar() {
  const location = useLocation()
  const navigate = useNavigate()
  const [pinned, setPinned] = useState<boolean>(readPinned)
  const [hovered, setHovered] = useState(false)
  const hoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const ctx = useMemo(() => getContextForRoute(location.pathname, navigate), [location.pathname, navigate])

  const togglePin = useCallback(() => {
    setPinned((prev) => {
      writePinned(!prev)
      return !prev
    })
  }, [])

  // Register a command to toggle the sidecar pin from the palette
  useCommand({
    id: 'action:toggle-sidecar',
    label: pinned ? 'Unpin Sidecar' : 'Pin Sidecar',
    group: 'Actions',
    icon: pinned ? PinOff : Pin,
    keywords: ['sidecar', 'pin', 'sidebar', 'rail'],
    perform: togglePin,
  })

  useKeyboardShortcut(']', togglePin, {
    label: 'Toggle sidecar pin',
    scope: 'Global',
  })

  const expanded = pinned || hovered

  const handleMouseEnter = useCallback(() => {
    if (pinned) return
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current)
    hoverTimeout.current = setTimeout(() => setHovered(true), 180)
  }, [pinned])

  const handleMouseLeave = useCallback(() => {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current)
    if (!pinned) setHovered(false)
  }, [pinned])

  // Auto-collapse on route change (unless pinned)
  useEffect(() => {
    if (!pinned) setHovered(false)
  }, [location.pathname, pinned])

  if (isHidden(location.pathname)) return null

  return (
    <aside
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="hidden md:flex fixed top-14 right-0 bottom-0 z-30 flex-col bg-[var(--bg-card)] border-l border-[var(--border-card)] transition-[width] duration-200 ease-out"
      style={{ width: expanded ? '340px' : '56px' }}
      aria-label="Contextual sidecar"
    >
      {expanded ? (
        <SidecarPanel
          ctx={ctx}
          pinned={pinned}
          onTogglePin={togglePin}
        />
      ) : (
        <SidecarRail
          ctx={ctx}
          onExpand={() => setHovered(true)}
          onAskAi={() => openChat()}
        />
      )}
    </aside>
  )
}

interface SidecarRailProps {
  ctx: SidecarContext
  onExpand: () => void
  onAskAi: () => void
}

function SidecarRail({ ctx, onExpand, onAskAi }: SidecarRailProps) {
  return (
    <div className="flex flex-col items-center pt-3 pb-4 gap-2 h-full">
      <button
        onClick={onExpand}
        className="btn-action w-9 h-9 flex items-center justify-center rounded-[var(--radius-md)] text-[var(--text-muted)] hover:text-[var(--accent-text)] hover:bg-[var(--accent-bg)]"
        aria-label="Expand sidecar"
        title={ctx.scope}
      >
        <Sparkles size={16} />
      </button>
      {ctx.actions.slice(0, 3).map((a) => {
        const Icon = a.icon
        return (
          <button
            key={a.id}
            onClick={a.perform}
            className="btn-action w-9 h-9 flex items-center justify-center rounded-[var(--radius-md)] text-[var(--text-muted)] hover:text-[var(--accent-text)] hover:bg-[var(--accent-bg)]"
            aria-label={a.label}
            title={a.label}
          >
            <Icon size={16} />
          </button>
        )
      })}
      <div className="flex-1" />
      <button
        onClick={onAskAi}
        className="btn-action w-9 h-9 flex items-center justify-center rounded-[var(--radius-md)] text-[var(--accent-text)] bg-[var(--accent-bg)] hover:opacity-80"
        aria-label="Ask AI"
        title="Ask AI"
      >
        <MessageCircle size={16} />
      </button>
    </div>
  )
}

interface SidecarPanelProps {
  ctx: SidecarContext
  pinned: boolean
  onTogglePin: () => void
}

function SidecarPanel({ ctx, pinned, onTogglePin }: SidecarPanelProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-card)]">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles size={14} className="text-[var(--accent-text)] shrink-0" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] truncate">
            {ctx.scope}
          </h2>
        </div>
        <button
          onClick={onTogglePin}
          className="btn-action p-1.5 text-[var(--text-muted)] hover:text-[var(--accent-text)] rounded-md"
          aria-label={pinned ? 'Unpin sidecar' : 'Pin sidecar'}
          title={pinned ? 'Unpin' : 'Pin'}
        >
          {pinned ? <PinOff size={14} /> : <Pin size={14} />}
        </button>
      </div>

      <div className="px-4 py-4 space-y-4 flex-1 overflow-y-auto">
        <p className="text-sm text-[var(--text-muted)] leading-relaxed">{ctx.intro}</p>
        <div className="space-y-1.5">
          {ctx.actions.map((a) => {
            const Icon = a.icon
            return (
              <button
                key={a.id}
                onClick={a.perform}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-[var(--radius-md)] text-sm text-[var(--text-body)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-heading)] transition-colors text-left"
              >
                <Icon size={15} className="text-[var(--text-muted)] shrink-0" />
                <span className="flex-1">{a.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="border-t border-[var(--border-card)] p-3">
        <button
          onClick={() => openChat()}
          className="btn-primary w-full justify-center inline-flex items-center gap-2"
        >
          <MessageCircle size={15} />
          Ask the Oracle
        </button>
      </div>
    </div>
  )
}
