/**
 * Hook for managing review project lifecycle — create, upload, process, synthesize.
 * Uses the background job queue so processing survives navigation.
 */
import { useState, useCallback, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { ReviewProject, ReviewArticle } from '../db/schema'
import { useBackgroundJobs } from '../components/BackgroundJobsProvider'
import { useBackgroundJob } from './useBackgroundJob'
import type { BatchProgress } from '../ai/orchestrator/parallelBatch'

export type ReviewPhase = 'list' | 'setup' | 'uploading' | 'processing' | 'synthesizing' | 'reviewing'

export function useReviewProject(examProfileId: string | undefined) {
  const { enqueueBatch, cancel } = useBackgroundJobs()
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [phase, setPhase] = useState<ReviewPhase>('list')
  const [batchJobId, setBatchJobId] = useState<string | null>(null)

  const batchJob = useBackgroundJob(batchJobId)

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

  // Drive phase transitions from job status
  useEffect(() => {
    if (!batchJob.job) return

    if (batchJob.isCompleted) {
      // Check if there's a synthesis job queued/running for this project
      if (phase === 'processing') {
        setPhase('synthesizing')
        // Synthesis is auto-enqueued by JobRunner — wait for project status update
        const checkSynthesis = async () => {
          if (!selectedProjectId) return
          // Give synthesis a moment to be enqueued/completed
          const project = await db.reviewProjects.get(selectedProjectId)
          if (project?.status === 'reviewing' || project?.status === 'completed') {
            setPhase('reviewing')
          } else {
            // Check again after a delay
            setTimeout(checkSynthesis, 2000)
          }
        }
        checkSynthesis()
      }
    }
  }, [batchJob.isCompleted, batchJob.job, phase, selectedProjectId])

  // Build batchProgress for backward compat with ArticleReview page
  const batchProgress: BatchProgress | null = batchJob.job ? {
    totalItems: batchJob.batchTotal,
    completedItems: batchJob.batchCompleted,
    failedItems: batchJob.batchFailed,
    runningItems: batchJob.isRunning ? Math.min(batchJob.job.batchConcurrency ?? 3, batchJob.batchTotal - batchJob.batchCompleted - batchJob.batchFailed) : 0,
    items: new Map(),
    elapsedMs: 0,
  } : null

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
    db.reviewProjects.get(projectId).then(async p => {
      if (!p) return
      if (p.status === 'reviewing' || p.status === 'completed') {
        setPhase('reviewing')
      } else if (p.status === 'processing') {
        const doneCount = await db.reviewArticles
          .where('[projectId+processingStatus]')
          .equals([projectId, 'done'])
          .count()
        if (doneCount > 0) {
          await db.reviewProjects.update(projectId, { status: 'reviewing', updatedAt: new Date().toISOString() })
          setPhase('reviewing')
        } else {
          setPhase('processing')
          // Try to find the running batch job for this project
          const runningJobs = await db.backgroundJobs
            .where('status').anyOf('queued', 'running')
            .filter(j => j.type === 'article-review-batch' && JSON.parse(j.config).projectId === projectId)
            .first()
          if (runningJobs) setBatchJobId(runningJobs.id)
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
      documentId: '',
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

    const project = await db.reviewProjects.get(selectedProjectId)
    if (!project) return

    setPhase('processing')
    await db.reviewProjects.update(selectedProjectId, { status: 'processing', updatedAt: new Date().toISOString() })

    // Enqueue batch job — the JobRunner handles ingestion + LLM steps
    const articleIds = articleFiles.map(af => af.articleId)
    const jobId = await enqueueBatch(
      'article-review-batch',
      examProfileId,
      {
        projectId: selectedProjectId,
        projectDescription: project.description,
        examProfileId,
        // Store file data as base64 for each article so JobRunner can reconstruct
        articleFiles: articleFiles.map(af => ({
          articleId: af.articleId,
          fileName: af.file.name,
          fileSize: af.file.size,
        })),
      },
      articleIds,
      3, // concurrency
      4, // steps per item (ingest, analyze, research, save)
    )
    setBatchJobId(jobId)
  }, [examProfileId, selectedProjectId, enqueueBatch])

  const deleteProject = useCallback(async (projectId: string) => {
    const projectArticles = await db.reviewArticles
      .where('projectId')
      .equals(projectId)
      .toArray()

    for (const article of projectArticles) {
      if (article.documentId) {
        await db.documentChunks.where('documentId').equals(article.documentId).delete()
        await db.chunkEmbeddings.where('documentId').equals(article.documentId).delete()
        await db.documents.delete(article.documentId)
      }
    }

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
    synthesisProgress: null,
    isBatchRunning: batchJob.isRunning,
    isSynthesisRunning: false,
    batchError: batchJob.error,
    synthesisError: null,

    createProject,
    selectProject,
    uploadArticles,
    startProcessing,
    deleteProject,
    cancelProcessing: () => { if (batchJobId) cancel(batchJobId) },
    goToList,
  }
}
