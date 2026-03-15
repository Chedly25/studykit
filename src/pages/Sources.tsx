import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FileText, Loader2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useExamProfile } from '../hooks/useExamProfile'
import { useSources } from '../hooks/useSources'
import { useAgent } from '../hooks/useAgent'
import { useKnowledgeGraph } from '../hooks/useKnowledgeGraph'
import { useSourceCoverage } from '../hooks/useSourceCoverage'
import { SourceUploadBar } from '../components/sources/SourceUploadBar'
import { SourceList } from '../components/sources/SourceList'
import { SourceCoverageChart } from '../components/sources/SourceCoverageChart'
import { PasteTextModal } from '../components/sources/PasteTextModal'
import { NotesEditor } from '../components/sources/NotesEditor'
import { SourceDetailModal } from '../components/sources/SourceDetailModal'
import { buildSummaryPrompt, buildFlashcardPrompt } from '../lib/sourceActions'
import { getChunksByDocumentId } from '../lib/sources'
import { db } from '../db'
import type { Document } from '../db/schema'

export default function Sources() {
  const { t } = useTranslation()
  const { activeProfile } = useExamProfile()
  const profileId = activeProfile?.id
  const { subjects, topics, dailyLogs } = useKnowledgeGraph(profileId)
  const {
    documents, totalChunks,
    uploadPdf, pasteText, saveNote, deleteSource,
    isProcessing, processingStatus,
  } = useSources(profileId)

  const { coverage } = useSourceCoverage(profileId)
  const agent = useAgent({ profile: activeProfile, subjects, topics, dailyLogs })
  const navigate = useNavigate()

  const [showPaste, setShowPaste] = useState(false)
  const [showNotes, setShowNotes] = useState(false)
  const [viewDoc, setViewDoc] = useState<Document | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [summarizing, setSummarizing] = useState<string | null>(null)

  if (!activeProfile) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <FileText className="w-12 h-12 text-[var(--accent-text)] mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-[var(--text-heading)] mb-4">{t('sources.title')}</h1>
        <p className="text-[var(--text-muted)] mb-6">{t('ai.createProfileFirst')}</p>
        <a href="/exam-profile" className="btn-primary px-6 py-2.5 inline-block">Create Profile</a>
      </div>
    )
  }

  const handleDelete = async (docId: string) => {
    if (deleteConfirm === docId) {
      await deleteSource(docId)
      setDeleteConfirm(null)
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
    setSummarizing(doc.id)
    try {
      const chunks = await getChunksByDocumentId(doc.id)
      const prompt = buildSummaryPrompt(doc.title, chunks.map(c => c.content))
      await agent.sendMessage(prompt)
      // Extract summary from the agent's final response
      const lastMsg = agent.messages[agent.messages.length - 1]
      if (lastMsg && typeof lastMsg.content === 'string') {
        await db.documents.update(doc.id, { summary: lastMsg.content })
      }
    } finally {
      setSummarizing(null)
    }
  }

  const handleGenerateFlashcards = async (doc: Document) => {
    const chunks = await getChunksByDocumentId(doc.id)
    const prompt = buildFlashcardPrompt(doc.title, chunks.map(c => c.content))
    await agent.sendMessage(prompt)
  }

  const handleGeneratePracticeExam = (doc: Document) => {
    navigate(`/practice-exam?sourceId=${doc.id}`)
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 animate-fade-in">
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

      {isProcessing && (
        <div className="glass-card p-4 mb-4 flex items-center gap-3">
          <Loader2 className="w-5 h-5 text-[var(--accent-text)] animate-spin" />
          <span className="text-sm text-[var(--text-body)]">{processingStatus || t('common.loading')}</span>
        </div>
      )}

      {summarizing && (
        <div className="glass-card p-4 mb-4 flex items-center gap-3">
          <Loader2 className="w-5 h-5 text-[var(--accent-text)] animate-spin" />
          <span className="text-sm text-[var(--text-body)]">{t('sources.generateSummary')}...</span>
        </div>
      )}

      <div className="mb-6">
        <SourceUploadBar
          onUploadPdf={uploadPdf}
          onPasteText={() => setShowPaste(true)}
          onWriteNote={() => setShowNotes(true)}
          disabled={isProcessing}
        />
      </div>

      {coverage && (
        <div className="mb-6">
          <SourceCoverageChart coverage={coverage} />
        </div>
      )}

      <SourceList
        documents={documents}
        onView={setViewDoc}
        onDelete={handleDelete}
        onSummarize={handleSummarize}
        onGenerateFlashcards={handleGenerateFlashcards}
        onGeneratePracticeExam={handleGeneratePracticeExam}
      />

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
      />
    </div>
  )
}
