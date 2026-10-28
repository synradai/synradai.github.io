import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    // Offline-first service worker (Workbox). Precaches the app shell so the
    // app opens with no signal; auto-updates on each deploy (new SW installs,
    // takes over immediately, and the page reloads — see registerSW in
    // main.jsx). build.txt is deliberately NOT precached: updater.js polls it
    // straight off the network to detect new deploys.
    VitePWA({
      registerType: 'autoUpdate',
      // Keep using our hand-written public/manifest.webmanifest (already
      // linked in index.html) rather than generating one.
      manifest: false,
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,webmanifest}'],
        // /tracker/ and /muay-thai/ are now redirects off this origin. They must
        // stay out of this service worker so it cannot replace those pages with
        // the Safe Intelligence shell. /tracker/ still ships its own sw.js, which
        // only unregisters the old SwingTrack worker. /muay-thai/ never had one.
        // /beta/ is the Safe Intelligence beta build. It must not be precached
        // or served as this app's shell when both are on GitHub Pages.
        // globPatterns would otherwise precache those index.html files, and the
        // navigation fallback would serve this app's shell for those URLs
        // (including with no slash, and with a query string).
        globIgnores: ['tracker/**', 'muay-thai/**', 'beta/**', 'app/**'],
        navigateFallbackDenylist: [/^\/tracker\//, /^\/muay-thai(?:\/|\?|$)/, /^\/beta(?:\/|\?|$)/, /^\/app(?:\/|\?|$)/],
        cleanupOutdatedCaches: true,
        // App data/API calls (Supabase, AI proxy) always go to the network —
        // never cache them. Only same-origin static assets are precached, plus
        // the Google Fonts below so the UI renders offline.
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-css' },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-files',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
})
