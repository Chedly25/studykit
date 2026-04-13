import { useState, useEffect, useRef, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@clerk/clerk-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Search, FileText, Loader2 } from 'lucide-react'
import { SourceCard, type DocStatusChips } from './SourceCard'
import { hybridSearch } from '../../lib/hybridSearch'
import { db } from '../../db'
import type { Document } from '../../db/schema'

interface Props {
  documents: Document[]
  examProfileId: string | undefined
  onView: (doc: Document) => void
  onViewPdf?: (doc: Document) => void
  onDelete: (docId: string) => void
  onSummarize: (doc: Document) => void
  onGenerateFlashcards: (doc: Document) => void
  onGeneratePracticeExam: (doc: Document) => void
  summarizingId: string | null
  generatingFlashcardsId: string | null
  deleteConfirmId: string | null
  pdfDocIds?: Set<string>
}

export function SourceList({
  documents,
  examProfileId,
  onView,
  onViewPdf,
  onDelete,
  onSummarize,
  onGenerateFlashcards,
  onGeneratePracticeExam,
  summarizingId,
  generatingFlashcardsId,
  deleteConfirmId,
  pdfDocIds,
}: Props) {
  const { t } = useTranslation()
  const { getToken } = useAuth()
  const [search, setSearch] = useState('')
  const [contentResults, setContentResults] = useState<Map<string, string>>(new Map())
  const [isSearching, setIsSearching] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  // Compute per-document status chips (topics linked + exercise count)
  const docIds = useMemo(() => documents.map(d => d.id), [documents])
  const statusChipsMap = useLiveQuery(async () => {
    if (!examProfileId || docIds.length === 0) return new Map<string, DocStatusChips>()
    const map = new Map<string, DocStatusChips>()

    // Count chunks with topicId per document
    const chunks = await db.documentChunks
      .where('examProfileId').equals(examProfileId)
      .filter(c => !!c.topicId)
      .toArray()
    const topicCountByDoc = new Map<string, Set<string>>()
    for (const c of chunks) {
      if (!topicCountByDoc.has(c.documentId)) topicCountByDoc.set(c.documentId, new Set())
      if (c.topicId) topicCountByDoc.get(c.documentId)!.add(c.topicId)
    }

    // Count exercises per source document (exercise → examSource → documentId)
    const examSources = await db.examSources.where('examProfileId').equals(examProfileId).toArray()
    const exCountByDoc = new Map<string, number>()
    for (const src of examSources) {
      exCountByDoc.set(src.documentId, (exCountByDoc.get(src.documentId) ?? 0) + src.totalExercises)
    }

    for (const docId of docIds) {
      map.set(docId, {
        topicsLinked: topicCountByDoc.get(docId)?.size ?? 0,
        exerciseCount: exCountByDoc.get(docId) ?? 0,
      })
    }
    return map
  }, [examProfileId, docIds]) ?? new Map<string, DocStatusChips>()

  // Content search via hybridSearch (debounced, 3+ chars)
  useEffect(() => {
    clearTimeout(debounceRef.current)
    if (!search.trim() || search.trim().length < 3 || !examProfileId) {
      setContentResults(new Map())
      setIsSearching(false)
      return
    }
    setIsSearching(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const token = await getToken()
        const results = await hybridSearch(examProfileId, search.trim(), token ?? undefined, { topN: 10, rerank: false })
        const map = new Map<string, string>()
        for (const r of results) {
          if (!map.has(r.documentId)) {
            map.set(r.documentId, r.content.slice(0, 150).replace(/\n/g, ' '))
          }
        }
        setContentResults(map)
      } catch {
        setContentResults(new Map())
      } finally {
        setIsSearching(false)
      }
    }, 400)
    return () => clearTimeout(debounceRef.current)
  }, [search, examProfileId, getToken])

  // Filter: title match OR content match
  const filtered = search.trim()
    ? documents.filter(d =>
        d.title.toLowerCase().includes(search.toLowerCase()) || contentResults.has(d.id)
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
          placeholder={t('sources.searchPlaceholder', 'Search by title or content...')}
          className="w-full pl-9 pr-4 py-2 bg-[var(--bg-input)] border border-[var(--border-input)] rounded-lg text-sm text-[var(--text-body)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-text)]/30"
        />
        {isSearching && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-faint)] animate-spin" />
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(doc => (
          <div key={doc.id}>
            <SourceCard
              document={doc}
              onView={() => onView(doc)}
              onViewPdf={onViewPdf ? () => onViewPdf(doc) : undefined}
              onDelete={() => onDelete(doc.id)}
              onSummarize={() => onSummarize(doc)}
              onGenerateFlashcards={() => onGenerateFlashcards(doc)}
              onGeneratePracticeExam={() => onGeneratePracticeExam(doc)}
              isSummarizing={summarizingId === doc.id}
              isGeneratingFlashcards={generatingFlashcardsId === doc.id}
              deleteConfirm={deleteConfirmId === doc.id}
              hasPdfFile={pdfDocIds?.has(doc.id)}
              statusChips={statusChipsMap.get(doc.id)}
            />
            {contentResults.has(doc.id) && (
              <p className="text-xs text-[var(--text-muted)] px-3 pb-2 -mt-2 line-clamp-2 italic">
                ...{contentResults.get(doc.id)}...
              </p>
            )}
          </div>
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
