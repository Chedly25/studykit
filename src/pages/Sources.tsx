import { useState, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@clerk/clerk-react'
import { toast } from 'sonner'
import { FileText, Loader2, ClipboardCheck, BookOpen, ListChecks, Sparkles, Lock, FolderOpen } from 'lucide-react'
import { FirstVisitHint } from '../components/FirstVisitHint'
import { Link, useNavigate } from 'react-router-dom'
import { useExamProfile } from '../hooks/useExamProfile'
import { useSubscription } from '../hooks/useSubscription'
import { useSources } from '../hooks/useSources'
import { useAgent } from '../hooks/useAgent'
import { useKnowledgeGraph } from '../hooks/useKnowledgeGraph'
import { useSourceCoverage } from '../hooks/useSourceCoverage'
import { useSourceProcessing } from '../hooks/useSourceProcessing'
import { useExamProcessing } from '../hooks/useExamProcessing'
import { useLiveQuery } from 'dexie-react-hooks'
import { SourceUploadBar } from '../components/sources/SourceUploadBar'
import { SourceList } from '../components/sources/SourceList'
import { SourceCoverageChart } from '../components/sources/SourceCoverageChart'
import { PasteTextModal } from '../components/sources/PasteTextModal'
import { NotesEditor } from '../components/sources/NotesEditor'
import { SourceDetailModal } from '../components/sources/SourceDetailModal'
import { PdfViewer } from '../components/sources/PdfViewer'
import { SourceProcessingBanner } from '../components/sources/SourceProcessingBanner'
import { BatchUploadProgress } from '../components/sources/BatchUploadProgress'
import { HighlightsList } from '../components/sources/HighlightsList'
import { buildSummaryPrompt, buildFlashcardPrompt } from '../lib/sourceActions'
import { getChunksByDocumentId } from '../lib/sources'
import { db } from '../db'
import type { Document } from '../db/schema'

export default function Sources() {
  const { t } = useTranslation()
  const { activeProfile } = useExamProfile()
  const profileId = activeProfile?.id
  const { subjects, topics, dailyLogs } = useKnowledgeGraph(profileId)
  const { isPro } = useSubscription()
  const { processDocument, cancel: cancelProcessing, isRunning: isProcessingDoc, progress: processingProgress, error: processingError } = useSourceProcessing(profileId)
  const onDocumentReady = useCallback(
    (docId: string) => { processDocument(docId) },
    [processDocument],
  )
  const sourceOptions = useMemo(
    () => ({ onDocumentReady: isPro ? onDocumentReady : undefined }),
    [isPro, onDocumentReady],
  )
  const {
    documents, totalChunks,
    uploadPdf, uploadMultiplePdfs, pasteText, saveNote, deleteSource,
    isProcessing, processingStatus, batchProgress,
    lastUploadError, clearUploadError,
  } = useSources(profileId, sourceOptions)

  const { coverage } = useSourceCoverage(profileId)
  const { processExamDocument, isRunning: isExamProcessing } = useExamProcessing(profileId)
  const [categoryFilter, setCategoryFilter] = useState<'' | 'course' | 'exam' | 'highlights'>('')
  const [tagFilter, setTagFilter] = useState<string>('')

  // Compute unique tags across all documents
  const allTags = useMemo(() => {
    const tagSet = new Set<string>()
    for (const doc of documents) {
      if (doc.tags) {
        try {
          const tags = JSON.parse(doc.tags) as string[]
          tags.forEach(t => tagSet.add(t))
        } catch { /* ignore */ }
      }
    }
    return [...tagSet].sort()
  }, [documents])
  const [pdfViewDoc, setPdfViewDoc] = useState<Document | null>(null)

  // Track which documents have stored PDF files
  const pdfDocIds = useLiveQuery(async () => {
    if (!profileId) return new Set<string>()
    const files = await db.documentFiles.where('examProfileId').equals(profileId).toArray()
    return new Set(files.map(f => f.documentId))
  }, [profileId]) ?? new Set<string>()

  // Count exercises per exam source
  const examSourceCounts = useLiveQuery(async () => {
    if (!profileId) return new Map<string, number>()
    const sources = await db.examSources.where('examProfileId').equals(profileId).toArray()
    const map = new Map<string, number>()
    for (const s of sources) map.set(s.documentId, s.totalExercises)
    return map
  }, [profileId]) ?? new Map<string, number>()
  const agent = useAgent({ profile: activeProfile, subjects, topics, dailyLogs })
  const navigate = useNavigate()
  const { getToken } = useAuth()

  // Count unprocessed and processed documents
  const unprocessedDocs = documents.filter(d => !d.summary)
  const processedCount = documents.filter(d => !!d.summary).length
  const hasFreeProcessingSlot = !isPro && processedCount < 3

  // Batch process all unprocessed documents sequentially
  const [isBatchProcessing, setIsBatchProcessing] = useState(false)
  const handleProcessAll = async () => {
    setIsBatchProcessing(true)
    let errorCount = 0
    try {
      for (const doc of unprocessedDocs) {
        try {
          await processDocument(doc.id)
        } catch {
          errorCount++
        }
      }
      if (errorCount > 0) {
        const { toast } = await import('sonner')
        toast.error(`${errorCount} document(s) failed to process`)
      }
    } finally {
      setIsBatchProcessing(false)
    }
  }

  const [showPaste, setShowPaste] = useState(false)
  const [showNotes, setShowNotes] = useState(false)
  const [viewDoc, setViewDoc] = useState<Document | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [summarizing, setSummarizing] = useState<string | null>(null)
  const [generatingFlashcards, setGeneratingFlashcards] = useState<string | null>(null)
  const [extractingConcepts, setExtractingConcepts] = useState<string | null>(null)

  if (!activeProfile) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <FileText className="w-12 h-12 text-[var(--accent-text)] mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-[var(--text-heading)] mb-4">{t('sources.title')}</h1>
        <p className="text-[var(--text-muted)] mb-6">{t('ai.createProfileFirst')}</p>
        <Link to="/exam-profile" className="btn-primary px-6 py-2.5 inline-block">Create Profile</Link>
      </div>
    )
  }

  const handleUploadPdfs = (files: File[]) => {
    if (files.length === 1) {
      uploadPdf(files[0])
    } else {
      uploadMultiplePdfs(files)
    }
  }

  const handleDelete = async (docId: string) => {
    if (deleteConfirm === docId) {
      await deleteSource(docId)
      setDeleteConfirm(null)
      toast.success(t('sources.sourceDeleted'))
    } else {
      setDeleteConfirm(docId)
      setTimeout(() => setDeleteConfirm(null), 3000)
    }
  }

  const handleSummarize = async (doc: Document) => {
    if (doc.summary) {
      setViewDoc(doc)
      return
    }
    setViewDoc(doc)
    setSummarizing(doc.id)
    try {
      const chunks = await getChunksByDocumentId(doc.id)
      const prompt = buildSummaryPrompt(doc.title, chunks.map(c => c.content))
      const resultMessages = await agent.sendMessage(prompt)
      // Extract text from last assistant message (content can be string or ContentBlock[])
      const lastMsg = resultMessages.filter(m => m.role === 'assistant').pop()
      let summaryText = ''
      if (lastMsg) {
        if (typeof lastMsg.content === 'string') {
          summaryText = lastMsg.content
        } else if (Array.isArray(lastMsg.content)) {
          summaryText = lastMsg.content
            .filter(b => b.type === 'text' && 'text' in b)
            .map(b => ('text' in b ? b.text : ''))
            .join('')
        }
      }
      if (summaryText) {
        await db.documents.update(doc.id, { summary: summaryText })
        setViewDoc({ ...doc, summary: summaryText })
        toast.success(t('sources.summaryGenerated'))
      }
    } catch {
      toast.error(t('sources.summaryFailed'))
    } finally {
      setSummarizing(null)
    }
  }

  const handleGenerateFlashcards = async (doc: Document) => {
    setGeneratingFlashcards(doc.id)
    try {
      const chunks = await getChunksByDocumentId(doc.id)
      const prompt = buildFlashcardPrompt(doc.title, chunks.map(c => c.content))
      await agent.sendMessage(prompt)
      toast.success(t('sources.flashcardsGenerated'))
    } catch {
      toast.error(t('sources.flashcardsFailed'))
    } finally {
      setGeneratingFlashcards(null)
    }
  }

  const handleGeneratePracticeExam = (doc: Document) => {
    navigate(`/practice-exam?sourceId=${doc.id}`)
  }

  const handleExtractConcepts = async (doc: Document) => {
    if (!profileId) return
    setExtractingConcepts(doc.id)
    try {
      const token = await getToken()
      if (!token) throw new Error('Auth required')
      const { autoMapSourceToTopics } = await import('../ai/tools/conceptTools')
      const result = await autoMapSourceToTopics(profileId, { documentId: doc.id }, token)
      const parsed = JSON.parse(result)
      if (parsed.error) {
        toast.error(parsed.error)
      } else {
        toast.success(`Mapped ${parsed.mappingsApplied} chunks to topics. Found: ${(parsed.conceptsFound as string[]).slice(0, 5).join(', ')}`)
      }
    } catch {
      toast.error('Failed to extract concepts')
    } finally {
      setExtractingConcepts(null)
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 animate-fade-in">
      {profileId && (
        <FirstVisitHint
          hintKey="sources"
          profileId={profileId}
          icon={FolderOpen}
          title={t('hints.sourcesTitle')}
          description={t('hints.sourcesDescription')}
        />
      )}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-heading)] flex items-center gap-2">
            <FileText className="w-6 h-6 text-[var(--accent-text)]" />
            {t('sources.title')}
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            {t('sources.documentCount', { count: documents.length })} &middot; {t('sources.chunks', { count: totalChunks })}
          </p>
        </div>
      </div>

      {/* Category filter tabs */}
      <div className="flex gap-1 mb-4">
        {([
          { key: '' as const, label: t('sources.all') },
          { key: 'course' as const, label: t('sources.courses') },
          { key: 'exam' as const, label: t('sources.exams') },
          { key: 'highlights' as const, label: t('sources.highlights', 'Highlights') },
        ]).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setCategoryFilter(key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              categoryFilter === key
                ? 'bg-[var(--accent-text)] text-white'
                : 'bg-[var(--bg-input)] text-[var(--text-muted)] hover:text-[var(--text-body)]'
            }`}
          >
            {label} ({key === '' ? documents.length : documents.filter(d => key === 'course' ? d.category !== 'exam' : d.category === 'exam').length})
          </button>
        ))}
      </div>

      {/* Tag filter bar */}
      {allTags.length > 0 && (
        <div className="flex gap-1 mb-4 flex-wrap">
          {allTags.map(tag => (
            <button
              key={tag}
              onClick={() => setTagFilter(f => f === tag ? '' : tag)}
              className={`px-2 py-1 rounded-md text-[10px] font-medium transition-colors ${
                tagFilter === tag
                  ? 'bg-[var(--accent-text)] text-white'
                  : 'bg-[var(--bg-input)] text-[var(--text-muted)] hover:text-[var(--text-body)]'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {isProcessing && !batchProgress && (
        <div className="glass-card p-4 mb-4 flex items-center gap-3">
          <Loader2 className="w-5 h-5 text-[var(--accent-text)] animate-spin" />
          <span className="text-sm text-[var(--text-body)]">{processingStatus || t('common.loading')}</span>
        </div>
      )}

      {batchProgress && (
        <BatchUploadProgress progress={batchProgress} />
      )}

      {isProcessingDoc && (
        <SourceProcessingBanner
          progress={processingProgress}
          error={processingError}
          onCancel={cancelProcessing}
        />
      )}

      {/* Persistent upload error card with guidance */}
      {lastUploadError && (
        <div className="glass-card p-4 mb-4 border-l-4 border-red-500 animate-fade-in">
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <p className="text-sm font-medium text-[var(--text-heading)] mb-1">{t('sources.uploadFailed', 'Upload failed')}</p>
              <p className="text-xs text-[var(--text-muted)]">{lastUploadError}</p>
              <p className="text-xs text-[var(--text-muted)] mt-2">
                {lastUploadError.includes('maximum file size') && t('sources.errorGuidanceSize', 'Try compressing the PDF or splitting it into smaller parts.')}
                {lastUploadError.includes('scanned') && t('sources.errorGuidanceScanned', 'Try running OCR on the PDF first, or upload a text-based version.')}
                {lastUploadError.includes('network') && t('sources.errorGuidanceNetwork', 'Check your internet connection and try again.')}
              </p>
            </div>
            <button onClick={clearUploadError} className="text-xs text-[var(--text-muted)] hover:text-[var(--text-body)]">Dismiss</button>
          </div>
        </div>
      )}

      {unprocessedDocs.length > 0 && !isProcessingDoc && (
        <div className="glass-card p-3 mb-4 flex items-center justify-between">
          <span className="text-sm text-[var(--text-body)]">
            {isPro
              ? t('sources.readyToProcess', { count: unprocessedDocs.length })
              : hasFreeProcessingSlot
                ? t('sources.freeProcessingAvailable', { count: unprocessedDocs.length })
                : t('sources.upgradeToProcess', { count: unprocessedDocs.length })
            }
          </span>
          {isPro || hasFreeProcessingSlot ? (
            <button
              onClick={hasFreeProcessingSlot ? () => processDocument(unprocessedDocs[0].id) : handleProcessAll}
              disabled={isBatchProcessing}
              className="btn-primary text-sm px-4 py-1.5 disabled:opacity-50"
            >
              {isBatchProcessing ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  {t('sources.processingAll')}
                </span>
              ) : hasFreeProcessingSlot ? (
                t('sources.processFirst')
              ) : (
                t('sources.processAll')
              )}
            </button>
          ) : (
            <Link to="/pricing" className="btn-primary text-sm px-4 py-1.5 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" /> {t('common.upgrade')}
            </Link>
          )}
        </div>
      )}

      <div className="mb-6">
        <SourceUploadBar
          onUploadPdfs={handleUploadPdfs}
          onPasteText={() => setShowPaste(true)}
          onWriteNote={() => setShowNotes(true)}
          disabled={isProcessing}
        />
      </div>

      {documents.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mb-6">
          {([
            { icon: ClipboardCheck, label: t('sources.discovery.practiceExam'), desc: t('sources.discovery.practiceExamDesc'), to: '/practice-exam' },
            { icon: BookOpen, label: t('sources.discovery.flashcards'), desc: t('sources.discovery.flashcardsDesc'), to: '/flashcard-maker' },
            { icon: ListChecks, label: t('exercises.title'), desc: t('sources.discovery.chatDesc'), to: '/exercises' },
          ] as const).map(({ icon: Icon, label, desc, to }) => (
            <Link key={to} to={to} className="glass-card glass-card-hover p-3 flex items-start gap-3 group">
              <div className="w-9 h-9 rounded-lg bg-[var(--accent-bg)] flex items-center justify-center flex-shrink-0">
                <Icon className="w-4 h-4 text-[var(--accent-text)]" />
              </div>
              <div>
                <span className="text-sm font-semibold text-[var(--text-heading)] group-hover:text-[var(--accent-text)] transition-colors">{label}</span>
                <p className="text-xs text-[var(--text-muted)]">{desc}</p>
              </div>
            </Link>
          ))}
          {topics.length > 0 && (
            isPro ? (
              <button
                onClick={() => {
                  const firstDoc = documents[0]
                  if (firstDoc) handleExtractConcepts(firstDoc)
                }}
                disabled={!!extractingConcepts}
                className="glass-card glass-card-hover p-3 flex items-start gap-3 group text-left disabled:opacity-50"
              >
                <div className="w-9 h-9 rounded-lg bg-[var(--accent-bg)] flex items-center justify-center flex-shrink-0">
                  {extractingConcepts ? <Loader2 className="w-4 h-4 text-[var(--accent-text)] animate-spin" /> : <Sparkles className="w-4 h-4 text-[var(--accent-text)]" />}
                </div>
                <div>
                  <span className="text-sm font-semibold text-[var(--text-heading)] group-hover:text-[var(--accent-text)] transition-colors">{t('sources.discovery.extractConcepts')}</span>
                  <p className="text-xs text-[var(--text-muted)]">{t('sources.discovery.extractConceptsDesc')}</p>
                </div>
              </button>
            ) : (
              <Link to="/pricing" className="glass-card glass-card-hover p-3 flex items-start gap-3 group">
                <div className="w-9 h-9 rounded-lg bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                  <Lock className="w-4 h-4 text-purple-500" />
                </div>
                <div>
                  <span className="text-sm font-semibold text-[var(--text-heading)] group-hover:text-[var(--accent-text)] transition-colors">Extract Concepts — Pro</span>
                  <p className="text-xs text-[var(--text-muted)]">AI maps your documents to study topics</p>
                </div>
              </Link>
            )
          )}
        </div>
      )}

      {coverage && (
        <div className="mb-6">
          <SourceCoverageChart coverage={coverage} />
        </div>
      )}

      {/* Exam extraction banner */}
      {categoryFilter === 'exam' && documents.filter(d => d.category === 'exam').some(d => !examSourceCounts.has(d.id)) && !isExamProcessing && (
        <div className="glass-card p-3 mb-4 flex items-center justify-between">
          <span className="text-sm text-[var(--text-body)]">
            {documents.filter(d => d.category === 'exam' && !examSourceCounts.has(d.id)).length} exam(s) ready for exercise extraction
          </span>
          {isPro ? (
            <button
              onClick={async () => {
                for (const doc of documents.filter(d => d.category === 'exam' && !examSourceCounts.has(d.id))) {
                  await processExamDocument(doc.id)
                }
              }}
              className="btn-primary text-sm px-4 py-1.5"
            >
              Extract Exercises
            </button>
          ) : (
            <Link to="/pricing" className="btn-primary text-sm px-4 py-1.5 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" /> Upgrade
            </Link>
          )}
        </div>
      )}

      {isExamProcessing && (
        <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg bg-amber-500/10 text-sm text-amber-600">
          <Loader2 className="w-4 h-4 animate-spin" />
          Parsing exam exercises...
        </div>
      )}

      {categoryFilter === 'highlights' && profileId ? (
        <HighlightsList examProfileId={profileId} />
      ) : <SourceList
        documents={documents.filter(d => {
          if (categoryFilter && categoryFilter !== 'highlights' && (categoryFilter === 'course' ? d.category === 'exam' : d.category !== 'exam')) return false
          if (tagFilter) {
            try {
              const tags = d.tags ? JSON.parse(d.tags) as string[] : []
              if (!tags.includes(tagFilter)) return false
            } catch { return false }
          }
          return true
        })}
        examProfileId={profileId}
        onView={setViewDoc}
        onViewPdf={(doc: Document) => navigate(`/read/${doc.id}`)}
        onDelete={handleDelete}
        onSummarize={handleSummarize}
        onGenerateFlashcards={handleGenerateFlashcards}
        onGeneratePracticeExam={handleGeneratePracticeExam}
        summarizingId={summarizing}
        generatingFlashcardsId={generatingFlashcards}
        deleteConfirmId={deleteConfirm}
        pdfDocIds={pdfDocIds}
      />}

      <PasteTextModal
        open={showPaste}
        onClose={() => setShowPaste(false)}
        onSave={pasteText}
      />

      <NotesEditor
        open={showNotes}
        onClose={() => setShowNotes(false)}
        onSave={saveNote}
      />

      <SourceDetailModal
        document={viewDoc}
        onClose={() => setViewDoc(null)}
        isSummarizing={!!summarizing && summarizing === viewDoc?.id}
      />

      {pdfViewDoc && (
        <PdfViewer
          documentId={pdfViewDoc.id}
          title={pdfViewDoc.title}
          onClose={() => setPdfViewDoc(null)}
        />
      )}
    </div>
  )
}
