// Raftaar's service worker: lets the app open without a connection (at a pump with no signal), showing what was
// last seen, so a fill-up can still be logged and sent later (see src/outbox.ts).
//
// - App files (/assets/*, hashed): from the cache once fetched; they never change.
// - Pages and data (GET /api/*): fresh from the network when it answers; the last copy when it doesn't.
// - Anything else GET (icons, manifest): the cached copy straight away, refreshed in the background.
// Nothing but GET is touched: saving always goes to the server (or to the outbox when offline).
const APP = 'raftaar-app-v1'
const DATA = 'raftaar-data-v1'

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(APP).then((c) => c.addAll(['/'])).catch(() => undefined))
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== APP && k !== DATA).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  )
})

// Signing out: forget the data this browser kept.
self.addEventListener('message', (e) => {
  if (e.data === 'clear-data') e.waitUntil(caches.delete(DATA))
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return
  // the OIDC sign-in redirects must always reach the server; exports are downloads, not worth keeping a copy of
  if (url.pathname.startsWith('/oauth2/') || url.pathname.startsWith('/login/') || url.pathname.startsWith('/api/export/')) return

  if (req.mode === 'navigate') {
    e.respondWith(networkFirst(req, APP, '/'))
  } else if (url.pathname.startsWith('/api/')) {
    e.respondWith(networkFirst(req, DATA))
  } else if (url.pathname.startsWith('/assets/')) {
    e.respondWith(cacheFirst(req, APP))
  } else {
    e.respondWith(staleWhileRevalidate(req, APP))
  }
})

async function networkFirst(req, cacheName, fallbackUrl) {
  const cache = await caches.open(cacheName)
  try {
    const res = await fetch(req)
    if (res.ok) cache.put(fallbackUrl ?? req, res.clone())
    return res
  } catch (err) {
    const hit = await cache.match(fallbackUrl ?? req)
    if (hit) return hit
    throw err
  }
}

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName)
  const hit = await cache.match(req)
  if (hit) return hit
  const res = await fetch(req)
  if (res.ok) cache.put(req, res.clone())
  return res
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName)
  const hit = await cache.match(req)
  const fresh = fetch(req).then((res) => {
    if (res.ok) cache.put(req, res.clone())
    return res
  }).catch(() => hit)
  return hit ?? fresh
}

// Notifications by Web Push (Settings → Notifications → This device): the server sends { title, body, url },
// encrypted for this browser; it's shown here, and tapping it opens that page in the app (an open window if there is one).
self.addEventListener('push', (e) => {
  let message = { title: 'Raftaar', body: '', url: '/' }
  try {
    message = { ...message, ...e.data.json() }
  } catch {
    if (e.data) message.body = e.data.text()
  }
  e.waitUntil(self.registration.showNotification(message.title, {
    body: message.body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { url: message.url },
  }))
})

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const url = new URL(e.notification.data?.url ?? '/', self.location.origin).href
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
    const open = windows.find((w) => new URL(w.url).origin === self.location.origin)
    if (open) return open.focus().then((w) => w.navigate(url))
    return self.clients.openWindow(url)
  }))
})
