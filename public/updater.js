// Auto-updater — beats iOS's aggressive page caching for home-screen PWAs.
//
// iOS keeps a cached copy of index.html and a normal refresh won't always pull
// a new build. This runs on every load AND every time the app is brought back
// to the foreground: it fetches build.txt (cache-busted, so always the true
// latest), and if the deployed build differs from the one we last loaded, it
// force-navigates to a fresh, cache-busting URL so the newest code loads.
(function () {
  function check() {
    try {
      fetch('build.txt?cb=' + Date.now(), { cache: 'no-store' })
        .then(function (r) { return r.ok ? r.text() : null })
        .then(function (b) {
          if (!b) return
          b = b.trim()
          if (!b) return
          var prev = localStorage.getItem('si_build')
          localStorage.setItem('si_build', b)
          if (prev && prev !== b) {
            // New deploy detected. If the offline service worker is running,
            // ask it to fetch the new build — it installs in the background,
            // takes over, and the page auto-reloads (registerSW autoUpdate).
            // Only force-navigate as a fallback when there's no SW in control.
            if (navigator.serviceWorker && navigator.serviceWorker.controller) {
              navigator.serviceWorker.getRegistration()
                .then(function (r) { if (r) r.update() })
                .catch(function () {})
            } else if (location.search.indexOf('u=' + b) === -1) {
              // Reload past the HTTP cache with a fresh URL.
              location.replace(location.pathname + '?u=' + encodeURIComponent(b))
            }
          }
        })
        .catch(function () {})
    } catch (e) { /* never block the app on the update check */ }
  }
  check()
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') check()
  })
})()
