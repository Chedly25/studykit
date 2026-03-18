/**
 * Hook for tracking all active (queued + running) background jobs.
 * Used by the global BackgroundJobsIndicator in the header.
 */
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { BackgroundJob } from '../db/schema'

export function useActiveJobs(examProfileId?: string): BackgroundJob[] {
  return useLiveQuery(
    () => {
      if (examProfileId) {
        return db.backgroundJobs
          .where('[examProfileId+status]')
          .anyOf(
            [examProfileId, 'queued'],
            [examProfileId, 'running'],
          )
          .toArray()
      }
      return db.backgroundJobs
        .where('status')
        .anyOf('queued', 'running')
        .toArray()
    },
    [examProfileId],
  ) ?? []
}
