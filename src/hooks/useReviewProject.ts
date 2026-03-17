/**
 * Hook for managing review project lifecycle — create, upload, process, synthesize.
 */
import { useState, useCallback } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useAuth } from '@clerk/clerk-react'
import { db } from '../db'
import type { ReviewProject, ReviewArticle } from '../db/schema'
import { useParallelBatch } from './useParallelBatch'
import { useOrchestrator } from './useOrchestrator'
import { createArticleReviewWorkflow, type ArticleReviewResult } from '../ai/workflows/articleReview'
import { createArticleSynthesisWorkflow, type SynthesisResult } from '../ai/workflows/articleSynthesis'
import type { BatchProgress } from '../ai/orchestrator/parallelBatch'

export type ReviewPhase = 'list' | 'setup' | 'uploading' | 'processing' | 'synthesizing' | 'reviewing'

export function useReviewProject(examProfileId: string | undefined) {
  const { getToken } = useAuth()
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [phase, setPhase] = useState<ReviewPhase>('list')

  const batch = useParallelBatch<File, ArticleReviewResult>()
  const synthesis = useOrchestrator<SynthesisResult>()

  // Live queries
  const projects = useLiveQuery(
    () => examProfileId
      ? db.reviewProjects.where('examProfileId').equals(examProfileId).reverse().sortBy('createdAt')
      : [],
    [examProfileId],
    [],
  )

  const activeProject = useLiveQuery(
    () => selectedProjectId ? db.reviewProjects.get(selectedProjectId) : undefined,
    [selectedProjectId],
  )

  const articles = useLiveQuery(
    () => selectedProjectId
      ? db.reviewArticles.where('projectId').equals(selectedProjectId).toArray()
      : [],
    [selectedProjectId],
    [],
  )

  // Batch progress
  const batchProgress: BatchProgress | null = batch.progress

  // Actions
  const createProject = useCallback(async (
    name: string,
    description: string,
    deadline: string,
    targetShortlistCount: number,
  ) => {
    if (!examProfileId) return null
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    const project: ReviewProject = {
      id,
      examProfileId,
      name,
      description,
      deadline,
      targetShortlistCount,
      status: 'setup',
      createdAt: now,
      updatedAt: now,
    }
    await db.reviewProjects.put(project)
    setSelectedProjectId(id)
    setPhase('setup')
    return project
  }, [examProfileId])

  const selectProject = useCallback((projectId: string) => {
    setSelectedProjectId(projectId)
    // Determine phase from project status
    db.reviewProjects.get(projectId).then(async p => {
      if (!p) return
      if (p.status === 'reviewing' || p.status === 'completed') {
        setPhase('reviewing')
      } else if (p.status === 'processing') {
        // Check if processing actually finished (status wasn't updated)
        const doneCount = await db.reviewArticles
          .where('[projectId+processingStatus]')
          .equals([projectId, 'done'])
          .count()
        if (doneCount > 0) {
          await db.reviewProjects.update(projectId, { status: 'reviewing', updatedAt: new Date().toISOString() })
          setPhase('reviewing')
        } else {
          setPhase('setup')
        }
      } else {
        setPhase('setup')
      }
    })
  }, [])

  const uploadArticles = useCallback(async (files: File[]) => {
    if (!examProfileId || !selectedProjectId) return

    setPhase('uploading')
    const now = new Date().toISOString()
    const articleRecords: ReviewArticle[] = files.map(() => ({
      id: crypto.randomUUID(),
      projectId: selectedProjectId,
      examProfileId,
      documentId: '', // Will be set during ingestion
      processingStatus: 'queued' as const,
      decision: 'pending' as const,
      createdAt: now,
      updatedAt: now,
    }))

    await db.reviewArticles.bulkPut(articleRecords)
    setPhase('setup')
    return articleRecords.map((a, i) => ({ articleId: a.id, file: files[i] }))
  }, [examProfileId, selectedProjectId])

  const startProcessing = useCallback(async (articleFiles: Array<{ articleId: string; file: File }>) => {
    if (!examProfileId || !selectedProjectId) return

    // Read project directly from DB to avoid stale live query
    const project = await db.reviewProjects.get(selectedProjectId)
    if (!project) return

    const token = await getToken()
    if (!token) return

    setPhase('processing')
    await db.reviewProjects.update(selectedProjectId, { status: 'processing', updatedAt: new Date().toISOString() })

    const items = articleFiles.map(af => ({
      id: af.articleId,
      data: af.file,
    }))

    const batchResult = await batch.run(
      items,
      (file, articleId) => createArticleReviewWorkflow({
        file,
        articleId,
        projectId: selectedProjectId,
        projectDescription: project.description,
        examProfileId,
      }),
      { concurrency: 3, examProfileId, authToken: token },
    )

    if (!batchResult) return

    // Only run synthesis if at least 2 articles succeeded
    const doneCount = await db.reviewArticles
      .where('[projectId+processingStatus]')
      .equals([selectedProjectId, 'done'])
      .count()

    if (doneCount >= 2) {
      setPhase('synthesizing')
      const synthesisWorkflow = createArticleSynthesisWorkflow({ projectId: selectedProjectId })
      await synthesis.run(synthesisWorkflow, { examProfileId, authToken: token })
    }

    await db.reviewProjects.update(selectedProjectId, { status: 'reviewing', updatedAt: new Date().toISOString() })
    setPhase('reviewing')
  }, [examProfileId, selectedProjectId, getToken, batch, synthesis])

  const deleteProject = useCallback(async (projectId: string) => {
    // Get articles to find linked documents
    const projectArticles = await db.reviewArticles
      .where('projectId')
      .equals(projectId)
      .toArray()

    // Delete linked documents and their chunks/embeddings
    for (const article of projectArticles) {
      if (article.documentId) {
        await db.documentChunks.where('documentId').equals(article.documentId).delete()
        await db.chunkEmbeddings.where('documentId').equals(article.documentId).delete()
        await db.documents.delete(article.documentId)
      }
    }

    // Delete articles and project
    await db.reviewArticles.where('projectId').equals(projectId).delete()
    await db.reviewProjects.delete(projectId)

    if (selectedProjectId === projectId) {
      setSelectedProjectId(null)
      setPhase('list')
    }
  }, [selectedProjectId])

  const goToList = useCallback(() => {
    setSelectedProjectId(null)
    setPhase('list')
  }, [])

  return {
    projects: projects ?? [],
    activeProject,
    articles: articles ?? [],
    phase,
    setPhase,
    batchProgress,
    synthesisProgress: synthesis.progress,
    isBatchRunning: batch.isRunning,
    isSynthesisRunning: synthesis.isRunning,
    batchError: batch.error,
    synthesisError: synthesis.error,

    createProject,
    selectProject,
    uploadArticles,
    startProcessing,
    deleteProject,
    cancelProcessing: batch.cancel,
    goToList,
  }
}
