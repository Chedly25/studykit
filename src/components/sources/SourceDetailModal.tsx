import { useTranslation } from 'react-i18next'
import { X, Loader2 } from 'lucide-react'
import type { Document } from '../../db/schema'

interface Props {
  document: Document | null
  onClose: () => void
  isSummarizing?: boolean
}

export function SourceDetailModal({ document: doc, onClose, isSummarizing }: Props) {
  const { t } = useTranslation()

  if (!doc) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="glass-card w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-card)]">
          <div>
            <h2 className="font-semibold text-[var(--text-heading)]">{doc.title}</h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              {doc.sourceType.toUpperCase()} &middot; {t('sources.words', { count: doc.wordCount })}
            </p>
          </div>
          <button onClick={onClose} className="btn-action p-1.5 rounded-lg hover:bg-[var(--bg-input)] text-[var(--text-muted)]">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {isSummarizing && !doc.summary && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Loader2 className="w-4 h-4 text-[var(--accent-text)] animate-spin" />
                <span className="text-sm text-[var(--accent-text)] font-medium">{t('sources.summarizing')}</span>
              </div>
              <div className="space-y-2">
                <div className="h-3 bg-[var(--border-card)] rounded animate-pulse w-full" />
                <div className="h-3 bg-[var(--border-card)] rounded animate-pulse w-5/6" />
                <div className="h-3 bg-[var(--border-card)] rounded animate-pulse w-4/6" />
                <div className="h-3 bg-[var(--border-card)] rounded animate-pulse w-full mt-4" />
                <div className="h-3 bg-[var(--border-card)] rounded animate-pulse w-3/4" />
              </div>
            </div>
          )}

          {doc.summary && (
            <div className="animate-fade-in">
              <h3 className="text-xs font-semibold text-[var(--accent-text)] uppercase tracking-wide mb-2">{t('sources.summary')}</h3>
              <p className="text-sm text-[var(--text-body)] leading-relaxed whitespace-pre-wrap">{doc.summary}</p>
            </div>
          )}

          {!isSummarizing && !doc.summary && (
            <p className="text-sm text-[var(--text-muted)] text-center py-8">
              {t('sources.documentCount', { count: doc.wordCount })} &middot; {t('sources.chunks', { count: doc.chunkCount })}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
