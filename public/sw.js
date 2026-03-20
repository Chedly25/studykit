/**
 * Service worker for push + local scheduled notifications.
 */

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {}
  const title = data.title || 'StudiesKit'
  const options = {
    body: data.body || 'Time to study!',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { url: data.url || '/' },
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      return self.clients.openWindow(url)
    })
  )
})

// Local scheduled notifications via postMessage.
// Note: setTimeout in a SW may not survive browser suspension for long delays.
// For short delays (< 5 min) this works reliably. For longer delays (e.g. next-day
// reminders), the notification may not fire if the SW is killed. This is a best-effort
// approach; a server-side push solution would be needed for guaranteed delivery.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SCHEDULE_NOTIFICATION') {
    const { title, body, delayMs, url } = event.data
    // Cap delay to avoid issues with SW suspension — for long delays,
    // the client-side localStorage dedup + next-visit check handles it
    const safeDelay = Math.min(delayMs || 0, 5 * 60 * 1000) // max 5 minutes
    if (safeDelay > 0) {
      setTimeout(() => {
        self.registration.showNotification(title || 'StudiesKit', {
          body: body || 'Time to study!',
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          data: { url: url || '/queue' },
        })
      }, safeDelay)
    } else {
      // Immediate notification
      self.registration.showNotification(title || 'StudiesKit', {
        body: body || 'Time to study!',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        data: { url: url || '/queue' },
      })
    }
  }
})
