/**
 * Hook managing cloud sync lifecycle.
 * Auto-syncs on mount and every 5 minutes when Pro + enabled.
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { useSubscription } from './useSubscription'
import { useExamProfile } from './useExamProfile'
import { pushToCloud, pullFromCloud, deleteSyncData } from '../lib/cloudSync'
import { pushDelta, pullDelta } from '../lib/incrementalSync'

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error' | 'offline' | 'disabled'

const SYNC_ENABLED_KEY = (profileId: string) => `cloudSync_enabled_${profileId}`
const SYNC_LAST_KEY = (profileId: string) => `cloudSync_lastSyncedAt_${profileId}`
const SYNC_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes

export function useCloudSync() {
  const { getToken } = useAuth()
  const { isPro } = useSubscription()
  const { activeProfile } = useExamProfile()
  const profileId = activeProfile?.id

  const [status, setStatus] = useState<SyncStatus>('idle')
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const isEnabled = profileId ? localStorage.getItem(SYNC_ENABLED_KEY(profileId)) === 'true' : false

  // Load last sync time from localStorage
  useEffect(() => {
    if (profileId) {
      setLastSyncedAt(localStorage.getItem(SYNC_LAST_KEY(profileId)))
    }
  }, [profileId])

  const syncingRef = useRef(false)

  const sync = useCallback(async () => {
    if (!profileId || !isPro) return
    if (localStorage.getItem(SYNC_ENABLED_KEY(profileId)) !== 'true') return
    if (syncingRef.current) return

    syncingRef.current = true
    setStatus('syncing')
    setError(null)

    try {
      const token = await getToken()
      if (!token) { setStatus('offline'); syncingRef.current = false; return }

      // Incremental: push local changes, then pull remote changes
      const pushResult = await pushDelta(profileId, token)
      const pullResult = await pullDelta(profileId, token)

      if (pushResult.success && pullResult.success) {
        const now = new Date().toISOString()
        setLastSyncedAt(now)
        localStorage.setItem(SYNC_LAST_KEY(profileId), now)
        setStatus('synced')
      } else {
        // Fallback: try full push if incremental fails
        const fallback = await pushToCloud(profileId, token)
        if (fallback.success && fallback.syncedAt) {
          setLastSyncedAt(fallback.syncedAt)
          localStorage.setItem(SYNC_LAST_KEY(profileId), fallback.syncedAt)
          setStatus('synced')
        } else {
          setError(pushResult.error ?? pullResult.error ?? 'Sync failed')
          setStatus('error')
        }
      }
    } catch {
      setStatus('error')
      setError('Network error')
    } finally {
      syncingRef.current = false
    }
  }, [profileId, isPro, getToken])

  const pull = useCallback(async () => {
    if (!profileId || !isPro) return

    setStatus('syncing')
    setError(null)

    try {
      const token = await getToken()
      if (!token) { setStatus('offline'); return }

      const result = await pullFromCloud(profileId, token)
      if (result.success) {
        if (result.syncedAt) {
          setLastSyncedAt(result.syncedAt)
          localStorage.setItem(SYNC_LAST_KEY(profileId), result.syncedAt)
        }
        setStatus('synced')
      } else {
        setError(result.error ?? 'Pull failed')
        setStatus('error')
      }
    } catch {
      setStatus('error')
      setError('Network error')
    }
  }, [profileId, isPro, getToken])

  const enable = useCallback(() => {
    if (profileId) {
      localStorage.setItem(SYNC_ENABLED_KEY(profileId), 'true')
      // Trigger sync immediately
      sync()
    }
  }, [profileId, sync])

  const disable = useCallback(() => {
    if (profileId) {
      localStorage.removeItem(SYNC_ENABLED_KEY(profileId))
      setStatus('disabled')
    }
  }, [profileId])

  const deleteCloud = useCallback(async () => {
    if (!profileId) return
    try {
      const token = await getToken()
      if (!token) return
      await deleteSyncData(profileId, token)
      localStorage.removeItem(SYNC_LAST_KEY(profileId))
      setLastSyncedAt(null)
      setStatus('idle')
    } catch {
      setError('Failed to delete cloud data')
    }
  }, [profileId, getToken])

  // Keep a ref to the latest sync function so intervals always call the current version
  const syncRef = useRef(sync)
  syncRef.current = sync

  // Auto-sync on mount and every 5 minutes
  useEffect(() => {
    if (!isPro || !isEnabled || !profileId) return

    // Sync on mount
    syncRef.current()

    // Interval sync
    intervalRef.current = setInterval(() => syncRef.current(), SYNC_INTERVAL_MS)

    // Sync on visibility change (tab becomes visible)
    const onVisible = () => {
      if (document.visibilityState === 'visible') syncRef.current()
    }
    // Sync when coming back online
    const onOnline = () => syncRef.current()

    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onOnline)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onOnline)
    }
  }, [isPro, isEnabled, profileId])

  return {
    status: !isPro ? 'disabled' as SyncStatus : !isEnabled ? 'disabled' as SyncStatus : status,
    lastSyncedAt,
    error,
    isEnabled,
    isPro,
    sync,
    pull,
    enable,
    disable,
    deleteCloud,
  }
}
