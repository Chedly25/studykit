import { useState, useRef, useCallback, useEffect } from 'react'
import * as Sentry from '@sentry/react'
import { useTranslation } from 'react-i18next'
import { Upload, CheckCircle, Loader2, AlertCircle, ChevronRight, ChevronLeft, Sparkles, BookOpen, FileText } from 'lucide-react'
import { useSources } from '../../../hooks/useSources'
import { useSourceProcessing } from '../../../hooks/useSourceProcessing'
import { useExamProcessing } from '../../../hooks/useExamProcessing'
import type { WizardDraft, WizardAction } from '../../../hooks/useWizardDraft'

interface StepMaterialsProps {
  draft: WizardDraft
  dispatch: React.Dispatch<WizardAction>
  onNext: () => void
  onBack: () => void
}

export function StepMaterials({ draft, dispatch: _dispatch, onNext, onBack }: StepMaterialsProps) {
  const { t } = useTranslation()
  const { uploadMultiplePdfs, batchProgress, documents } = useSources(draft.profileId!)
  const { processDocument, isRunning: isCourseProcessing } = useSourceProcessing(draft.profileId!)
  const { processExamDocument, isRunning: isExamProcessing } = useExamProcessing(draft.profileId!)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadCategory, setUploadCategory] = useState<'course' | 'exam'>('course')
  const courseInputRef = useRef<HTMLInputElement>(null)
  const examInputRef = useRef<HTMLInputElement>(null)

  const existingDocs = documents ?? []
  const courseDocs = existingDocs.filter(d => d.category !== 'exam')
  const examDocs = existingDocs.filter(d => d.category === 'exam')
  const hasDocuments = existingDocs.length > 0
  const processedRef = useRef(new Set<string>())

  // Auto-trigger processing for unprocessed course documents
  useEffect(() => {
    for (const doc of existingDocs) {
      if (!doc.summary && !processedRef.current.has(doc.id) && doc.category !== 'exam') {
        processedRef.current.add(doc.id)
        processDocument(doc.id)
      }
    }
  }, [existingDocs, processDocument])

  // Auto-trigger exam processing for unprocessed exam documents
  useEffect(() => {
    for (const doc of existingDocs) {
      if (doc.category === 'exam' && !processedRef.current.has(doc.id)) {
        // Check if already has an ExamSource (processed)
        processedRef.current.add(doc.id)
        processExamDocument(doc.id)
      }
    }
  }, [existingDocs, processExamDocument])

  const handleCourseFiles = useCallback(async (files: File[]) => {
    const pdfFiles = files.filter(f => f.type === 'application/pdf' || f.name.endsWith('.pdf'))
    if (pdfFiles.length === 0) return
    setIsUploading(true)
    setUploadCategory('course')
    try {
      await uploadMultiplePdfs(pdfFiles, 'course')
    } catch (err) {
      Sentry.captureException(err instanceof Error ? err : new Error('Upload failed: ' + String(err)))
    } finally {
      setIsUploading(false)
    }
  }, [uploadMultiplePdfs])

  const handleExamFiles = useCallback(async (files: File[]) => {
    const pdfFiles = files.filter(f => f.type === 'application/pdf' || f.name.endsWith('.pdf'))
    if (pdfFiles.length === 0) return
    setIsUploading(true)
    setUploadCategory('exam')
    try {
      await uploadMultiplePdfs(pdfFiles, 'exam')
    } catch (err) {
      Sentry.captureException(err instanceof Error ? err : new Error('Upload failed: ' + String(err)))
    } finally {
      setIsUploading(false)
    }
  }, [uploadMultiplePdfs])

  const isProcessing = isCourseProcessing || isExamProcessing

  return (
    <div className="max-w-3xl mx-auto">
      <h2 className="text-2xl font-bold text-[var(--text-heading)] mb-2">
        {t('wizard.materialsTitle')}
      </h2>
      <p className="text-[var(--text-muted)] mb-6">
        {t('wizard.materialsSubtitleV2')}
      </p>

      {/* Processing indicator */}
      {isProcessing && (
        <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg bg-[var(--accent-bg)] text-sm text-[var(--accent-text)]">
          <Sparkles className="w-4 h-4 animate-pulse" />
          {isCourseProcessing
            ? t('wizard.processingCourses')
            : t('wizard.processingExams')}
        </div>
      )}

      {/* Upload loading state */}
      {isUploading && batchProgress ? (
        <div className="glass-card p-8 text-center mb-4">
          <Loader2 className="w-10 h-10 text-[var(--accent-text)] mx-auto mb-4 animate-spin" />
          <h3 className="text-lg font-semibold text-[var(--text-heading)] mb-2">
            {uploadCategory === 'course' ? 'Uploading courses...' : 'Uploading exams...'}
          </h3>
          <div className="mt-4 space-y-1.5 max-w-sm mx-auto">
            {batchProgress.results.map((r, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                {r.status === 'done' ? (
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                ) : r.status === 'error' ? (
                  <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                ) : (
                  <Loader2 className="w-4 h-4 text-[var(--accent-text)] animate-spin flex-shrink-0" />
                )}
                <span className="text-[var(--text-body)] truncate">{r.fileName}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Two-box upload */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {/* Courses box */}
          <div className="glass-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <BookOpen className="w-5 h-5 text-[var(--accent-text)]" />
              <h3 className="text-sm font-semibold text-[var(--text-heading)]">
                {t('wizard.courseMaterials')}
              </h3>
            </div>
            <p className="text-xs text-[var(--text-muted)] mb-3">
              {t('wizard.courseDesc')}
            </p>

            {/* Existing course docs */}
            {courseDocs.length > 0 && (
              <div className="space-y-1 mb-3">
                {courseDocs.map(doc => (
                  <div key={doc.id} className="flex items-center gap-1.5 text-xs">
                    <CheckCircle className="w-3 h-3 text-green-500 flex-shrink-0" />
                    <span className="text-[var(--text-body)] truncate">{doc.title}</span>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={() => courseInputRef.current?.click()}
              className="w-full border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors border-[var(--border-card)] hover:border-[var(--accent-text)]/50 hover:bg-[var(--accent-bg)]/50"
            >
              <Upload className="w-6 h-6 mx-auto mb-2 text-[var(--text-muted)]" />
              <p className="text-xs text-[var(--text-muted)]">
                {courseDocs.length > 0 ? 'Add more courses' : 'Drop PDFs here or click'}
              </p>
            </button>
            <input
              ref={courseInputRef}
              type="file"
              accept=".pdf"
              multiple
              onChange={e => handleCourseFiles(Array.from(e.target.files ?? []))}
              className="hidden"
            />
          </div>

          {/* Exams box */}
          <div className="glass-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="w-5 h-5 text-amber-500" />
              <h3 className="text-sm font-semibold text-[var(--text-heading)]">
                {t('wizard.examMaterials')}
              </h3>
            </div>
            <p className="text-xs text-[var(--text-muted)] mb-3">
              {t('wizard.examDesc')}
            </p>

            {/* Existing exam docs */}
            {examDocs.length > 0 && (
              <div className="space-y-1 mb-3">
                {examDocs.map(doc => (
                  <div key={doc.id} className="flex items-center gap-1.5 text-xs">
                    <CheckCircle className="w-3 h-3 text-amber-500 flex-shrink-0" />
                    <span className="text-[var(--text-body)] truncate">{doc.title}</span>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={() => examInputRef.current?.click()}
              className="w-full border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors border-[var(--border-card)] hover:border-amber-500/50 hover:bg-amber-500/5"
            >
              <Upload className="w-6 h-6 mx-auto mb-2 text-[var(--text-muted)]" />
              <p className="text-xs text-[var(--text-muted)]">
                {examDocs.length > 0 ? 'Add more exams' : 'Drop exam PDFs here or click'}
              </p>
            </button>
            <input
              ref={examInputRef}
              type="file"
              accept=".pdf"
              multiple
              onChange={e => handleExamFiles(Array.from(e.target.files ?? []))}
              className="hidden"
            />
          </div>
        </div>
      )}

      <div className="flex justify-between mt-6">
        <button onClick={onBack} className="btn-secondary px-4 py-2 flex items-center gap-2">
          <ChevronLeft className="w-4 h-4" /> {t('common.back')}
        </button>
        <div className="flex items-center gap-3">
          {!hasDocuments && (
            <button
              onClick={onNext}
              className="text-sm text-[var(--text-muted)] hover:text-[var(--text-body)] transition-colors"
            >
              {t('common.skip')}
            </button>
          )}
          <button
            onClick={onNext}
            className="btn-primary px-6 py-2 flex items-center gap-2"
          >
            {t('common.next')} <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
