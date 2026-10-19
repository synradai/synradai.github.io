# Safe Intelligence beta 1

Private field-test build. It is not the live app at `https://synradai.github.io/`.

The beta is a separate Vite build with `base: '/beta/'`. Hash routes (`#/hse`, `#/stores`) mean GitHub Pages can host it without a server rewrite. The live `npm run build` does not bundle these screens.

## Build and serve

```bash
cp .env.beta.example .env.beta
# fill the NEW project values, then:
npm run build:beta
npm run preview:beta
```

Open `http://localhost:4174/beta/`.

`npm run build:beta` uses Vite mode `beta`, so `.env.beta` is loaded and `.env.production` (the live project) is not. A production-mode build of this config is refused.

To put it on GitHub Pages later, copy the contents of `dist-beta/` into the site at `/beta/` and deploy **with** the service-worker change on this branch (`/beta` is excluded from the live app shell). Do not merge until that is intended. The live site does not change until `main` is updated.

Until `.env.beta` has the new project, the sign-in screen offers **Continue on this device**. Records stay in this browser.

## Env (`.env.beta`)

| Variable | Purpose |
| --- | --- |
| `VITE_SUPABASE_URL` | Beta project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Publishable (anon) key. `VITE_SUPABASE_ANON_KEY` also works |
| `VITE_AI_PROXY_URL` | `https://<beta-ref>.supabase.co/functions/v1/generate-grok` |

The app refuses to connect if the URL is the live project.

## Edge function (not deployed)

`supabase/functions/generate-grok` — deploy only to the beta project.

Secrets: `XAI_API_KEY`. Optional: `XAI_TEXT_MODEL` and `XAI_VISION_MODEL` (both default `grok-4.7`), `AI_PROVIDER` (`xai` or `anthropic`), `AI_FALLBACK` (`none` or `anthropic`), `ANTHROPIC_API_KEY`, `CLAUDE_MODEL`, `AI_DAILY_LIMIT`.

Register table: run `supabase/beta/hse-records.sql` on the beta project only. Photos stay on the device.

## Tests

```bash
npm run test:beta
npm run build
npm run build:beta
```
