/**
 * Dossier document browser for the note de synthèse.
 * Scrollable tabs to switch between documents, with content rendered as Markdown.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight, FileText, Scale, BookOpen, Newspaper, FileCheck, ExternalLink } from 'lucide-react'
import { DocumentMarkdown } from '../document/DocumentMarkdown'

export interface DossierDoc {
  docNumber: number
  title: string
  type: string
  content: string
  sourceUrl?: string
}

interface DossierPanelProps {
  documents: DossierDoc[]
}

const TYPE_ICONS: Record<string, typeof FileText> = {
  'legislation': Scale,
  'jurisprudence-cass': Scale,
  'jurisprudence-ce': Scale,
  'jurisprudence-cedh': Scale,
  'doctrine': BookOpen,
  'presse': Newspaper,
  'rapport': FileCheck,
  'circulaire': FileCheck,
}

const TYPE_LABELS: Record<string, string> = {
  'legislation': 'Loi',
  'jurisprudence-cass': 'Cass.',
  'jurisprudence-ce': 'CE',
  'jurisprudence-cedh': 'CEDH',
  'doctrine': 'Doctrine',
  'presse': 'Presse',
  'rapport': 'Rapport',
  'circulaire': 'Circ.',
}

export function DossierPanel({ documents }: DossierPanelProps) {
  const { t } = useTranslation()
  const [activeDoc, setActiveDoc] = useState(0)
  const doc = documents[activeDoc]

  if (documents.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--text-muted)] text-sm">
        {t('syntheseExam.noDossier')}
      </div>
    )
  }

  const Icon = TYPE_ICONS[doc?.type] ?? FileText

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar — scrollable */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-[var(--border-card)] overflow-x-auto shrink-0">
        <span className="text-xs text-[var(--text-faint)] shrink-0 mr-1">
          {documents.length} docs
        </span>
        {documents.map((d, i) => (
          <button
            key={d.docNumber}
            onClick={() => setActiveDoc(i)}
            className={`shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-medium transition-colors ${
              i === activeDoc
                ? 'bg-[var(--accent-text)] text-white'
                : 'bg-[var(--bg-input)] text-[var(--text-muted)] hover:text-[var(--text-body)]'
            }`}
            title={d.title}
          >
            {d.docNumber}
          </button>
        ))}
      </div>

      {/* Document header */}
      {doc && (
        <div className="px-4 py-3 border-b border-[var(--border-card)] bg-[var(--bg-card)] shrink-0">
          <div className="flex items-center gap-2 mb-1">
            <Icon className="w-4 h-4 text-[var(--accent-text)] shrink-0" />
            <span className="text-xs font-medium text-[var(--accent-text)]">
              Document {doc.docNumber} — {TYPE_LABELS[doc.type] ?? doc.type}
            </span>
          </div>
          <h3 className="text-sm font-semibold text-[var(--text-heading)] leading-snug">
            {doc.title}
          </h3>
          {doc.sourceUrl && (
            <a
              href={doc.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-1 text-[10px] text-[var(--accent-text)] hover:underline"
            >
              <ExternalLink className="w-3 h-3" />
              Source
            </a>
          )}
        </div>
      )}

      {/* Document content */}
      <div className="flex-1 overflow-auto px-4 py-4">
        {doc && <DocumentMarkdown content={doc.content} />}
      </div>

      {/* Prev/Next navigation */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-[var(--border-card)] shrink-0">
        <button
          onClick={() => setActiveDoc(Math.max(0, activeDoc - 1))}
          disabled={activeDoc <= 0}
          className="p-1.5 rounded-lg border border-[var(--border-card)] text-[var(--text-body)] hover:bg-[var(--bg-input)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-xs text-[var(--text-muted)]">
          Doc {doc?.docNumber ?? '?'} / {documents.length}
        </span>
        <button
          onClick={() => setActiveDoc(Math.min(documents.length - 1, activeDoc + 1))}
          disabled={activeDoc >= documents.length - 1}
          className="p-1.5 rounded-lg border border-[var(--border-card)] text-[var(--text-body)] hover:bg-[var(--bg-input)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
