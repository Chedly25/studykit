import { useTranslation } from 'react-i18next'
import { X, FileText, File } from 'lucide-react'
import type { Document } from '../../db/schema'

interface MaterialsPanelProps {
  documents: Document[]
  isOpen: boolean
  onClose: () => void
  onSelectDocument?: (doc: Document) => void
}

export function MaterialsPanel({ documents, isOpen, onClose, onSelectDocument }: MaterialsPanelProps) {
  const { t } = useTranslation()

  if (!isOpen) return null

  return (
    <div className="absolute right-0 top-0 bottom-0 w-[300px] bg-[var(--bg-card)] border-l border-[var(--border-card)] z-30 flex flex-col animate-slide-in-right">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-card)]">
        <h3 className="text-sm font-semibold text-[var(--text-heading)]">
          {t('session.materials', 'Materials')}
        </h3>
        <button
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-[var(--bg-input)] text-[var(--text-muted)]"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Document list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {documents.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)] text-center py-8">
            {t('session.noMaterials', 'No documents uploaded yet. Upload materials from the Sources page.')}
          </p>
        ) : (
          documents.map(doc => (
            <button
              key={doc.id}
              onClick={() => onSelectDocument?.(doc)}
              className="w-full text-left glass-card p-3 hover:ring-1 hover:ring-[var(--accent-text)]/20 transition-all"
            >
              <div className="flex items-start gap-2.5">
                <div className="p-1.5 rounded-lg bg-[var(--accent-bg)] flex-shrink-0">
                  {doc.sourceType === 'pdf' ? (
                    <FileText className="w-3.5 h-3.5 text-[var(--accent-text)]" />
                  ) : (
                    <File className="w-3.5 h-3.5 text-[var(--accent-text)]" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-[var(--text-heading)] truncate">{doc.title}</p>
                  <p className="text-[10px] text-[var(--text-muted)]">
                    {doc.sourceType.toUpperCase()} · {new Date(doc.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
