/**
 * Local push notification management — no server needed.
 * Uses service worker + setTimeout for scheduling.
 */

export async function requestPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false
  const result = await Notification.requestPermission()
  return result === 'granted'
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null
  try {
    return await navigator.serviceWorker.register('/sw.js')
  } catch {
    return null
  }
}

export async function scheduleLocalNotification(
  title: string,
  body: string,
  delayMs: number,
  url?: string
): Promise<boolean> {
  if (!('serviceWorker' in navigator)) return false
  if (Notification.permission !== 'granted') return false

  try {
    const registration = await navigator.serviceWorker.ready
    if (registration.active) {
      registration.active.postMessage({
        type: 'SCHEDULE_NOTIFICATION',
        title,
        body,
        delayMs,
        url,
      })
      return true
    }
    return false
  } catch {
    return false
  }
}

export async function scheduleDailyReminder(profileId: string): Promise<void> {
  // Dedup: only schedule once per profile per day
  const today = new Date().toISOString().slice(0, 10)
  const dedupKey = `reminder_scheduled_${profileId}_${today}`
  if (localStorage.getItem(dedupKey)) return
  localStorage.setItem(dedupKey, 'true')

  // Schedule notification for tomorrow at 6 PM
  const now = new Date()
  const tomorrow6pm = new Date(now)
  tomorrow6pm.setDate(tomorrow6pm.getDate() + 1)
  tomorrow6pm.setHours(18, 0, 0, 0)
  const delayMs = tomorrow6pm.getTime() - now.getTime()

  if (delayMs > 0) {
    await scheduleLocalNotification(
      'Time to study!',
      'Your daily queue is waiting. Keep your streak alive!',
      delayMs,
      '/queue'
    )
  }
}

export function getNotificationStatus(): 'granted' | 'denied' | 'default' | 'unsupported' {
  if (!('Notification' in window)) return 'unsupported'
  return Notification.permission
}
