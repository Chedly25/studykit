/**
 * Non-invasive active recall suggestion banner.
 * Slides up at the bottom of the PDF pane after reading ~5 pages.
 * Never blocks content — student can always dismiss.
 */
import { Brain, X } from 'lucide-react'

interface Props {
  onQuizMe: () => void
  onDismiss: () => void
}

export function RecallSuggestion({ onQuizMe, onDismiss }: Props) {
  return (
    <div className="absolute bottom-4 left-4 right-4 z-20 animate-fade-in">
      <div className="glass-card p-3 flex items-center gap-3 shadow-lg border border-[var(--accent-text)]/20">
        <Brain className="w-5 h-5 text-[var(--accent-text)] shrink-0" />
        <p className="text-sm text-[var(--text-body)] flex-1">
          Quick recall check? Test what you just read
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onQuizMe}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--accent-text)] text-white hover:opacity-90 transition-opacity"
          >
            Quiz me
          </button>
          <button
            onClick={onDismiss}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-body)] hover:bg-[var(--bg-input)] transition-colors"
            title="Not now"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
