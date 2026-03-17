import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { MessageCircle, ClipboardCheck, Layers, Focus, PenTool, BookOpen, StickyNote } from 'lucide-react'

interface QuickAccessRowProps {
  isResearch: boolean
  dueFlashcardCount: number
}

export function QuickAccessRow({ isResearch, dueFlashcardCount }: QuickAccessRowProps) {
  const { t } = useTranslation()

  const items = isResearch
    ? [
        { icon: MessageCircle, label: t('research.partner', 'Chat'), to: '/chat' },
        { icon: PenTool, label: t('research.writingSession', 'Writing'), to: '/writing' },
        { icon: BookOpen, label: t('research.literature', 'Sources'), to: '/sources' },
        { icon: StickyNote, label: t('research.notes', 'Notes'), to: '/notes' },
      ]
    : [
        { icon: MessageCircle, label: t('ai.chat', 'Chat'), to: '/chat' },
        { icon: ClipboardCheck, label: t('ai.practiceSession', 'Practice'), to: '/practice-exam' },
        { icon: Layers, label: t('dashboard.quickAccess.flashcards', 'Flashcards'), to: '/flashcard-maker', badge: dueFlashcardCount > 0 ? dueFlashcardCount : undefined },
        { icon: Focus, label: t('focus.title', 'Focus'), to: '/focus' },
      ]

  return (
    <div className="flex justify-center gap-4 my-4">
      {items.map(({ icon: Icon, label, to, badge }) => (
        <Link
          key={to}
          to={to}
          className="flex flex-col items-center gap-1.5 group"
        >
          <div className="relative w-14 h-14 rounded-2xl bg-[var(--bg-input)] flex items-center justify-center group-hover:bg-[var(--accent-bg)] transition-colors">
            <Icon size={22} className="text-[var(--text-muted)] group-hover:text-[var(--accent-text)] transition-colors" />
            {badge !== undefined && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {badge > 99 ? '99+' : badge}
              </span>
            )}
          </div>
          <span className="text-[11px] text-[var(--text-muted)] group-hover:text-[var(--accent-text)] transition-colors">
            {label}
          </span>
        </Link>
      ))}
    </div>
  )
}
