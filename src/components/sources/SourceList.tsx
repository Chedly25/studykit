import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Search, FileText } from 'lucide-react'
import { SourceCard } from './SourceCard'
import type { Document } from '../../db/schema'

interface Props {
  documents: Document[]
  onView: (doc: Document) => void
  onDelete: (docId: string) => void
  onSummarize: (doc: Document) => void
  onGenerateFlashcards: (doc: Document) => void
  onGeneratePracticeExam: (doc: Document) => void
  summarizingId: string | null
  generatingFlashcardsId: string | null
  deleteConfirmId: string | null
}

export function SourceList({
  documents,
  onView,
  onDelete,
  onSummarize,
  onGenerateFlashcards,
  onGeneratePracticeExam,
  summarizingId,
  generatingFlashcardsId,
  deleteConfirmId,
}: Props) {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')

  const filtered = search.trim()
    ? documents.filter(d =>
        d.title.toLowerCase().includes(search.toLowerCase())
      )
    : documents

  if (documents.length === 0) {
    return (
      <div className="text-center py-16">
        <FileText className="w-12 h-12 text-[var(--text-faint)] mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-[var(--text-heading)] mb-2">{t('sources.noSources')}</h3>
        <p className="text-sm text-[var(--text-muted)] max-w-md mx-auto">
          {t('sources.uploadFirst')}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-faint)]" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t('common.search')}
          className="w-full pl-9 pr-4 py-2 bg-[var(--bg-input)] border border-[var(--border-input)] rounded-lg text-sm text-[var(--text-body)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-text)]/30"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(doc => (
          <SourceCard
            key={doc.id}
            document={doc}
            onView={() => onView(doc)}
            onDelete={() => onDelete(doc.id)}
            onSummarize={() => onSummarize(doc)}
            onGenerateFlashcards={() => onGenerateFlashcards(doc)}
            onGeneratePracticeExam={() => onGeneratePracticeExam(doc)}
            isSummarizing={summarizingId === doc.id}
            isGeneratingFlashcards={generatingFlashcardsId === doc.id}
            deleteConfirm={deleteConfirmId === doc.id}
          />
        ))}
      </div>

      {filtered.length === 0 && search && (
        <p className="text-center text-sm text-[var(--text-muted)] py-8">
          {t('common.noResults')}
        </p>
      )}
    </div>
  )
}
