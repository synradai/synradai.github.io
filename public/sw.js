const CACHE_NAME = 'safety-advisor-v2'
const TIMEOUT_MS = 3000

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// Network-first (with a short timeout): when online, always fetch the latest
// version so updates appear on the next load. Falls back to cache if the
// network is slow/unavailable — lets the app still open with no signal
// (FIFO sites often have none).
self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET' || !request.url.startsWith(self.location.origin)) return

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const networkFetch = fetch(request)
        .then((response) => {
          if (response.ok) cache.put(request, response.clone())
          return response
        })
        .catch(() => null)

      const timeout = new Promise((resolve) => setTimeout(() => resolve(null), TIMEOUT_MS))

      const fast = await Promise.race([networkFetch, timeout])
      if (fast) return fast

      const cached = await cache.match(request)
      return cached || networkFetch
    })
  )
})
