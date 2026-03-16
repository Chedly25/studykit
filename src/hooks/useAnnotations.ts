import { useCallback } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { Annotation, AnnotationType } from '../db/schema'

export function useAnnotations(examProfileId: string | undefined, documentId?: string) {
  const annotations = useLiveQuery(
    () => {
      if (!examProfileId) return Promise.resolve([] as Annotation[])
      if (documentId) {
        return db.annotations
          .where('[documentId+examProfileId]')
          .equals([documentId, examProfileId])
          .toArray()
      }
      return db.annotations.where('examProfileId').equals(examProfileId).toArray()
    },
    [examProfileId, documentId]
  ) ?? []

  const addAnnotation = useCallback(async (
    docId: string,
    chunkId: string,
    type: AnnotationType,
    content: string,
  ) => {
    if (!examProfileId) return
    await db.annotations.put({
      id: crypto.randomUUID(),
      documentId: docId,
      chunkId,
      examProfileId,
      type,
      content,
      createdAt: new Date().toISOString(),
    })
  }, [examProfileId])

  const updateAnnotation = useCallback(async (id: string, updates: Partial<Pick<Annotation, 'content' | 'type'>>) => {
    await db.annotations.update(id, updates)
  }, [])

  const deleteAnnotation = useCallback(async (id: string) => {
    await db.annotations.delete(id)
  }, [])

  const getAnnotationsForChunk = useCallback((chunkId: string) => {
    return annotations.filter(a => a.chunkId === chunkId)
  }, [annotations])

  return {
    annotations,
    addAnnotation,
    updateAnnotation,
    deleteAnnotation,
    getAnnotationsForChunk,
  }
}
