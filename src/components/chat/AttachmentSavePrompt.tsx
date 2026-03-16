import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { FileText, Check, X } from 'lucide-react'
import type { ChatAttachment } from '../../hooks/useAttachments'
import { createDocument, saveChunks } from '../../lib/sources'

interface Props {
  attachments: ChatAttachment[]
  examProfileId: string
  onDismiss: () => void
}

export function AttachmentSavePrompt({ attachments, examProfileId, onDismiss }: Props) {
  const { t } = useTranslation()
  const [savedSet, setSavedSet] = useState<Set<number>>(new Set())
  const [dismissedSet, setDismissedSet] = useState<Set<number>>(new Set())

  const readyAttachments = attachments.filter(a => a.status === 'ready' && a.processed)

  // Auto-dismiss after 30s
  useEffect(() => {
    const timer = setTimeout(onDismiss, 30000)
    return () => clearTimeout(timer)
  }, [onDismiss])

  // If all are handled, dismiss
  useEffect(() => {
    if (readyAttachments.length > 0 && savedSet.size + dismissedSet.size >= readyAttachments.length) {
      onDismiss()
    }
  }, [savedSet.size, dismissedSet.size, readyAttachments.length, onDismiss])

  if (readyAttachments.length === 0) return null

  const handleSave = async (index: number) => {
    const att = readyAttachments[index]
    if (!att?.processed) return

    try {
      const doc = await createDocument(examProfileId, att.processed.title, 'pdf', att.processed.text)
      await saveChunks(doc.id, examProfileId, att.processed.chunks)
      setSavedSet(prev => new Set(prev).add(index))
      toast.success(t('ai.attachmentSaved', { name: att.processed.title }))
    } catch {
      toast.error('Failed to save to Sources')
    }
  }

  const handleDismissOne = (index: number) => {
    setDismissedSet(prev => new Set(prev).add(index))
  }

  return (
    <div className="glass-card p-3 mx-4 mb-2 animate-fade-in">
      <p className="text-xs font-medium text-[var(--text-heading)] mb-2">{t('ai.addToSources')}</p>
      <div className="space-y-2">
        {readyAttachments.map((att, i) => {
          if (savedSet.has(i) || dismissedSet.has(i)) return null
          return (
            <div key={i} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs text-[var(--text-body)] min-w-0">
                <FileText className="w-3.5 h-3.5 flex-shrink-0 text-[var(--accent-text)]" />
                <span className="truncate">{att.name}</span>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => handleSave(i)}
                  className="px-2 py-0.5 text-xs rounded bg-[var(--accent-text)] text-white hover:opacity-90 transition-opacity flex items-center gap-1"
                >
                  <Check className="w-3 h-3" />
                  {t('ai.addToSourcesYes')}
                </button>
                <button
                  onClick={() => handleDismissOne(i)}
                  className="px-2 py-0.5 text-xs rounded text-[var(--text-muted)] hover:bg-[var(--bg-input)] transition-colors flex items-center gap-1"
                >
                  <X className="w-3 h-3" />
                  {t('ai.addToSourcesNo')}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
