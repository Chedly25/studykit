import { useState, useRef, useCallback, useEffect } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { SignedIn, SignedOut, UserButton, useUser } from '@clerk/clerk-react'
import {
  Menu, X, BarChart3, MessageCircle,
  BookOpen, Shield, Zap, FolderOpen,
  PanelLeftClose, PanelLeftOpen, Search, Settings,
} from 'lucide-react'
import { ThemeToggle } from './ThemeToggle'
import { LanguageToggle } from './LanguageToggle'
import { ExamProfileSelector } from './knowledge/ExamProfileSelector'
import { ChatPanel } from './chat/ChatPanel'
import { SearchModal } from './SearchModal'
import { ProBadge } from './subscription/ProBadge'
import { NotificationBell } from './NotificationBell'
import { useSubscription } from '../hooks/useSubscription'
import { useExamProfile } from '../hooks/useExamProfile'
import { useProfileMode } from '../hooks/useProfileMode'
import { BackgroundJobsIndicator } from './BackgroundJobsIndicator'
import { BottomNav } from './BottomNav'
import { SyncIndicator } from './SyncIndicator'
import { ErrorBoundary } from './ErrorBoundary'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { useJobCompletionToasts } from '../hooks/useJobCompletionToasts'
import { useWeeklyDigest } from '../hooks/useWeeklyDigest'
import { identify } from '../lib/analytics'

