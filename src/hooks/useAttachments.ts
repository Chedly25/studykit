import { useState, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { processFile, type ProcessedFile } from '../lib/fileProcessor'
import { tokenize } from '../lib/sources'

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

export interface ChatAttachment {
  file: File
  name: string
  status: 'pending' | 'parsing' | 'ready' | 'error'
  processed?: ProcessedFile
  error?: string
}

export function useAttachments() {
  const { t } = useTranslation()
  const [attachments, setAttachments] = useState<ChatAttachment[]>([])
  const parsingRef = useRef(false)
  const queueRef = useRef<File[]>([])

  const parseNext = useCallback(async () => {
    if (parsingRef.current) return
    const file = queueRef.current.shift()
    if (!file) return

    parsingRef.current = true
    setAttachments(prev =>
      prev.map(a => a.file === file ? { ...a, status: 'parsing' as const } : a)
    )

    try {
      const processed = await processFile(file)
      setAttachments(prev =>
        prev.map(a => a.file === file ? { ...a, status: 'ready' as const, processed } : a)
      )
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Parse failed'
      setAttachments(prev =>
        prev.map(a => a.file === file ? { ...a, status: 'error' as const, error: errorMsg } : a)
      )
      toast.error(t('ai.attachmentError', { name: file.name }))
    } finally {
      parsingRef.current = false
      // Process next in queue
      if (queueRef.current.length > 0) {
        parseNext()
      }
    }
  }, [t])

  const addFiles = useCallback((files: File[]) => {
    const valid: ChatAttachment[] = []
    for (const file of files) {
      if (file.type !== 'application/pdf') continue
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`${file.name}: exceeds 50MB limit`)
        continue
      }
      valid.push({ file, name: file.name, status: 'pending' })
      queueRef.current.push(file)
    }
    if (valid.length > 0) {
      setAttachments(prev => [...prev, ...valid])
      parseNext()
    }
  }, [parseNext])

  const removeAttachment = useCallback((index: number) => {
    setAttachments(prev => {
      const removed = prev[index]
      if (removed) {
        queueRef.current = queueRef.current.filter(f => f !== removed.file)
      }
      return prev.filter((_, i) => i !== index)
    })
  }, [])

  const clearAttachments = useCallback(() => {
    setAttachments([])
    queueRef.current = []
  }, [])

  const isParsing = attachments.some(a => a.status === 'pending' || a.status === 'parsing')

  const getRelevantChunks = useCallback((query: string, topN = 5): Array<{ content: string; documentTitle: string; chunkIndex: number }> => {
    const queryTerms = tokenize(query)
    if (queryTerms.length === 0) return []

    const allChunks: Array<{ content: string; documentTitle: string; chunkIndex: number; score: number }> = []

    for (const att of attachments) {
      if (att.status !== 'ready' || !att.processed) continue
      const { title, chunks } = att.processed

      for (let i = 0; i < chunks.length; i++) {
        const chunkWords = tokenize(chunks[i])
        if (chunkWords.length === 0) continue

        // TF-IDF scoring
        let score = 0
        for (const term of queryTerms) {
          const tf = chunkWords.filter(w => w === term).length / chunkWords.length
          // Simple IDF approximation within this attachment
          const containsTerm = chunks.some(c => tokenize(c).includes(term))
          const idf = containsTerm ? Math.log(chunks.length / 1) + 1 : 0
          score += tf * idf
        }

        if (score > 0) {
          allChunks.push({ content: chunks[i], documentTitle: title, chunkIndex: i, score })
        }
      }
    }

    allChunks.sort((a, b) => b.score - a.score)
    return allChunks.slice(0, topN).map(({ content, documentTitle, chunkIndex }) => ({
      content,
      documentTitle,
      chunkIndex,
    }))
  }, [attachments])

  return {
    attachments,
    addFiles,
    removeAttachment,
    clearAttachments,
    isParsing,
    getRelevantChunks,
  }
}
