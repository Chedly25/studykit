import { useState, useRef, useCallback, useEffect, lazy, Suspense } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { SignedIn, SignedOut, UserButton, useUser } from '@clerk/clerk-react'
import {
  Menu, X, BarChart3, MessageCircle,
  BookOpen, Shield, Zap, FolderOpen,
  PanelLeftClose, PanelLeftOpen, Search, Settings,
  ClipboardCheck, CalendarDays, Scale,
  Home, PenSquare, History,
} from 'lucide-react'
import { ThemeToggle } from './ThemeToggle'
import { ExamProfileSelector } from './knowledge/ExamProfileSelector'
const ChatPanel = lazy(() => import('./chat/ChatPanel').then(m => ({ default: m.ChatPanel })))
const SearchModal = lazy(() => import('./SearchModal').then(m => ({ default: m.SearchModal })))
import { KeyboardShortcutsModal } from './KeyboardShortcutsModal'
import CookieConsent from './CookieConsent'
import { OnboardingTour } from './OnboardingTour'
import { ProBadge } from './subscription/ProBadge'
import { useSubscription } from '../hooks/useSubscription'
import { useExamProfile } from '../hooks/useExamProfile'
import { useProfileMode } from '../hooks/useProfileMode'
import { useProfileVertical } from '../hooks/useProfileVertical'
import { BackgroundJobsIndicator } from './BackgroundJobsIndicator'
import { BottomNav } from './BottomNav'
import { ErrorBoundary } from './ErrorBoundary'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { StreakAtRiskBanner } from './StreakAtRiskBanner'
import { useKnowledgeGraph } from '../hooks/useKnowledgeGraph'
import { ContextualAssistant } from './ContextualAssistant'
import { UpdatePrompt } from './UpdatePrompt'
import { InstallPrompt } from './InstallPrompt'
// ActionsMenu removed — features now in sidebar directly
import { useJobCompletionToasts } from '../hooks/useJobCompletionToasts'
import { useWeeklyDigest } from '../hooks/useWeeklyDigest'
import { identify } from '../lib/analytics'

