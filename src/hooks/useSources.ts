/**
 * Reactive hook for the Sources library.
 * Provides live-query documents, upload/paste/delete, and search.
 */
import { useState, useCallback, useMemo } from 'react'
import { toast } from 'sonner'
import { useLiveQuery } from 'dexie-react-hooks'
import { useAuth } from '@clerk/clerk-react'
import { db } from '../db'
import {
  createDocument,
  deleteDocument,
  saveChunks,
  chunkText,
} from '../lib/sources'
import { parsePdf } from '../lib/pdfParser'
import { semanticSearch, deleteEmbeddings } from '../lib/embeddings'
import type { DocumentChunk } from '../db/schema'

export function useSources(examProfileId: string | undefined) {
  const { getToken } = useAuth()
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingStatus, setProcessingStatus] = useState('')

  const documents = useLiveQuery(
    () => examProfileId
      ? db.documents.where('examProfileId').equals(examProfileId).reverse().sortBy('createdAt')
      : [],
    [examProfileId],
    [],
  )

  const totalChunks = useLiveQuery(
    () => examProfileId
      ? db.documentChunks.where('examProfileId').equals(examProfileId).count()
      : 0,
    [examProfileId],
    0,
  )

  const uploadPdf = useCallback(async (file: File) => {
    if (!examProfileId) return
    setIsProcessing(true)
    setProcessingStatus('Parsing PDF...')
    try {
      const { text, pageCount } = await parsePdf(file)
      const title = file.name.replace(/\.pdf$/i, '')
      setProcessingStatus('Creating document...')
      const doc = await createDocument(examProfileId, title, 'pdf', text)
      setProcessingStatus(`Chunking ${pageCount} pages...`)
      const chunks = chunkText(text)
      await saveChunks(doc.id, examProfileId, chunks)
      setProcessingStatus('')
      toast.success(`"${title}" uploaded`)
      // Embeddings are handled by the source processing orchestrator workflow
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed')
      throw err
    } finally {
      setIsProcessing(false)
      setProcessingStatus('')
    }
  }, [examProfileId])

  const pasteText = useCallback(async (title: string, text: string) => {
    if (!examProfileId || !text.trim()) return
    setIsProcessing(true)
    setProcessingStatus('Saving text...')
    try {
      const doc = await createDocument(examProfileId, title, 'paste', text)
      const chunks = chunkText(text)
      await saveChunks(doc.id, examProfileId, chunks)
      toast.success('Text saved')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed')
      throw err
    } finally {
      setIsProcessing(false)
      setProcessingStatus('')
    }
  }, [examProfileId])

  const saveNote = useCallback(async (title: string, text: string) => {
    if (!examProfileId || !text.trim()) return
    setIsProcessing(true)
    try {
      const doc = await createDocument(examProfileId, title, 'text', text)
      const chunks = chunkText(text)
      await saveChunks(doc.id, examProfileId, chunks)
      toast.success('Note saved')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed')
      throw err
    } finally {
      setIsProcessing(false)
    }
  }, [examProfileId])

  const deleteSource = useCallback(async (documentId: string) => {
    await deleteEmbeddings(documentId)
    await deleteDocument(documentId)
  }, [])

  const searchSources = useCallback(async (query: string, topN = 5): Promise<(DocumentChunk & { score: number; documentTitle?: string })[]> => {
    if (!examProfileId) return []
    const token = await getToken()
    return semanticSearch(examProfileId, query, token ?? undefined, topN)
  }, [examProfileId, getToken])

  const documentCount = useMemo(() => documents?.length ?? 0, [documents])

  return {
    documents: documents ?? [],
    totalChunks: totalChunks ?? 0,
    documentCount,
    uploadPdf,
    pasteText,
    saveNote,
    deleteSource,
    searchSources,
    isProcessing,
    processingStatus,
  }
}
