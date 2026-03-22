/**
 * Service worker — offline caching + push + local scheduled notifications.
 */

const CACHE_NAME = 'studieskit-v2'
const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/favicon-48x48.png',
  '/icon-192.png',
]

// ─── Install: precache shell ─────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL_ASSETS))
  )
  self.skipWaiting()
})

// ─── Activate: clean old caches ──────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// ─── Fetch: caching strategies ───────────────────────────────────
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // API calls: network only (data is in IndexedDB, not cache)
  if (url.pathname.startsWith('/api/')) return

  // Static assets (JS, CSS, images, fonts): stale-while-revalidate
  if (url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|gif|woff2?|ttf|eot)$/)) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        const fetched = fetch(event.request).then(response => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone))
          }
          return response
        }).catch(() => cached)
        return cached || fetched
      })
    )
    return
  }

  // HTML navigation: network-first, fallback to cached shell
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/index.html'))
    )
    return
  }
})

// ─── URL validation helper ───────────────────────────────────────
function safeUrl(u) {
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
          client.navigate(url)
          return client.focus()
        }
      }
      return self.clients.openWindow(url)
    })
  )
})

// ─── Local scheduled notifications ───────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SCHEDULE_NOTIFICATION') {
    const { title, body, delayMs, url } = event.data
    const safeDelay = Math.min(delayMs || 0, 5 * 60 * 1000)
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
      self.registration.showNotification(title || 'StudiesKit', {
        body: body || 'Time to study!',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        data: { url: url || '/queue' },
      })
    }
  }
})
