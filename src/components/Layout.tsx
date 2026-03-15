import { Link, Outlet } from 'react-router-dom'
import { GraduationCap } from 'lucide-react'
import { MegaMenu } from './MegaMenu'

export function Layout() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-surface-800/50 backdrop-blur-md bg-surface-950/80 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg bg-primary-500/15 flex items-center justify-center">
              <GraduationCap size={18} className="text-primary-400" />
            </div>
            <span className="font-[family-name:var(--font-display)] font-bold text-lg text-surface-50 group-hover:text-primary-400 transition-colors">
              StudyKit
            </span>
          </Link>

          <nav className="flex items-center gap-6">
            <MegaMenu />
            <Link
              to="/all-tools"
              className="text-surface-300 hover:text-primary-400 transition-colors font-medium text-sm"
            >
              All Tools
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 py-8 w-full">
        <Outlet />
      </main>

      <footer className="border-t border-surface-800/50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-surface-500 text-sm">
              <GraduationCap size={16} />
              <span>StudyKit — Free student productivity tools</span>
            </div>
            <p className="text-surface-600 text-sm">
              100% free. Runs in your browser. No data leaves your device.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
