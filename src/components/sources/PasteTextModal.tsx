import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'

interface Props {
  open: boolean
  onClose: () => void
  onSave: (title: string, text: string) => void
}

export function PasteTextModal({ open, onClose, onSave }: Props) {
  const { t } = useTranslation()
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')

  if (!open) return null

  const handleSave = () => {
    if (!title.trim() || !text.trim()) return
    onSave(title.trim(), text.trim())
    setTitle('')
    setText('')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="glass-card w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-card)]">
          <h2 className="font-semibold text-[var(--text-heading)]">{t('sources.pasteTitle')}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--bg-input)] text-[var(--text-muted)]">
            <X size={18} />
          </button>
        </div>
        <div className="p-5 space-y-4 flex-1 overflow-y-auto">
          <div>
            <label className="block text-sm font-medium text-[var(--text-body)] mb-1">{t('sources.pasteDocTitle')}</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder={t('sources.pastePlaceholder')}
              className="w-full px-3 py-2 bg-[var(--bg-input)] border border-[var(--border-input)] rounded-lg text-sm text-[var(--text-body)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-text)]/30"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--text-body)] mb-1">Content</label>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Paste your notes, lecture content, or any study material here..."
              rows={12}
              className="w-full px-3 py-2 bg-[var(--bg-input)] border border-[var(--border-input)] rounded-lg text-sm text-[var(--text-body)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-text)]/30 resize-none"
            />
            {text && (
              <p className="text-xs text-[var(--text-faint)] mt-1">
                {text.split(/\s+/).length.toLocaleString()} words
              </p>
            )}
          </div>
        </div>
        <div className="px-5 py-4 border-t border-[var(--border-card)] flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary px-4 py-2 text-sm">{t('common.cancel')}</button>
          <button
            onClick={handleSave}
            disabled={!title.trim() || !text.trim()}
            className="btn-primary px-4 py-2 text-sm disabled:opacity-40"
          >
            {t('common.save')}
          </button>
        </div>
      </div>
    </div>
  )
}
