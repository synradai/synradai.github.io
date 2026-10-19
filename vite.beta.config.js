import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

// Separate build for Safe Intelligence beta. Output is dist-beta/ with
// asset URLs under /beta/, so it can be copied onto GitHub Pages later
// without replacing the live app at /.
//
// Always build with --mode beta (npm run build:beta). Vite's default build
// mode is "production", which would load .env.production — the live project.
const root = dirname(fileURLToPath(import.meta.url))

export default defineConfig(({ mode }) => {
  if (mode === 'production') {
    throw new Error(
      'Refusing to build the beta in production mode. That mode loads .env.production (the live Supabase project). Use npm run build:beta.',
    )
  }
  return {
    // Root is beta/ so the built index.html lands at dist-beta/index.html,
    // not dist-beta/beta/index.html. base '/beta/' then matches a folder
    // dropped onto GitHub Pages at /beta/.
    root: resolve(root, 'beta'),
    base: '/beta/',
    envDir: root,
    publicDir: resolve(root, 'beta/public'),
    plugins: [react()],
    build: {
      outDir: resolve(root, 'dist-beta'),
      emptyOutDir: true,
    },
    server: {
      port: 5174,
      strictPort: true,
      fs: { allow: [root] },
    },
    preview: {
      port: 4174,
      strictPort: true,
    },
  }
})
