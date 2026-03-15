import { useState, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { computeSourceCoverage, type CoverageSummary } from '../lib/sourceCoverage'

export function useSourceCoverage(examProfileId: string | undefined) {
  const [coverage, setCoverage] = useState<CoverageSummary | null>(null)
  const [isComputing, setIsComputing] = useState(false)

  // Watch for changes in documents/chunks
  const docCount = useLiveQuery(
    () => examProfileId
      ? db.documents.where('examProfileId').equals(examProfileId).count()
      : Promise.resolve(0),
    [examProfileId]
  ) ?? 0

  const chunkCount = useLiveQuery(
    () => examProfileId
      ? db.documentChunks.where('examProfileId').equals(examProfileId).count()
      : Promise.resolve(0),
    [examProfileId]
  ) ?? 0

  useEffect(() => {
    if (!examProfileId) {
      setCoverage(null)
      return
    }

    let cancelled = false
    setIsComputing(true)

    computeSourceCoverage(examProfileId)
      .then(result => {
        if (!cancelled) setCoverage(result)
      })
      .catch(() => {
        if (!cancelled) setCoverage(null)
      })
      .finally(() => {
        if (!cancelled) setIsComputing(false)
      })

    return () => { cancelled = true }
  }, [examProfileId, docCount, chunkCount])

  return { coverage, isComputing }
}
