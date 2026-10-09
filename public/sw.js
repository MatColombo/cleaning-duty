const VERSION = 'v2.0.0-rc.1'
const BRAND_ASSET_REVISION = 'retro-assets-v2-rc1'
const SHELL_CACHE = `house-care-shell-${VERSION}-${BRAND_ASSET_REVISION}`
const RUNTIME_CACHE = `house-care-runtime-${VERSION}-${BRAND_ASSET_REVISION}`
const SHELL = ['/', '/manifest.webmanifest', '/icon.svg', '/brand/v2/house-care-app-mark.svg', '/brand/v2/house-care-maskable-mark.svg', '/brand/v2/favicon-32.png?v=2.0.0-rc.1', '/brand/v2/apple-touch-icon.png?v=2.0.0-rc.1', '/brand/v2/app-icon-192.png?v=2.0.0-rc.1', '/brand/v2/app-icon-512.png?v=2.0.0-rc.1', '/brand/v2/app-icon-maskable-192.png?v=2.0.0-rc.1', '/brand/v2/app-icon-maskable-512.png?v=2.0.0-rc.1', '/icon-192.png', '/icon-512.png']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL)))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys
      .filter((key) => ![SHELL_CACHE, RUNTIME_CACHE].includes(key))
      .map((key) => caches.delete(key))))
  )
  self.clients.claim()
})

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone()
          caches.open(RUNTIME_CACHE).then((cache) => cache.put('/', clone))
          return response
        })
        .catch(async () => (await caches.match(request)) || (await caches.match('/')))
    )
    return
  }

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      if (response.ok) {
        const clone = response.clone()
        caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, clone))
      }
      return response
    }))
  )
})

self.addEventListener('push', (event) => {
  let payload = {}
  try { payload = event.data?.json() || {} } catch { payload = { body: event.data?.text() || '' } }
  const title = payload.title || 'House Care'
  event.waitUntil(self.registration.showNotification(title, {
    body: payload.body || 'You have a household activity due.',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: payload.tag || 'house-care-reminder',
    renotify: false,
    data: { url: payload.url || '/', taskId: payload.taskId },
  }))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = new URL(event.notification.data?.url || '/', self.location.origin).href
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clients) => {
    for (const client of clients) {
      if ('focus' in client) {
        await client.navigate(targetUrl)
        return client.focus()
      }
    }
    return self.clients.openWindow(targetUrl)
  }))
})
