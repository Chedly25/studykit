import { Link } from 'react-router-dom'
import { GraduationCap } from 'lucide-react'

export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--bg-main)] px-4">
      <Link to="/" className="flex items-center gap-2 mb-8 group">
        <div className="w-10 h-10 rounded-lg bg-[var(--accent-bg)] flex items-center justify-center">
          <GraduationCap size={22} className="text-[var(--accent-text)]" />
        </div>
        <span className="font-[family-name:var(--font-display)] font-bold text-2xl text-[var(--text-heading)] group-hover:text-[var(--accent-text)] transition-colors">
          StudiesKit
        </span>
      </Link>
      {children}
    </div>
  )
}
