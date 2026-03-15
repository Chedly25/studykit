import { useState } from 'react'
import { Link, Outlet } from 'react-router-dom'
import { SignedIn, SignedOut, UserButton } from '@clerk/clerk-react'
import { GraduationCap, LayoutDashboard, BarChart3, Focus, MessageCircle } from 'lucide-react'
import { MegaMenu } from './MegaMenu'
import { ThemeToggle } from './ThemeToggle'
import { ExamProfileSelector } from './knowledge/ExamProfileSelector'
import { ChatPanel } from './chat/ChatPanel'

export function Layout() {
  const [chatOpen, setChatOpen] = useState(false)

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-[var(--border-header)] backdrop-blur-md bg-[var(--bg-header)] sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg bg-[var(--accent-bg)] flex items-center justify-center">
              <GraduationCap size={18} className="text-[var(--accent-text)]" />
            </div>
            <span className="font-[family-name:var(--font-display)] font-bold text-lg text-[var(--text-heading)] group-hover:text-[var(--accent-text)] transition-colors">
              StudiesKit
            </span>
          </Link>

          <nav className="flex items-center gap-3">
            <SignedIn>
              <Link
                to="/dashboard"
                className="text-[var(--text-body)] hover:text-[var(--accent-text)] transition-colors font-medium text-sm hidden sm:flex items-center gap-1"
              >
                <LayoutDashboard size={15} /> Dashboard
              </Link>
              <Link
                to="/focus"
                className="text-[var(--text-body)] hover:text-[var(--accent-text)] transition-colors font-medium text-sm hidden sm:flex items-center gap-1"
              >
                <Focus size={15} /> Focus
              </Link>
              <Link
                to="/analytics"
                className="text-[var(--text-body)] hover:text-[var(--accent-text)] transition-colors font-medium text-sm hidden md:flex items-center gap-1"
              >
                <BarChart3 size={15} /> Analytics
              </Link>
            </SignedIn>
            <MegaMenu />
            <Link
              to="/all-tools"
              className="text-[var(--text-body)] hover:text-[var(--accent-text)] transition-colors font-medium text-sm hidden sm:block"
            >
              All Tools
            </Link>
            <SignedIn>
              <ExamProfileSelector />
              <button
                onClick={() => setChatOpen(!chatOpen)}
                className={`p-2 rounded-lg transition-colors ${
                  chatOpen
                    ? 'bg-[var(--accent-bg)] text-[var(--accent-text)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--accent-text)] hover:bg-[var(--bg-input)]'
                }`}
                title="AI Chat"
              >
                <MessageCircle size={18} />
              </button>
            </SignedIn>
            <ThemeToggle />
            <SignedIn>
              <UserButton afterSignOutUrl="/" />
            </SignedIn>
            <SignedOut>
              <Link
                to="/sign-in"
                className="btn-primary text-sm px-4 py-1.5"
              >
                Sign In
              </Link>
            </SignedOut>
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 py-8 w-full">
        <Outlet />
      </main>

      <footer className="border-t border-[var(--border-header)] py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-[var(--text-muted)] text-sm">
              <GraduationCap size={16} />
              <span>StudiesKit — AI-Powered Exam Preparation</span>
            </div>
            <p className="text-[var(--text-faint)] text-sm">
              Your data stays in your browser.
            </p>
          </div>
        </div>
      </footer>

      {/* Chat Panel */}
      <ChatPanel open={chatOpen} onClose={() => setChatOpen(false)} />
    </div>
  )
}
