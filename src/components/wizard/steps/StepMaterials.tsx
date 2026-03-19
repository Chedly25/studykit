import { useState, useRef, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Upload, CheckCircle, Loader2, AlertCircle, ChevronRight, ChevronLeft, Sparkles } from 'lucide-react'
import { useSources } from '../../../hooks/useSources'
import { useSourceProcessing } from '../../../hooks/useSourceProcessing'
import type { WizardDraft, WizardAction } from '../../../hooks/useWizardDraft'

interface StepMaterialsProps {
  draft: WizardDraft
  dispatch: React.Dispatch<WizardAction>
  onNext: () => void
  onBack: () => void
}

export function StepMaterials({ draft, dispatch, onNext, onBack }: StepMaterialsProps) {
  const { t } = useTranslation()
  const { uploadMultiplePdfs, batchProgress, documents } = useSources(draft.profileId!)
  const { processDocument, isRunning: isProcessing } = useSourceProcessing(draft.profileId!)
  const [isUploading, setIsUploading] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const existingDocs = documents ?? []
  const hasDocuments = existingDocs.length > 0 || draft.uploadedDocumentIds.length > 0
  const processedRef = useRef(new Set<string>())

  // Auto-trigger background processing for unprocessed documents
  useEffect(() => {
    for (const doc of existingDocs) {
      if (!doc.summary && !processedRef.current.has(doc.id)) {
        processedRef.current.add(doc.id)
        processDocument(doc.id)
      }
    }
  }, [existingDocs, processDocument])

  const handleFiles = useCallback(async (files: File[]) => {
    const pdfFiles = files.filter(f => f.type === 'application/pdf' || f.name.endsWith('.pdf'))
    if (pdfFiles.length === 0) return

    setIsUploading(true)
    try {
      await uploadMultiplePdfs(pdfFiles)
      // Documents are tracked via live query — processing triggered below
    } catch (err) {
      console.error('Upload failed:', err)
    } finally {
      setIsUploading(false)
    }
  }, [uploadMultiplePdfs])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    handleFiles(Array.from(e.dataTransfer.files))
  }, [handleFiles])

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold text-[var(--text-heading)] mb-2">
        {t('wizard.materialsTitle', 'Upload your materials')}
      </h2>
      <p className="text-[var(--text-muted)] mb-6">
        {t('wizard.materialsSubtitle', 'Add your study materials — PDFs, textbooks, notes. You can always add more later.')}
      </p>

      {/* Existing documents */}
      {existingDocs.length > 0 && (
        <div className="glass-card p-4 mb-4">
          <h3 className="text-sm font-semibold text-[var(--text-heading)] mb-2">
            {t('wizard.uploadedDocs', 'Uploaded documents')}
          </h3>
          <div className="space-y-1.5">
            {existingDocs.map(doc => (
              <div key={doc.id} className="flex items-center gap-2 text-sm">
                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                <span className="text-[var(--text-body)] truncate">{doc.title}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Background processing indicator */}
      {isProcessing && (
        <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg bg-[var(--accent-bg)] text-sm text-[var(--accent-text)]">
          <Sparkles className="w-4 h-4 animate-pulse" />
          {t('wizard.processingMaterials', 'Processing your materials in background — concept cards will be ready soon.')}
        </div>
      )}

      {/* Upload zone */}
      {isUploading ? (
        <div className="glass-card p-8 text-center">
          <Loader2 className="w-10 h-10 text-[var(--accent-text)] mx-auto mb-4 animate-spin" />
          <h3 className="text-lg font-semibold text-[var(--text-heading)] mb-2">
            {t('dashboard.onboarding.uploading')}
          </h3>
          {batchProgress && (
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
              {batchProgress.currentFile && (
                <div className="flex items-center gap-2 text-sm">
                  <Loader2 className="w-4 h-4 text-[var(--accent-text)] animate-spin flex-shrink-0" />
                  <span className="text-[var(--text-muted)] truncate">{batchProgress.currentFile}</span>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div
          onDrop={handleDrop}
          onDragOver={e => { e.preventDefault(); setIsDragOver(true) }}
          onDragLeave={e => { e.preventDefault(); setIsDragOver(false) }}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
            isDragOver
              ? 'border-[var(--accent-text)] bg-[var(--accent-bg)]'
              : 'border-[var(--border-card)] hover:border-[var(--accent-text)]/50 hover:bg-[var(--accent-bg)]/50'
          }`}
        >
          <Upload className={`w-10 h-10 mx-auto mb-4 ${isDragOver ? 'text-[var(--accent-text)]' : 'text-[var(--text-muted)]'}`} />
          <p className="font-medium text-[var(--text-heading)] mb-1">
            {hasDocuments
              ? t('wizard.addMoreDocs', 'Add more documents')
              : t('dashboard.onboarding.dropHere')
            }
          </p>
          <p className="text-sm text-[var(--text-muted)]">
            {t('dashboard.onboarding.orBrowse')}
          </p>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        multiple
        onChange={e => handleFiles(Array.from(e.target.files ?? []))}
        className="hidden"
      />

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
              {t('common.skip', 'Skip')}
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
