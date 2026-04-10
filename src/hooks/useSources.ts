/**
 * Reactive hook for the Sources library.
 * Provides live-query documents, upload/paste/delete, and search.
 */
import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { toast } from 'sonner'
import { useLiveQuery } from 'dexie-react-hooks'
import { useAuth } from '@clerk/clerk-react'
import { useTranslation } from 'react-i18next'
import { db } from '../db'
import {
  createDocument,
  deleteDocument,
  saveChunks,
  chunkText,
  chunkPages,
} from '../lib/sources'
import { parsePdf } from '../lib/pdfParser'
import { processFile } from '../lib/fileProcessor'
import { deleteEmbeddings, embedAndStoreChunks } from '../lib/embeddings'
import { hybridSearch } from '../lib/hybridSearch'
import { getChunksByDocumentId } from '../lib/sources'
import type { DocumentChunk } from '../db/schema'
import { track } from '../lib/analytics'
import type { BatchUploadProgressState } from '../components/sources/BatchUploadProgress'

interface UseSourcesOptions {
  onDocumentReady?: (docId: string) => void
}

export function useSources(examProfileId: string | undefined, options?: UseSourcesOptions) {
  const { getToken } = useAuth()
  const { t } = useTranslation()
  const onDocumentReadyRef = useRef(options?.onDocumentReady)
  onDocumentReadyRef.current = options?.onDocumentReady
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingStatus, setProcessingStatus] = useState('')
  const [batchProgress, setBatchProgress] = useState<BatchUploadProgressState | null>(null)

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

  // Safety net: auto-embed chunks missing embeddings (seeded docs, pasted text).
  // Delayed 15s so agents and other startup work settles first.
  useEffect(() => {
    if (!examProfileId) return
    let cancelled = false
    const timer = setTimeout(async () => {
      if (cancelled) return
      try {
        const allChunks = await db.documentChunks.where('examProfileId').equals(examProfileId).toArray()
        if (allChunks.length === 0 || cancelled) return
        const existingEmbeddings = await db.chunkEmbeddings.where('examProfileId').equals(examProfileId).toArray()
        const existingChunkIds = new Set(existingEmbeddings.map(e => e.chunkId))
        const unembedded = allChunks.filter(c => !existingChunkIds.has(c.id))
        if (unembedded.length === 0 || cancelled) return
        // Fresh token right before the call
        const token = await getToken({ skipCache: true })
        if (!token || cancelled) return
        await embedAndStoreChunks(unembedded, token)
      } catch { /* non-critical */ }
    }, 15_000)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [examProfileId, getToken])

  const uploadPdf = useCallback(async (file: File) => {
    if (!examProfileId) return
    setIsProcessing(true)
    setProcessingStatus('Parsing PDF...')
    try {
      const { text, pages, pageCount } = await parsePdf(file)
      const title = file.name.replace(/\.pdf$/i, '')
      setProcessingStatus('Creating document...')
      const doc = await createDocument(examProfileId, title, 'pdf', text)
      // Store original PDF file for in-app viewing
      await db.documentFiles.put({
        id: crypto.randomUUID(),
        documentId: doc.id,
        examProfileId,
        file: file,
      })
      setProcessingStatus(`Chunking ${pageCount} pages...`)
      // Page-aware chunking: each chunk carries its source page number
      // so the Course Companion can jump to the right page on citation click.
      const chunks = chunkPages(pages)
      await saveChunks(doc.id, examProfileId, chunks)
      // Embed immediately at upload time (uses Cloudflare Workers AI, separate from LLM)
      try {
        setProcessingStatus('Embedding chunks...')
        const token = await getToken()
        if (token) {
          const savedChunks = await getChunksByDocumentId(doc.id)
          await embedAndStoreChunks(savedChunks, token)
        }
      } catch {
        // Non-blocking — workflow will retry if needed
      }
      setProcessingStatus('')
      track('document_uploaded', { type: 'pdf', pageCount })
      toast.success(`"${title}" uploaded`)
      // Auto-trigger processing if callback provided
      try { onDocumentReadyRef.current?.(doc.id) } catch { /* non-blocking */ }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed')
      throw err
    } finally {
      setIsProcessing(false)
      setProcessingStatus('')
    }
  }, [examProfileId])

  const uploadMultiplePdfs = useCallback(async (files: File[], category?: 'course' | 'exam' | 'other') => {
    if (!examProfileId || files.length === 0) return

    const progress: BatchUploadProgressState = {
      total: files.length,
      completed: 0,
      currentFile: '',
      results: [],
    }
    setBatchProgress({ ...progress })
    setIsProcessing(true)

    for (const file of files) {
      progress.currentFile = file.name
      setBatchProgress({ ...progress })

      try {
        const processed = await processFile(file)
        const doc = await createDocument(examProfileId, processed.title, 'pdf', processed.text, undefined, category)
        await saveChunks(doc.id, examProfileId, processed.chunks)
        // Store original PDF for in-app viewing
        await db.documentFiles.put({
          id: crypto.randomUUID(),
          documentId: doc.id,
          examProfileId,
          file: file,
        })
        // Embed immediately at upload time
        try {
          const token = await getToken()
          if (token) {
            const savedChunks = await getChunksByDocumentId(doc.id)
            await embedAndStoreChunks(savedChunks, token)
          }
        } catch { /* non-blocking */ }
        progress.results.push({ fileName: file.name, status: 'done' })
        // Auto-trigger processing per file
        try { onDocumentReadyRef.current?.(doc.id) } catch { /* non-blocking */ }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Upload failed'
        progress.results.push({ fileName: file.name, status: 'error', error: errorMsg })
      }

      progress.completed++
      progress.currentFile = ''
      setBatchProgress({ ...progress })
    }

    setIsProcessing(false)

    // Toast with summary
    const success = progress.results.filter(r => r.status === 'done').length
    const failed = progress.results.filter(r => r.status === 'error').length
    if (failed === 0) {
      toast.success(t('sources.batchComplete', { count: success }))
    } else {
      toast.warning(t('sources.batchPartial', { success, total: progress.total, failed }))
    }

    // Clear batch progress after a delay
    setTimeout(() => setBatchProgress(null), 3000)
  }, [examProfileId, t])

  const pasteText = useCallback(async (title: string, text: string) => {
    if (!examProfileId || !text.trim()) return
    setIsProcessing(true)
    setProcessingStatus('Saving text...')
    try {
      const doc = await createDocument(examProfileId, title, 'paste', text)
      const chunks = chunkText(text)
      const stored = await saveChunks(doc.id, examProfileId, chunks)
      // Generate embeddings so semantic search works
      const token = await getToken()
      if (token && stored.length > 0) {
        await embedAndStoreChunks(stored, token).catch(() => { /* non-critical */ })
      }
      onDocumentReadyRef.current?.(doc.id)
      toast.success('Text saved')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed')
      throw err
    } finally {
      setIsProcessing(false)
      setProcessingStatus('')
    }
  }, [examProfileId, getToken])

  const saveNote = useCallback(async (title: string, text: string) => {
    if (!examProfileId || !text.trim()) return
    setIsProcessing(true)
    try {
      const doc = await createDocument(examProfileId, title, 'text', text)
      const chunks = chunkText(text)
      const stored = await saveChunks(doc.id, examProfileId, chunks)
      // Generate embeddings so semantic search works
      const token = await getToken()
      if (token && stored.length > 0) {
        await embedAndStoreChunks(stored, token).catch(() => { /* non-critical */ })
      }
      onDocumentReadyRef.current?.(doc.id)
      toast.success('Note saved')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed')
      throw err
    } finally {
      setIsProcessing(false)
    }
  }, [examProfileId, getToken])

  const deleteSource = useCallback(async (documentId: string) => {
    await deleteEmbeddings(documentId)
    await deleteDocument(documentId)
  }, [])

  const searchSources = useCallback(async (query: string, topN = 5): Promise<(DocumentChunk & { score: number; documentTitle?: string })[]> => {
    if (!examProfileId) return []
    const token = await getToken()
    return hybridSearch(examProfileId, query, token ?? undefined, { topN })
  }, [examProfileId, getToken])

  const documentCount = useMemo(() => documents?.length ?? 0, [documents])

  return {
    documents: documents ?? [],
    totalChunks: totalChunks ?? 0,
    documentCount,
    uploadPdf,
    uploadMultiplePdfs,
    pasteText,
    saveNote,
    deleteSource,
    searchSources,
    isProcessing,
    processingStatus,
    batchProgress,
  }
}
