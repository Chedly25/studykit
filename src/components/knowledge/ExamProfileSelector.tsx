import { ChevronDown, GraduationCap, Plus } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useExamProfile } from '../../hooks/useExamProfile'

export function ExamProfileSelector() {
  const { profiles, activeProfile, setActiveProfile } = useExamProfile()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const { t } = useTranslation()

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  if (profiles.length === 0) return null

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--bg-input)] border border-[var(--border-card)] text-sm text-[var(--text-body)] hover:border-[var(--accent-text)]/30 transition-colors"
      >
        <GraduationCap className="w-4 h-4 text-[var(--accent-text)]" />
        <span className="max-w-[120px] truncate">{activeProfile?.name ?? t('profile.noProfile')}</span>
        <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)]" />
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-1 w-56 glass-card p-1 z-50 shadow-lg">
          {profiles.map(p => (
            <button
              key={p.id}
              onClick={() => { setActiveProfile(p.id); setOpen(false) }}
              className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                p.id === activeProfile?.id
                  ? 'bg-[var(--accent-bg)] text-[var(--accent-text)]'
                  : 'text-[var(--text-body)] hover:bg-[var(--bg-input)]'
              }`}
            >
              <div className="font-medium">{p.name}</div>
              <div className="text-xs text-[var(--text-muted)]">{p.examDate}</div>
            </button>
          ))}
          <div className="border-t border-[var(--border-card)] mt-1 pt-1">
            <button
              onClick={() => { navigate('/exam-profile'); setOpen(false) }}
              className="w-full text-left px-3 py-2 rounded-md text-sm text-[var(--text-muted)] hover:bg-[var(--bg-input)] flex items-center gap-2"
            >
              <Plus className="w-3.5 h-3.5" /> {t('profile.create')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