export function Layout() {
  const [chatOpen, setChatOpen] = useState(false)
  const [chatPrefill, setChatPrefill] = useState<string | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false) // mobile drawer
  const [sidebarPinned, setSidebarPinned] = useState(false) // desktop pin
  const [sidebarHovered, setSidebarHovered] = useState(false) // desktop hover
  const hoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { user } = useUser()
  const { isPro } = useSubscription()
  const { activeProfile } = useExamProfile()
  const { isResearch } = useProfileMode()
  const { t } = useTranslation()
  const location = useLocation()
  const isOnline = useOnlineStatus()
  const isChatPage = location.pathname === '/session' || location.pathname.startsWith('/read/')

  // Pipeline completion toasts + weekly email digest
  useJobCompletionToasts()
  useWeeklyDigest()

  // Identify user for analytics on auth
  useEffect(() => {
    if (user?.id) {
      identify(user.id, { plan: isPro ? 'pro' : 'free', profileCount: activeProfile ? 1 : 0 })
    }
  }, [user?.id, isPro, activeProfile])

  const sidebarExpanded = sidebarPinned || sidebarHovered
  const collapsed = !sidebarExpanded

  const closeSidebar = () => setSidebarOpen(false)

  // Cmd+K search shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(prev => !prev)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  // Open chat panel from anywhere via custom event (with optional prefill)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail
      setChatOpen(true)
      setChatPrefill(detail?.prefill ?? null)
    }
    window.addEventListener('open-chat-panel', handler)
    return () => window.removeEventListener('open-chat-panel', handler)
  }, [])

  // Auto-collapse on route change
  useEffect(() => {
    setSidebarHovered(false)
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current)
  }, [location.pathname])

  // Auto-collapse when chat opens
  useEffect(() => {
    if (chatOpen) {
      setSidebarPinned(false)
      setSidebarHovered(false)
    }
  }, [chatOpen])

  const handleMouseEnter = useCallback(() => {
    if (sidebarPinned) return
    hoverTimeout.current = setTimeout(() => setSidebarHovered(true), 200)
  }, [sidebarPinned])

  const handleMouseLeave = useCallback(() => {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current)
    if (!sidebarPinned) setSidebarHovered(false)
  }, [sidebarPinned])

  return (
    <div className="min-h-screen flex flex-col">
      {/* ─── Header ─────────────────────────────────────────── */}
      <header className="border-b border-[var(--border-header)] backdrop-blur-md bg-[var(--bg-header)] sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          {/* Left: menu toggle (mobile only) + logo */}
          <div className="flex items-center gap-2">
            <SignedIn>
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="md:hidden p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--accent-text)] hover:bg-[var(--bg-input)] transition-colors"
                aria-label="Toggle navigation"
              >
                {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </SignedIn>
          <Link to="/" className="flex items-center gap-2 group">
            <img src="/favicon-48x48.png" alt="StudiesKit" className="w-7 h-7 rounded-lg" />
            <span className="font-[family-name:var(--font-display)] font-bold text-lg text-[var(--text-heading)] group-hover:text-[var(--accent-text)] transition-colors hidden sm:inline">
              StudiesKit
            </span>
          </Link>
          </div>

          {/* Right */}
          <div className="flex items-center gap-2">
            <SignedIn>
              <ExamProfileSelector />
              <button
                onClick={() => setSearchOpen(true)}
                className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--accent-text)] hover:bg-[var(--bg-input)] transition-colors"
                title={`${t('search.title', 'Search')} (⌘K)`}
              >
                <Search size={18} />
              </button>
              <BackgroundJobsIndicator />
              <SyncIndicator />
              <NotificationBell examProfileId={activeProfile?.id} />
              <button
                onClick={() => setChatOpen(!chatOpen)}
                className={`p-2 rounded-lg transition-colors ${
                  chatOpen
                    ? 'bg-[var(--accent-bg)] text-[var(--accent-text)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--accent-text)] hover:bg-[var(--bg-input)]'
                }`}
                title={t('nav.aiChat')}
              >
                <MessageCircle size={18} />
              </button>
            </SignedIn>
            <LanguageToggle />
            <ThemeToggle />
            <SignedIn>
              {isPro ? (
                <ProBadge />
              ) : (
                <Link
                  to="/pricing"
                  className="btn-secondary text-xs px-3 py-1 hidden sm:block"
                >
                  {t('common.upgrade')}
                </Link>
              )}
              <UserButton afterSignOutUrl="/" />
            </SignedIn>
            <SignedOut>
              <Link to="/sign-in" className="btn-primary text-sm px-4 py-1.5">
                {t('common.signIn')}
              </Link>
            </SignedOut>
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        {/* ─── Desktop Sidebar Rail ───────────────────────────── */}
        <SignedIn>
          <aside
            className={`hidden md:flex flex-col flex-shrink-0 bg-[var(--bg-card)] border-r border-[var(--border-card)] h-[calc(100vh-3.5rem)] sticky top-14 overflow-y-auto overflow-x-hidden transition-[width] duration-200 ease-in-out z-30 ${
              sidebarExpanded ? 'w-60' : 'w-[60px]'
            }`}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            {/* Pin/unpin button */}
            <div className={`flex items-center h-10 px-2 ${sidebarExpanded ? 'justify-end' : 'justify-center'}`}>
              <button
                onClick={() => setSidebarPinned(!sidebarPinned)}
                className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--accent-text)] hover:bg-[var(--bg-input)] transition-colors"
                title={sidebarPinned ? 'Collapse sidebar' : 'Pin sidebar'}
              >
                {sidebarPinned ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
              </button>
            </div>

            {/* Nav links — 4 focused items */}
            <nav className="flex-1 px-2 py-2 space-y-0.5">
              <SidebarLink to="/queue" icon={Zap} label={isResearch ? 'Tasks' : 'Today'} active={location.pathname === '/queue'} collapsed={collapsed} />
              <SidebarLink to="/dashboard" icon={BookOpen} label={isResearch ? 'Research' : 'Study'} active={location.pathname === '/dashboard' || location.pathname === '/'} collapsed={collapsed} />
              <SidebarLink to="/sources" icon={FolderOpen} label={isResearch ? 'Literature' : 'Library'} active={location.pathname === '/sources'} collapsed={collapsed} />
              <SidebarLink to="/analytics" icon={BarChart3} label="Progress" active={location.pathname === '/analytics'} collapsed={collapsed} />
            </nav>

            {/* Settings at bottom */}
            <div className={`px-2 py-2 border-t border-[var(--border-card)] ${collapsed ? 'flex justify-center' : ''}`}>
              <SidebarLink to="/settings" icon={Settings} label="Settings" active={location.pathname === '/settings'} collapsed={collapsed} />
            </div>

            {/* Sidebar footer — admin only */}
            {(user?.publicMetadata as any)?.role === 'admin' && (
              <div className={`px-2 py-3 border-t border-[var(--border-card)] ${collapsed ? 'flex justify-center' : ''}`}>
                <Link
                  to="/admin"
                  className="flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--accent-text)] transition-colors"
                  title={collapsed ? 'Admin' : undefined}
                >
                  <Shield size={collapsed ? 20 : 14} />
                  {!collapsed && 'Admin'}
                </Link>
              </div>
            )}
          </aside>
        </SignedIn>

        {/* ─── Mobile Sidebar Overlay ───────────────────────────── */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-50 flex md:hidden">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/40 backdrop-blur-sm"
              onClick={closeSidebar}
            />

            {/* Drawer */}
            <aside className="relative w-72 max-w-[80vw] bg-[var(--bg-card)] border-r border-[var(--border-card)] flex flex-col h-full overflow-y-auto animate-fade-in">
              {/* Sidebar header */}
              <div className="flex items-center justify-between px-5 h-14 border-b border-[var(--border-card)]">
                <Link to="/" onClick={closeSidebar} className="flex items-center gap-2">
                  <img src="/favicon-48x48.png" alt="" className="w-7 h-7 rounded-lg" />
                  <span className="font-[family-name:var(--font-display)] font-bold text-lg text-[var(--text-heading)]">
                    StudiesKit
                  </span>
                </Link>
                <button
                  onClick={closeSidebar}
                  className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--accent-text)] hover:bg-[var(--bg-input)] transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Nav links — 4 focused items */}
              <nav className="flex-1 px-3 py-4 space-y-1">
                <SidebarLink to="/queue" icon={Zap} label={isResearch ? 'Tasks' : 'Today'} active={location.pathname === '/queue'} onClick={closeSidebar} collapsed={false} />
                <SidebarLink to="/dashboard" icon={BookOpen} label={isResearch ? 'Research' : 'Study'} active={location.pathname === '/dashboard' || location.pathname === '/'} onClick={closeSidebar} collapsed={false} />
                <SidebarLink to="/sources" icon={FolderOpen} label={isResearch ? 'Literature' : 'Library'} active={location.pathname === '/sources'} onClick={closeSidebar} collapsed={false} />
                <SidebarLink to="/analytics" icon={BarChart3} label="Progress" active={location.pathname === '/analytics'} onClick={closeSidebar} collapsed={false} />

                <div className="pt-3 mt-3 border-t border-[var(--border-card)]">
                  <SidebarLink to="/settings" icon={Settings} label="Settings" active={location.pathname === '/settings'} onClick={closeSidebar} collapsed={false} />
                </div>
              </nav>

              {/* Sidebar footer — admin only */}
              {(user?.publicMetadata as any)?.role === 'admin' && (
                <div className="px-4 py-4 border-t border-[var(--border-card)]">
                  <Link
                    to="/admin"
                    onClick={closeSidebar}
                    className="flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--accent-text)] transition-colors"
                  >
                    <Shield size={14} /> Admin
                  </Link>
                </div>
              )}
            </aside>
          </div>
        )}

        {/* ─── Main content ───────────────────────────────────── */}
        <main className={isChatPage ? 'flex-1 w-full min-w-0 pb-16 md:pb-0' : 'flex-1 max-w-7xl mx-auto px-4 sm:px-6 py-8 w-full min-w-0 pb-16 md:pb-0'}>
          {!isOnline && (
            <div className="mb-4 px-4 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm text-amber-600 text-center">
              You're offline. Some features may not work.
            </div>
          )}
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>

      {!isChatPage && (
        <footer className="border-t border-[var(--border-header)] py-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-[var(--text-muted)] text-sm">
                <img src="/favicon-32x32.png" alt="" className="w-4 h-4" />
                <span>{t('footer.tagline')}</span>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <Link to="/all-tools" className="text-[var(--text-muted)] hover:text-[var(--accent-text)] transition-colors">
                  {t('footer.freeTools')}
                </Link>
                <Link to="/pricing" className="text-[var(--text-muted)] hover:text-[var(--accent-text)] transition-colors">
                  {t('footer.pricing')}
                </Link>
                <span className="text-[var(--text-faint)]">{t('footer.dataLocal')}</span>
              </div>
            </div>
          </div>
        </footer>
      )}

      {/* Mobile Bottom Nav */}
      <SignedIn>
        <BottomNav />
      </SignedIn>

      {/* Chat Panel */}
      <ChatPanel open={chatOpen} onClose={() => setChatOpen(false)} prefill={chatPrefill} onPrefillConsumed={() => setChatPrefill(null)} />

      {/* Search Modal */}
      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  )
}

