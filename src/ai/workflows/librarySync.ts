/**
 * Library sync workflow — downloads pre-processed content from R2 into IndexedDB.
 * Runs as a background job after onboarding when a content library exists for the exam.
 */
import type { WorkflowDefinition, WorkflowContext } from '../orchestrator/types'
import { db } from '../../db'

interface LibrarySyncConfig {
  examId: string
}

interface ManifestEntry {
  id: string
  title: string
  category: 'exam' | 'course'
  year?: number
  subject?: string
  concours?: string
  chunkCount: number
  sizeBytes: number
}

interface LibraryDocumentPackage {
  document: {
    id: string
    title: string
    sourceType: string
    category: string
    originalContent: string
    summary?: string
    chunkCount: number
    wordCount: number
    createdAt: string
  }
  chunks: Array<{
    id: string
    documentId: string
    content: string
    chunkIndex: number
    keywords: string
    pageNumber?: number
    topicId?: string
    contextPrefix?: string
  }>
  embeddings: Array<{
    id: string
    chunkId: string
    documentId: string
    embedding: string
  }>
}

const BATCH_SIZE = 5

export function createLibrarySyncWorkflow(config: LibrarySyncConfig): WorkflowDefinition {
  return {
    id: 'library-sync',
    name: 'Syncing content library',
    steps: [
      {
        id: 'fetch-manifest',
        name: 'Fetching library catalog',
        execute: async (_input: unknown, ctx: WorkflowContext) => {
          const res = await fetch(`/api/library/manifest?examId=${encodeURIComponent(config.examId)}`, {
            headers: { Authorization: `Bearer ${ctx.authToken}` },
          })
          if (!res.ok) {
            const err = await res.text().catch(() => 'Unknown error')
            throw new Error(`Failed to fetch manifest: ${res.status} ${err}`)
          }
          const manifest = await res.json() as { documents: ManifestEntry[] }
          return manifest.documents
        },
      },
      {
        id: 'filter-existing',
        name: 'Checking existing documents',
        execute: async (_input: unknown, ctx: WorkflowContext) => {
          const manifestDocs = ctx.results['fetch-manifest']?.data as ManifestEntry[] | undefined
          if (!manifestDocs || manifestDocs.length === 0) return { toDownload: [], alreadyPresent: 0 }

          // Find which library docs are already in IndexedDB for this profile
          const existingDocs = await db.documents
            .where('examProfileId')
            .equals(ctx.examProfileId)
            .toArray()

          const existingLibraryIds = new Set<string>()
          for (const doc of existingDocs) {
            if (doc.tags) {
              try {
                const tags = JSON.parse(doc.tags) as string[]
                for (const tag of tags) {
                  if (tag.startsWith('library:')) {
                    existingLibraryIds.add(tag.slice(8))
                  }
                }
              } catch { /* invalid tags JSON */ }
            }
          }

          const toDownload = manifestDocs.filter(d => !existingLibraryIds.has(d.id))
          return { toDownload, alreadyPresent: manifestDocs.length - toDownload.length }
        },
      },
      {
        id: 'download-and-store',
        name: 'Downloading library content',
        execute: async (_input: unknown, ctx: WorkflowContext) => {
          const { toDownload } = (ctx.results['filter-existing']?.data as { toDownload: ManifestEntry[] }) ?? { toDownload: [] }
          if (toDownload.length === 0) return { downloaded: 0 }

          let downloaded = 0
          for (let i = 0; i < toDownload.length; i += BATCH_SIZE) {
            const batch = toDownload.slice(i, i + BATCH_SIZE)

            await Promise.all(batch.map(async (entry) => {
              const res = await fetch(
                `/api/library/content?examId=${encodeURIComponent(config.examId)}&docId=${encodeURIComponent(entry.id)}`,
                { headers: { Authorization: `Bearer ${ctx.authToken}` } },
              )
              if (!res.ok) return // Skip failed downloads silently

              const pkg = await res.json() as LibraryDocumentPackage

              // Stamp examProfileId on all records
              const profileId = ctx.examProfileId

              await db.documents.put({
                ...pkg.document,
                examProfileId: profileId,
                tags: JSON.stringify(['library', `library:${entry.id}`]),
              })

              if (pkg.chunks.length > 0) {
                await db.documentChunks.bulkPut(
                  pkg.chunks.map(c => ({ ...c, examProfileId: profileId }))
                )
              }

              if (pkg.embeddings.length > 0) {
                await db.chunkEmbeddings.bulkPut(
                  pkg.embeddings.map(e => ({ ...e, examProfileId: profileId }))
                )
              }

              downloaded++
            }))

            ctx.updateProgress?.(`Downloaded ${Math.min(i + BATCH_SIZE, toDownload.length)}/${toDownload.length} documents`)
          }

          return { downloaded }
        },
      },
      {
        id: 'finalize',
        name: 'Library sync complete',
        execute: async (_input: unknown, ctx: WorkflowContext) => {
          const filterResult = ctx.results['filter-existing']?.data as { toDownload: ManifestEntry[]; alreadyPresent: number } | undefined
          const downloadResult = ctx.results['download-and-store']?.data as { downloaded: number } | undefined
          return {
            totalAvailable: (filterResult?.toDownload.length ?? 0) + (filterResult?.alreadyPresent ?? 0),
            downloaded: downloadResult?.downloaded ?? 0,
            alreadyPresent: filterResult?.alreadyPresent ?? 0,
          }
        },
      },
    ],
    aggregate: (ctx: WorkflowContext) => {
      return ctx.results['finalize']?.data ?? { totalAvailable: 0, downloaded: 0, alreadyPresent: 0 }
    },
  }
}
