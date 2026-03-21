/**
 * Client-side cloud sync — push/pull profile data to Cloudflare KV.
 */
import { exportProfileData, importProfileData } from './dataExport'

const SYNC_URL = '/api/sync'

export async function pushToCloud(
  profileId: string,
  authToken: string,
): Promise<{ success: boolean; syncedAt?: string; error?: string }> {
  const blob = await exportProfileData(profileId)
  const body = await blob.text()

  const res = await fetch(SYNC_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
    },
    body,
  })

  const data = await res.json() as { success?: boolean; syncedAt?: string; error?: string }
  if (!res.ok) return { success: false, error: data.error ?? `Sync failed (${res.status})` }
  return { success: true, syncedAt: data.syncedAt }
}

export async function pullFromCloud(
  profileId: string,
  authToken: string,
): Promise<{ success: boolean; syncedAt?: string; error?: string }> {
  const res = await fetch(`${SYNC_URL}?profileId=${encodeURIComponent(profileId)}`, {
    headers: { 'Authorization': `Bearer ${authToken}` },
  })

  if (res.status === 404) return { success: false, error: 'No cloud data found' }
  if (!res.ok) {
    const data = await res.json() as { error?: string }
    return { success: false, error: data.error ?? `Pull failed (${res.status})` }
  }

  const syncedAt = res.headers.get('X-Synced-At') ?? undefined
  const text = await res.text()

  // Create a File from the text to pass to importProfileData
  const file = new File([text], 'sync.json', { type: 'application/json' })
  const result = await importProfileData(file)

  if (!result.success) return { success: false, error: result.error }
  return { success: true, syncedAt }
}

export async function deleteSyncData(
  profileId: string,
  authToken: string,
): Promise<{ success: boolean; error?: string }> {
  const res = await fetch(`${SYNC_URL}?profileId=${encodeURIComponent(profileId)}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${authToken}` },
  })

  const data = await res.json() as { success?: boolean; error?: string }
  if (!res.ok) return { success: false, error: data.error ?? `Delete failed (${res.status})` }
  return { success: true }
}

export async function getSyncStatus(
  profileId: string,
  authToken: string,
): Promise<{ exists: boolean; syncedAt?: string }> {
  try {
    const res = await fetch(`${SYNC_URL}?profileId=${encodeURIComponent(profileId)}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${authToken}` },
    })
    if (res.status === 404) return { exists: false }
    if (!res.ok) return { exists: false }
    const syncedAt = res.headers.get('X-Synced-At') ?? undefined
    return { exists: true, syncedAt }
  } catch {
    return { exists: false }
  }
}
