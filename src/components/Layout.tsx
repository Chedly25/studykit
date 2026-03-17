import { useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { SignedIn, SignedOut, UserButton, useUser } from '@clerk/clerk-react'
import { LayoutDashboard, BarChart3, Focus, MessageCircle, FileText, PenTool, BookOpen, Users, Shield, FileSearch } from 'lucide-react'
import { MegaMenu } from './MegaMenu'
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
  const { user } = useUser()
  const { isPro } = useSubscription()
  const { activeProfile } = useExamProfile()
  const { isResearch } = useProfileMode()
  const { t } = useTranslation()
  const location = useLocation()
  const isChatPage = location.pathname === '/chat'

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-[var(--border-header)] backdrop-blur-md bg-[var(--bg-header)] sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group">
            <img src="/favicon-48x48.png" alt="StudiesKit" className="w-8 h-8 rounded-lg" />
            <span className="font-[family-name:var(--font-display)] font-bold text-lg text-[var(--text-heading)] group-hover:text-[var(--accent-text)] transition-colors">
              StudiesKit
            </span>
          </Link>

          <nav className="flex items-center gap-3">
            <SignedIn>
              <Link
                to="/exam-profile"
                className="text-[var(--text-body)] hover:text-[var(--accent-text)] transition-colors font-medium text-sm hidden sm:flex items-center gap-1"
              >
                <BookOpen size={15} /> {t('nav.projects', 'Projects')}
              </Link>
              <Link
                to="/dashboard"
                className="text-[var(--text-body)] hover:text-[var(--accent-text)] transition-colors font-medium text-sm hidden sm:flex items-center gap-1"
              >
                <LayoutDashboard size={15} /> {t('nav.dashboard')}
              </Link>
              {isResearch ? (
                <>
                  <Link
                    to="/writing"
                    className="text-[var(--text-body)] hover:text-[var(--accent-text)] transition-colors font-medium text-sm hidden sm:flex items-center gap-1"
                  >
                    <PenTool size={15} /> {t('research.writingSession')}
                  </Link>
                  <Link
                    to="/sources"
                    className="text-[var(--text-body)] hover:text-[var(--accent-text)] transition-colors font-medium text-sm hidden md:flex items-center gap-1"
                  >
                    <BookOpen size={15} /> {t('research.literature')}
                  </Link>
                  <Link
                    to="/meetings"
                    className="text-[var(--text-body)] hover:text-[var(--accent-text)] transition-colors font-medium text-sm hidden lg:flex items-center gap-1"
                  >
                    <Users size={15} /> {t('research.meetings')}
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    to="/focus"
                    className="text-[var(--text-body)] hover:text-[var(--accent-text)] transition-colors font-medium text-sm hidden sm:flex items-center gap-1"
                  >
                    <Focus size={15} /> {t('nav.focus')}
                  </Link>
                  <Link
                    to="/analytics"
                    className="text-[var(--text-body)] hover:text-[var(--accent-text)] transition-colors font-medium text-sm hidden md:flex items-center gap-1"
                  >
                    <BarChart3 size={15} /> {t('nav.analytics')}
                  </Link>
                  <Link
                    to="/sources"
                    className="text-[var(--text-body)] hover:text-[var(--accent-text)] transition-colors font-medium text-sm hidden lg:flex items-center gap-1"
                  >
                    <FileText size={15} /> {t('nav.sources')}
                  </Link>
                </>
              )}
              <Link
                to="/article-review"
                className="text-[var(--text-body)] hover:text-[var(--accent-text)] transition-colors font-medium text-sm hidden md:flex items-center gap-1"
              >
                <FileSearch size={15} /> Review
              </Link>
            </SignedIn>
            <MegaMenu />
            <SignedIn>
              <ExamProfileSelector />
              <NotificationBell examProfileId={activeProfile?.id} />
              {user?.primaryEmailAddress?.emailAddress === 'chedlyboukhris21@gmail.com' && (
                <Link
                  to="/admin"
                  className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--accent-text)] hover:bg-[var(--bg-input)] transition-colors"
                  title="Admin"
                >
                  <Shield size={18} />
                </Link>
              )}
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
              <Link
                to="/sign-in"
                className="btn-primary text-sm px-4 py-1.5"
              >
                {t('common.signIn')}
              </Link>
            </SignedOut>
          </nav>
        </div>
      </header>

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