export function Layout() {
  const [chatOpen, setChatOpen] = useState(false)
  const [chatPrefill, setChatPrefill] = useState<string | null>(null)
  const [chatSubjectId, setChatSubjectId] = useState<string | null>(null)
  const [chatContext, setChatContext] = useState<Record<string, string> | null>(null)
  const [chatSubjectName, setChatSubjectName] = useState<string | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false) // mobile drawer
  const [sidebarPinned, setSidebarPinned] = useState(false) // desktop pin
  const [sidebarHovered, setSidebarHovered] = useState(false) // desktop hover
  const hoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { user } = useUser()
  const { isPro } = useSubscription()
  const { activeProfile } = useExamProfile()
  const { isResearch } = useProfileMode()
  const { isCRFPA } = useProfileVertical()
  const { t } = useTranslation()
  const location = useLocation()
  const isOnline = useOnlineStatus()
  const isChatPage =
    location.pathname === '/session' ||
    location.pathname.startsWith('/read/') ||
    location.pathname.startsWith('/legal') ||
    location.pathname === '/accueil' ||
    location.pathname === '/historique'

  // Streak risk detection for banner
  const { streak, dailyLogs } = useKnowledgeGraph(activeProfile?.id)
  const hasStudiedToday = dailyLogs.some(l => l.date === new Date().toISOString().slice(0, 10))

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

  const [shortcutsOpen, setShortcutsOpen] = useState(false)

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Cmd+K — toggle search
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(prev => !prev)
        return
      }

      // Escape — close overlays in priority order
      if (e.key === 'Escape') {
        if (shortcutsOpen) { setShortcutsOpen(false); return }
        if (searchOpen) { setSearchOpen(false); return }
        if (chatOpen) { setChatOpen(false); return }
        return
      }

      // ? — show keyboard shortcuts (only when not typing in an input)
      if (e.key === '?' && !['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault()
        setShortcutsOpen(prev => !prev)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [searchOpen, chatOpen, shortcutsOpen])

  // Open chat panel from anywhere via custom event (with optional prefill)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail
      setChatOpen(true)
      setChatPrefill(detail?.prefill ?? null)
      setChatSubjectId(detail?.subjectId ?? null)
      setChatSubjectName(detail?.subjectName ?? null)
      setChatContext(detail?.context ?? null)
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
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2 focus:bg-[var(--accent-text)] focus:text-white focus:px-4 focus:py-2 focus:rounded-lg focus:text-sm">
        Skip to content
      </a>

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
          <div className="flex items-center gap-1.5">
            <SignedIn>
              <ExamProfileSelector />
              <button
                onClick={() => setSearchOpen(true)}
                className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--accent-text)] hover:bg-[var(--bg-input)] transition-colors"
                title={`${t('search.title')} (⌘K)`}
                aria-label="Search"
              >
                <Search size={18} />
              </button>
              <BackgroundJobsIndicator />
              <button
                onClick={() => setChatOpen(!chatOpen)}
                className={`p-2 rounded-lg transition-colors ${
                  chatOpen
                    ? 'bg-[var(--accent-bg)] text-[var(--accent-text)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--accent-text)] hover:bg-[var(--bg-input)]'
                }`}
                title={t('nav.aiChat')}
                aria-label="AI Chat"
              >
                <MessageCircle size={18} />
              </button>
            </SignedIn>
            <ThemeToggle />
            <SignedIn>
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
                aria-label={sidebarPinned ? 'Collapse sidebar' : 'Pin sidebar'}
              >
                {sidebarPinned ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
              </button>
            </div>

            {/* Nav links — branched per vertical */}
            <nav className="flex-1 px-2 py-2 space-y-0.5">
              {isCRFPA ? (
                <>
                  <SidebarLink to="/accueil" icon={Home} label="Accueil" active={location.pathname === '/accueil' || location.pathname === '/'} collapsed={collapsed} />
                  <SidebarLink to="/legal/syllogisme" icon={PenSquare} label="Entraînement" active={location.pathname.startsWith('/legal/syllogisme') || location.pathname.startsWith('/legal/plan') || location.pathname.startsWith('/legal/fiche') || location.pathname.startsWith('/legal/commentaire') || location.pathname.startsWith('/legal/cas-pratique') || location.pathname.startsWith('/legal/synthese') || location.pathname.startsWith('/legal/grand-oral') || location.pathname.startsWith('/legal/fiches')} collapsed={collapsed} />
                  <SidebarLink to="/legal" icon={Scale} label="Oracle" active={location.pathname === '/legal'} collapsed={collapsed} />
                  <SidebarLink to="/historique" icon={History} label="Historique" active={location.pathname === '/historique'} collapsed={collapsed} />
                </>
              ) : (
                <>
                  <SidebarLink to="/queue" icon={Zap} label={isResearch ? 'Tasks' : 'Today'} active={location.pathname === '/queue'} collapsed={collapsed} dataTour="queue" />
                  <SidebarLink to="/practice-exam" icon={ClipboardCheck} label="Exams" active={location.pathname === '/practice-exam'} collapsed={collapsed} dataTour="exams" />
                  <SidebarLink to="/dashboard" icon={BookOpen} label={isResearch ? 'Research' : 'Study'} active={location.pathname === '/dashboard' || location.pathname === '/'} collapsed={collapsed} dataTour="study" />
                  <SidebarLink to="/sources" icon={FolderOpen} label="Library" active={location.pathname === '/sources'} collapsed={collapsed} dataTour="library" />
                  <SidebarLink to="/analytics" icon={BarChart3} label="Progress" active={location.pathname === '/analytics'} collapsed={collapsed} dataTour="progress" />
                  <SidebarLink to="/study-plan" icon={CalendarDays} label="Plan" active={location.pathname === '/study-plan'} collapsed={collapsed} />
                  <SidebarLink to="/legal" icon={Scale} label="Codes" active={location.pathname === '/legal'} collapsed={collapsed} />
                </>
              )}
            </nav>

            {/* Settings at bottom */}
            <div className={`px-2 py-2 border-t border-[var(--border-card)] ${collapsed ? 'flex justify-center' : ''}`}>
              <SidebarLink to="/settings" icon={Settings} label="Settings" active={location.pathname === '/settings'} collapsed={collapsed} />
            </div>

            {/* Sidebar footer — admin only (UI convenience; server-side auth uses ADMIN_EMAIL env var via adminAuth.ts) */}
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

              {/* Nav links — branched per vertical */}
              <nav className="flex-1 px-3 py-4 space-y-1">
                {isCRFPA ? (
                  <>
                    <SidebarLink to="/accueil" icon={Home} label="Accueil" active={location.pathname === '/accueil' || location.pathname === '/'} onClick={closeSidebar} collapsed={false} />
                    <SidebarLink to="/legal/syllogisme" icon={PenSquare} label="Entraînement" active={location.pathname.startsWith('/legal/syllogisme') || location.pathname.startsWith('/legal/plan') || location.pathname.startsWith('/legal/fiche') || location.pathname.startsWith('/legal/commentaire') || location.pathname.startsWith('/legal/synthese')} onClick={closeSidebar} collapsed={false} />
                    <SidebarLink to="/legal" icon={Scale} label="Oracle" active={location.pathname === '/legal'} onClick={closeSidebar} collapsed={false} />
                    <SidebarLink to="/historique" icon={History} label="Historique" active={location.pathname === '/historique'} onClick={closeSidebar} collapsed={false} />
                  </>
                ) : (
                  <>
                    <SidebarLink to="/queue" icon={Zap} label={isResearch ? 'Tasks' : 'Today'} active={location.pathname === '/queue'} onClick={closeSidebar} collapsed={false} />
                    <SidebarLink to="/practice-exam" icon={ClipboardCheck} label="Exams" active={location.pathname === '/practice-exam'} onClick={closeSidebar} collapsed={false} />
                    <SidebarLink to="/dashboard" icon={BookOpen} label={isResearch ? 'Research' : 'Study'} active={location.pathname === '/dashboard' || location.pathname === '/'} onClick={closeSidebar} collapsed={false} />
                    <SidebarLink to="/sources" icon={FolderOpen} label="Library" active={location.pathname === '/sources'} onClick={closeSidebar} collapsed={false} />
                    <SidebarLink to="/analytics" icon={BarChart3} label="Progress" active={location.pathname === '/analytics'} onClick={closeSidebar} collapsed={false} />
                    <SidebarLink to="/study-plan" icon={CalendarDays} label="Plan" active={location.pathname === '/study-plan'} onClick={closeSidebar} collapsed={false} />
                    <SidebarLink to="/legal" icon={Scale} label="Codes" active={location.pathname === '/legal'} onClick={closeSidebar} collapsed={false} />
                  </>
                )}

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
        <main id="main-content" className={isChatPage ? 'flex-1 w-full min-w-0 pb-16 md:pb-0' : 'flex-1 max-w-7xl mx-auto px-4 sm:px-6 py-8 w-full min-w-0 pb-16 md:pb-0'}>
          {!isOnline && (
            <div className="mb-4 px-4 py-2 rounded-lg bg-[var(--color-warning-bg)] border border-[var(--color-warning-border)] text-sm text-[var(--color-warning)] text-center">
              You're offline. Some features may not work.
            </div>
          )}
          {activeProfile && streak > 0 && !hasStudiedToday && (
            <StreakAtRiskBanner streak={streak} profileId={activeProfile.id} />
          )}
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>

      {/* Footer — only on public pages (not shown for authenticated users) */}
      <SignedOut>
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
                  <Link to="/privacy" className="text-[var(--text-muted)] hover:text-[var(--accent-text)] transition-colors">
                    Privacy
                  </Link>
                  <Link to="/terms" className="text-[var(--text-muted)] hover:text-[var(--accent-text)] transition-colors">
                    Terms
                  </Link>
                  <span className="text-[var(--text-faint)]">{t('footer.dataLocal')}</span>
                </div>
              </div>
            </div>
          </footer>
        )}
      </SignedOut>

      {/* Mobile Bottom Nav */}
      <SignedIn>
        <BottomNav />
      </SignedIn>

      {/* Contextual Floating Assistant */}
      <SignedIn>
        <ContextualAssistant chatOpen={chatOpen} />
      </SignedIn>

      {/* Chat Panel (lazy-loaded) */}
      <Suspense fallback={null}>
        <ChatPanel open={chatOpen} onClose={() => { setChatOpen(false); setChatSubjectId(null); setChatSubjectName(null); setChatContext(null) }} prefill={chatPrefill} onPrefillConsumed={() => setChatPrefill(null)} subjectId={chatSubjectId} subjectName={chatSubjectName} context={chatContext} onContextConsumed={() => setChatContext(null)} />
      </Suspense>

      {/* Search Modal (lazy-loaded) */}
      <Suspense fallback={null}>
        <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
      </Suspense>

      {/* Keyboard Shortcuts */}
      {shortcutsOpen && <KeyboardShortcutsModal onClose={() => setShortcutsOpen(false)} />}

      {/* Onboarding Tour */}
      {activeProfile && <OnboardingTour profileId={activeProfile.id} />}

      {/* PWA prompts */}
      <UpdatePrompt />
      <InstallPrompt />

      {/* GDPR Consent Banner */}
      <CookieConsent />
    </div>
  )
}

// ─── Sidebar sub-components ─────────────────────────────────────


function SidebarLink({
  to, icon: Icon, label, active, onClick, pro, collapsed, dataTour,
}: {
  to: string
  icon: React.ComponentType<{ size?: number }>
  label: string
  active: boolean
  onClick?: () => void
  pro?: boolean
  collapsed: boolean
  dataTour?: string
}) {
  if (collapsed) {
    return (
      <Link
        to={to}
        onClick={onClick}
        data-tour={dataTour}
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
      data-tour={dataTour}
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
