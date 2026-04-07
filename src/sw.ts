/// <reference lib="webworker" />
/**
 * Workbox-powered service worker.
 * Precaches all build assets (auto-injected manifest).
 * Preserves push notifications + scheduled notifications from the original sw.js.
 */
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { StaleWhileRevalidate } from 'workbox-strategies'
import { CacheableResponsePlugin } from 'workbox-cacheable-response'
import { ExpirationPlugin } from 'workbox-expiration'

declare let self: ServiceWorkerGlobalScope

// ─── Workbox precaching (manifest auto-injected at build) ────────
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// ─── Runtime caching: images ─────────────────────────────────────
registerRoute(
  ({ request }) => request.destination === 'image',
  new StaleWhileRevalidate({
    cacheName: 'images',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 30 * 24 * 60 * 60 }),
    ],
  }),
)

// ─── Runtime caching: same-origin fonts only ─────────────────────
// Skip cross-origin font CDNs (fontshare, gstatic) — CSP may block them in SW context
registerRoute(
  ({ request, sameOrigin }) => sameOrigin && request.destination === 'font',
  new StaleWhileRevalidate({
    cacheName: 'fonts',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 365 * 24 * 60 * 60 }),
    ],
  }),
)

// API calls: always go to network (no caching).
// Previously used NetworkFirst with 5-min cache, but this leaks user data
// on shared devices — User B could see User A's cached API responses.

// ─── URL validation helper ───────────────────────────────────────
function safeUrl(u: string): string {
  try {
    const parsed = new URL(u, self.location.origin)
    if (parsed.origin !== self.location.origin) return '/'
    return parsed.pathname + parsed.search
  } catch { return '/' }
}

// ─── Push notifications ──────────────────────────────────────────
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
  const url = safeUrl(event.notification.data?.url || '/')
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          ;(client as WindowClient).navigate(url)
          return client.focus()
        }
      }
      return self.clients.openWindow(url)
    }),
  )
})

// ─── Local scheduled notifications ───────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SCHEDULE_NOTIFICATION') {
    const { title, body, delayMs, url } = event.data
    const safeDelay = Math.min(delayMs || 0, 5 * 60 * 1000)
    const notifOptions = {
      body: body || 'Time to study!',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: url || '/queue' },
    }
    if (safeDelay > 0) {
      setTimeout(() => {
        self.registration.showNotification(title || 'StudiesKit', notifOptions)
      }, safeDelay)
    } else {
      self.registration.showNotification(title || 'StudiesKit', notifOptions)
    }
  }
})
