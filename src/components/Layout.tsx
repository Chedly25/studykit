import { useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { SignedIn, SignedOut, UserButton, useUser } from '@clerk/clerk-react'
import {
  Menu, X, LayoutDashboard, BarChart3, Focus, MessageCircle,
  FileText, PenTool, BookOpen, Users, Shield, FileSearch,
  Brain, ClipboardCheck, Lightbulb, Calendar, StickyNote, GraduationCap,
} from 'lucide-react'
import { ThemeToggle } from './ThemeToggle'
import { LanguageToggle } from './LanguageToggle'
import { ExamProfileSelector } from './knowledge/ExamProfileSelector'
import { ChatPanel } from './chat/ChatPanel'
import { ProBadge } from './subscription/ProBadge'
import { NotificationBell } from './NotificationBell'
import { useSubscription } from '../hooks/useSubscription'
import { useExamProfile } from '../hooks/useExamProfile'
import { useProfileMode } from '../hooks/useProfileMode'

export function Layout() {
  const [chatOpen, setChatOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { user } = useUser()
  const { isPro } = useSubscription()
  const { activeProfile } = useExamProfile()
  const { isResearch } = useProfileMode()
  const { t } = useTranslation()
  const location = useLocation()
  const isChatPage = location.pathname === '/chat'

  const closeSidebar = () => setSidebarOpen(false)

  return (
    <div className="min-h-screen flex flex-col">
      {/* ─── Header ─────────────────────────────────────────── */}
      <header className="border-b border-[var(--border-header)] backdrop-blur-md bg-[var(--bg-header)] sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          {/* Left: menu toggle + logo */}
          <div className="flex items-center gap-2">
            <SignedIn>
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--accent-text)] hover:bg-[var(--bg-input)] transition-colors"
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

      {/* ─── Left Sidebar Overlay ───────────────────────────── */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex">
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

            {/* Nav links */}
            <nav className="flex-1 px-3 py-4 space-y-6">
              {/* Navigation */}
              <SidebarSection label={t('nav.navigation', 'Navigation')}>
                <SidebarLink to="/dashboard" icon={LayoutDashboard} label={t('nav.dashboard')} active={location.pathname === '/dashboard'} onClick={closeSidebar} />
                <SidebarLink to="/exam-profile" icon={GraduationCap} label={t('nav.projects', 'Projects')} active={location.pathname === '/exam-profile'} onClick={closeSidebar} />
                {isResearch ? (
                  <>
                    <SidebarLink to="/writing" icon={PenTool} label={t('research.writingSession')} active={location.pathname === '/writing'} onClick={closeSidebar} />
                    <SidebarLink to="/sources" icon={BookOpen} label={t('research.literature')} active={location.pathname === '/sources'} onClick={closeSidebar} />
                    <SidebarLink to="/notes" icon={StickyNote} label={t('research.notes')} active={location.pathname === '/notes'} onClick={closeSidebar} />
                    <SidebarLink to="/meetings" icon={Users} label={t('research.meetings')} active={location.pathname === '/meetings'} onClick={closeSidebar} />
                  </>
                ) : (
                  <>
                    <SidebarLink to="/focus" icon={Focus} label={t('focus.title', 'Focus')} active={location.pathname === '/focus'} onClick={closeSidebar} />
                    <SidebarLink to="/analytics" icon={BarChart3} label={t('nav.analytics')} active={location.pathname === '/analytics'} onClick={closeSidebar} />
                    <SidebarLink to="/sources" icon={FileText} label={t('sources.title', 'Sources')} active={location.pathname === '/sources'} onClick={closeSidebar} />
                  </>
                )}
                <SidebarLink to="/article-review" icon={FileSearch} label="Article Review" active={location.pathname === '/article-review'} onClick={closeSidebar} />
              </SidebarSection>

              {/* AI Features */}
              <SidebarSection label={t('nav.aiFeatures', 'AI Features')}>
                <SidebarLink to="/chat" icon={MessageCircle} label={isResearch ? t('research.partner') : t('ai.chat', 'AI Chat')} active={location.pathname === '/chat'} onClick={closeSidebar} pro />
                {!isResearch && (
                  <>
                    <SidebarLink to="/socratic" icon={Brain} label={t('ai.socratic', 'Socratic Mode')} active={location.pathname === '/socratic'} onClick={closeSidebar} pro />
                    <SidebarLink to="/practice-exam" icon={ClipboardCheck} label={t('ai.practiceSession', 'Practice Exam')} active={location.pathname === '/practice-exam'} onClick={closeSidebar} pro />
                    <SidebarLink to="/explain-back" icon={Lightbulb} label={t('ai.explainBack', 'Explain Back')} active={location.pathname === '/explain-back'} onClick={closeSidebar} pro />
                  </>
                )}
                <SidebarLink to="/study-plan" icon={Calendar} label={t('ai.studyPlan', 'Study Plan')} active={location.pathname === '/study-plan'} onClick={closeSidebar} pro />
              </SidebarSection>
            </nav>

            {/* Sidebar footer — admin only */}
            {user?.primaryEmailAddress?.emailAddress === 'chedlyboukhris21@gmail.com' && (
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
      <main className={isChatPage ? 'flex-1 w-full' : 'flex-1 max-w-7xl mx-auto px-4 sm:px-6 py-8 w-full'}>
        <Outlet />
      </main>

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

      {/* Chat Panel */}
      <ChatPanel open={chatOpen} onClose={() => setChatOpen(false)} />
    </div>
  )
}

// ─── Sidebar sub-components ─────────────────────────────────────

function SidebarSection({ label, children }: { label: string; children: React.ReactNode }) {
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
  to, icon: Icon, label, active, onClick, pro,
}: {
  to: string
  icon: React.ComponentType<{ size?: number }>
  label: string
  active: boolean
  onClick: () => void
  pro?: boolean
}) {
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
      <span className="flex-1">{label}</span>
      {pro && <ProBadge />}
    </Link>
  )
}
