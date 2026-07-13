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
        // /tracker/ (SwingTrack) is a separate standalone PWA with its own
        // service worker — keep it out of this app's precache and never serve
        // the Safe Intelligence shell for its navigations.
        globIgnores: ['tracker/**'],
        navigateFallbackDenylist: [/^\/tracker\//],
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