// ─── Sidebar sub-components ─────────────────────────────────────

function SidebarSection({ label, children, collapsed }: { label: string; children: React.ReactNode; collapsed: boolean }) {
  if (collapsed) {
    return (
      <div className="space-y-0.5">
        {children}
      </div>
    )
  }
  return (
    <div>
      <span className="px-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
        {label}
      </span>
      <div className="mt-1.5 space-y-0.5">
        {children}
      </div>
    </div>
  )
}

function SidebarLink({
  to, icon: Icon, label, active, onClick, pro, collapsed,
}: {
  to: string
  icon: React.ComponentType<{ size?: number }>
  label: string
  active: boolean
  onClick?: () => void
  pro?: boolean
  collapsed: boolean
}) {
  if (collapsed) {
    return (
      <Link
        to={to}
        onClick={onClick}
        className={`flex items-center justify-center w-10 h-10 mx-auto rounded-lg transition-colors ${
          active
            ? 'bg-[var(--accent-bg)] text-[var(--accent-text)]'
            : 'text-[var(--text-body)] hover:bg-[var(--bg-input)] hover:text-[var(--accent-text)]'
        }`}
        title={label}
      >
        <Icon size={20} />
      </Link>
    )
  }

  return (
    <Link
      to={to}
      onClick={onClick}
      className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors ${
        active
          ? 'bg-[var(--accent-bg)] text-[var(--accent-text)]'
          : 'text-[var(--text-body)] hover:bg-[var(--bg-input)] hover:text-[var(--accent-text)]'
      }`}
    >
      <Icon size={16} />
      <span className="flex-1 truncate">{label}</span>
      {pro && <ProBadge />}
    </Link>
  )
}
