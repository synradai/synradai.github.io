// Self-clean / kill-switch service worker.
// The previous caching SW served stale builds (blank screen after each deploy).
// This version takes over, wipes all caches, unregisters itself, and reloads
// open pages so the device always loads the latest version straight off the
// network. (A proper offline-capable SW can come back later, post-iteration.)
self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys()
      await Promise.all(keys.map((k) => caches.delete(k)))
      await self.registration.unregister()
      const clients = await self.clients.matchAll({ type: 'window' })
      clients.forEach((c) => c.navigate(c.url))
    } catch (_) { /* best effort */ }
  })())
})

// No caching — let every request go straight to the network.
self.addEventListener('fetch', () => {})
