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

Sign-in is on the home screen. Account creation is a direct route, `#/join` (for example `http://localhost:4174/beta/#/join`). That route is not linked from sign-in. Email confirmation is on for the beta project, so the first account has to confirm before signing in. Add these to the beta project's Auth redirect allow list:

- `https://synradai.github.io/beta/`
- `http://localhost:4174/beta/`
- `http://localhost:5174/beta/`

Until `.env.beta` has the new project, the sign-in screen offers **Continue on this device**. Records stay in this browser.

## Env (`.env.beta`)

| Variable | Purpose |
| --- | --- |
| `VITE_SUPABASE_URL` | Beta project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Publishable key (`sb_publishable_...`). A legacy anon JWT is not required. `VITE_SUPABASE_ANON_KEY` also works |
| `VITE_AI_PROXY_URL` | `https://<beta-ref>.supabase.co/functions/v1/generate-grok` |

The app refuses to connect if the URL is the live project. The beta client does not call `quick-worker`, so the 14-day trial and the 402 from that function do not block this build.

## Edge function to deploy

Deploy **`generate-grok`** to the beta project only. Leave `quick-worker`, `billing`, `stripe-webhook`, and `waitlist` as they are.

```bash
supabase functions deploy generate-grok --project-ref <beta-ref>
```

Secrets: `XAI_API_KEY`. Optional: `XAI_TEXT_MODEL` and `XAI_VISION_MODEL` (both default `grok-4.7`), `AI_PROVIDER` (`xai` default, or `anthropic`), `AI_FALLBACK` (`none` default, or `anthropic`), `ANTHROPIC_API_KEY`, `CLAUDE_MODEL`, `AI_DAILY_LIMIT`.

`generate-grok` checks the signed-in user and does not check subscription or trial.

## Register table

Apply `supabase/migrations/20261019060723_beta_hse_records.sql` on the beta project. It adds `public.hse_records` with org-scoped RLS on top of the existing schema. Photos stay on the device.

## Tests

```bash
npm run test:beta
npm run build
npm run build:beta
```
