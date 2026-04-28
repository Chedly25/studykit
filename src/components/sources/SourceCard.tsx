import { useTranslation } from 'react-i18next'
import { FileText, FileType, ClipboardPaste, Trash2, Eye, Sparkles, BookOpen, ClipboardCheck, Loader2, FileSearch2 } from 'lucide-react'
import type { Document } from '../../db/schema'

const typeIcons: Record<string, typeof FileText> = {
  pdf: FileType,
  text: FileText,
  paste: ClipboardPaste,
  url: BookOpen,
  image: FileText,
}

export interface DocStatusChips {
  topicsLinked: number
  exerciseCount: number
}

interface Props {
  document: Document
  onView: () => void
  onViewPdf?: () => void
  onDelete: () => void
  onSummarize: () => void
  onGenerateFlashcards: () => void
  onGeneratePracticeExam: () => void
  isSummarizing?: boolean
  isGeneratingFlashcards?: boolean
  deleteConfirm?: boolean
  hasPdfFile?: boolean
  statusChips?: DocStatusChips
}

export function SourceCard({
  document: doc,
  onView,
  onDelete,
  onSummarize,
  onGenerateFlashcards,
  onGeneratePracticeExam,
  isSummarizing,
  isGeneratingFlashcards,
  deleteConfirm,
  onViewPdf,
  hasPdfFile,
  statusChips,
}: Props) {
  const { t } = useTranslation()
  const Icon = typeIcons[doc.sourceType] ?? FileText
  const date = new Date(doc.createdAt).toLocaleDateString()

  return (
    <div className="glass-card p-4 flex flex-col gap-3 group">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-[var(--accent-bg)] flex items-center justify-center flex-shrink-0">
          <Icon size={18} className="text-[var(--accent-text)]" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm text-[var(--text-heading)] truncate" title={doc.title}>
            {doc.title}
          </h3>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            {doc.sourceType.toUpperCase()} &middot; {date}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 text-xs text-[var(--text-faint)]">
        <span>{doc.wordCount.toLocaleString()} words</span>
        <span>&middot;</span>
        <span>{doc.chunkCount} chunks</span>
        {doc.summary && (
          <>
            <span>&middot;</span>
            <span className="text-[var(--color-success)]">Summarized</span>
          </>
        )}
      </div>

      {/* Agent status chips */}
      {statusChips && (statusChips.topicsLinked > 0 || statusChips.exerciseCount > 0) && (
        <div className="flex flex-wrap gap-1">
          {statusChips.topicsLinked > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-info-bg)] text-[var(--color-info)]">{statusChips.topicsLinked} topics linked</span>
          )}
          {statusChips.exerciseCount > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-warning-bg)] text-[var(--color-warning)]">{statusChips.exerciseCount} exercises</span>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-1.5 mt-auto pt-1">
        <button
          onClick={onView}
          className="btn-action text-xs px-2 py-1 rounded-md bg-[var(--bg-input)] text-[var(--text-muted)] hover:text-[var(--accent-text)] flex items-center gap-1"
        >
          <Eye size={12} /> View
        </button>
        {hasPdfFile && onViewPdf && (
          <button
            onClick={onViewPdf}
            className="btn-action text-xs px-2 py-1 rounded-md bg-[var(--bg-input)] text-[var(--text-muted)] hover:text-[var(--accent-text)] flex items-center gap-1"
          >
            <FileSearch2 size={12} /> PDF
          </button>
        )}
        <button
          onClick={onSummarize}
          disabled={isSummarizing}
          className="btn-action text-xs px-2 py-1 rounded-md bg-[var(--bg-input)] text-[var(--text-muted)] hover:text-[var(--accent-text)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
        >
          {isSummarizing ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
          {isSummarizing ? t('sources.summarizing') : 'Summarize'}
        </button>
        <button
          onClick={onGenerateFlashcards}
          disabled={isGeneratingFlashcards}
          className="btn-action text-xs px-2 py-1 rounded-md bg-[var(--bg-input)] text-[var(--text-muted)] hover:text-[var(--accent-text)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
        >
          {isGeneratingFlashcards ? <Loader2 size={12} className="animate-spin" /> : <BookOpen size={12} />}
          Flashcards
        </button>
        <button
          onClick={onGeneratePracticeExam}
          className="btn-action text-xs px-2 py-1 rounded-md bg-[var(--bg-input)] text-[var(--text-muted)] hover:text-[var(--accent-text)] flex items-center gap-1"
        >
          <ClipboardCheck size={12} /> Exam
        </button>
        <button
          onClick={onDelete}
          className={`btn-action text-xs px-2 py-1 rounded-md bg-[var(--bg-input)] flex items-center gap-1 ml-auto ${
            deleteConfirm ? 'text-[var(--color-error)] font-medium' : 'text-[var(--color-error)] hover:text-[var(--color-error)]'
          }`}
        >
          <Trash2 size={12} /> {deleteConfirm ? t('sources.confirmDelete') : 'Delete'}
        </button>
      </div>
    </div>
  )
}
