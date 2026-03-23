/**
 * Contextual floating assistant button.
 * Changes behavior based on current route — always one tap to AI help.
 */
import { useState, useEffect, useRef } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { MessageCircle, Upload, ClipboardCheck, Sparkles, X } from 'lucide-react'

interface ContextualAction {
  label: string
  icon?: React.ReactNode
  action: () => void
}

interface Props {
  chatOpen: boolean
  subjectName?: string
}

export function ContextualAssistant({ chatOpen, subjectName }: Props) {
  const { t } = useTranslation()
  const location = useLocation()
  const params = useParams()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close menu on route change
  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  // Hide when chat is open (after all hooks)
  if (chatOpen) return null

  const openChat = (prefill?: string, detail?: Record<string, unknown>) => {
    window.dispatchEvent(new CustomEvent('open-chat-panel', {
      detail: { prefill, ...detail },
    }))
    setMenuOpen(false)
  }

  // Route-based config
  const path = location.pathname
  let config: { label: string; actions?: ContextualAction[]; directAction?: () => void }

  if (path.match(/^\/subject\//)) {
    const name = subjectName || params.id || ''
    config = {
      label: t('assistant.askSubjectTutor', { subject: name }),
      directAction: () => openChat(undefined, { subjectId: params.id, subjectName: name }),
    }
  } else if (path === '/queue') {
    config = {
      label: t('assistant.askAboutThis', 'Ask about this'),
      directAction: () => openChat(),
    }
  } else if (path === '/sources') {
    config = {
      label: t('assistant.sourceActions', 'Quick actions'),
      actions: [
        { label: t('assistant.processDocuments', 'Process documents'), icon: <Sparkles className="w-4 h-4" />, action: () => openChat(t('assistant.processDocumentsPrompt', 'Process my uploaded documents')) },
        { label: t('assistant.generateFlashcards', 'Generate flashcards'), icon: <ClipboardCheck className="w-4 h-4" />, action: () => openChat(t('assistant.generateFlashcardsPrompt', 'Generate flashcards from my sources')) },
      ],
    }
  } else if (path === '/analytics') {
    config = {
      label: t('assistant.whatToFocus', 'What should I focus on?'),
      directAction: () => openChat(t('assistant.focusPrompt', 'Based on my progress, what should I focus on next?')),
    }
  } else if (path === '/study-plan') {
    config = {
      label: t('assistant.adjustPlan', 'Adjust my plan'),
      directAction: () => openChat(t('assistant.adjustPlanPrompt', 'Help me adjust my study plan')),
    }
  } else if (path === '/dashboard' || path === '/') {
    config = {
      label: t('assistant.quickActions', 'Quick actions'),
      actions: [
        { label: t('assistant.uploadMaterials', 'Upload materials'), icon: <Upload className="w-4 h-4" />, action: () => { window.location.href = '/sources' } },
        { label: t('assistant.practiceExam', 'Practice exam'), icon: <ClipboardCheck className="w-4 h-4" />, action: () => { window.location.href = '/practice-exam' } },
        { label: t('assistant.askTutor', 'Ask tutor'), icon: <MessageCircle className="w-4 h-4" />, action: () => openChat() },
      ],
    }
  } else {
    config = {
      label: t('assistant.askTutor', 'Ask tutor'),
      directAction: () => openChat(),
    }
  }

  const hasMenu = !!config.actions

  return (
    <div ref={menuRef} className="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-40 flex flex-col items-end gap-2">
      {/* Action menu */}
      {menuOpen && config.actions && (
        <div className="glass-card p-1.5 shadow-lg animate-fade-in mb-1 min-w-[180px]">
          {config.actions.map((action, i) => (
            <button
              key={i}
              onClick={action.action}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-[var(--text-body)] hover:bg-[var(--bg-input)] transition-colors text-left"
            >
              {action.icon && <span className="text-[var(--accent-text)]">{action.icon}</span>}
              {action.label}
            </button>
          ))}
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => {
          if (hasMenu) {
            setMenuOpen(!menuOpen)
          } else {
            config.directAction?.()
          }
        }}
        className="group flex items-center gap-2 px-4 py-3 rounded-full bg-[var(--accent-text)] text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
        title={config.label}
      >
        {menuOpen ? (
          <X className="w-5 h-5" />
        ) : (
          <MessageCircle className="w-5 h-5" />
        )}
        <span className="text-sm font-medium hidden md:inline max-w-[200px] truncate">
          {config.label}
        </span>
      </button>
    </div>
  )
}
