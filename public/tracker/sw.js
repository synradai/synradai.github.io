/* Replaces SwingTrack's /tracker/sw.js. The next visit updates that
   registration, drops only the swingtrack caches, and unregisters.
   Other caches on this origin (the Safe Intelligence shell) stay. */
self.addEventListener('install', function () {
  self.skipWaiting()
})

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (key) {
        return key.indexOf('swingtrack') === 0
      }).map(function (key) {
        return caches.delete(key)
      }))
    }).then(function () {
      return self.clients.matchAll({ type: 'window' })
    }).then(function (windows) {
      return self.registration.unregister().then(function () {
        return Promise.all(windows.map(function (client) {
          return client.navigate(client.url)
        }))
      })
    })
  )
})
