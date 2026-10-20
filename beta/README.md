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

Sign-in and sign-up are the same screen. Enter an email and choose **Email me a 6-digit code**. That calls `signInWithOtp` with `shouldCreateUser: true`, so a new address creates an `auth.users` row and an existing address signs in. There is no separate `#/join` page. Password sign-in stays behind **Use a password instead**. A returning browser session skips the email step and asks only for the authenticator code. A new address is sent the Confirm signup email. A later code is sent with the Magic Link template. Both templates must contain `{{ .Token }}` and must not contain `{{ .ConfirmationURL }}`, or the message is a link instead of a code. Dashboard: Authentication → Emails → Templates → Confirm signup, and the same for Magic Link. Subject: `Your Safe Intelligence code`. Body: `Your Safe Intelligence code is {{ .Token }}`. It expires in an hour. Add these to the beta project's Auth redirect allow list (needed if a link is still in a template):

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

`generate-grok` calls the xAI Responses API (`grok-4.7`, reasoning effort `low`). It checks the signed-in user with `auth.getUser()` and does not check subscription or trial. `supabase/config.toml` sets `verify_jwt = false` for this function only, because the beta project signs ES256 tokens. The daily cap uses the existing `bump_ai_usage` function. Redeploy `generate-grok` after pulling these changes.

## Register table

Apply these on the beta project, in order:

1. `supabase/migrations/20261019060723_beta_hse_records.sql` — adds `public.hse_records` with org-scoped RLS. Photos stay on the device.
2. `supabase/migrations/20261019073248_hse_records_unique_per_org.sql` — primary key becomes `(org_id, id)`.
3. `supabase/migrations/20261019235000_beta_admin_config.sql` — `beta_admins`, versioned `app_config`, and append-only `audit_events`. Apply on the beta project only.
4. `supabase/migrations/20261020001000_hse_record_audit.sql` — audit trigger on `hse_records`.
5. `supabase/migrations/20261020002000_injury_cases.sql` — private injury cases and the public case-ID index.

## Audit

`#/hse/audit` lists append-only events. A database trigger writes one when an `hse_records` row is created, edited, or deleted. The before and after values are a short summary (kind, status, severity, label), not the record body. Exporting the list writes an export event. Configuration saves are audited the same way.

## Record export

The daily record exports CSV and PDF for a day or a date range. Columns are day, time, kind, title, status, site, a short summary, and injury case IDs. The export does not include an injured person's name, treatment, or medical note. Saving the file writes an export event on the audit trail.

## Lead indicators

`#/kpis` counts the selected week, Monday to Sunday in Western Australia: prestarts, toolbox talks, inspections, observations (hazard reports), and actions marked done on or before their due date. Each count has a starter target. Maintenance, stores, and scaffold stay previews.

## Training

`#/training` stores a person, role, course or ticket, completed date, and expiry. A record with an expiry inside 30 days is marked expiring, and a past expiry is expired. The matrix lists each role on the records against the required courses from site configuration. Covered means someone in that role holds a current ticket. Expiring is shown on its own. A gap means the role has no current ticket for that course. Maintenance, stores, and scaffold stay previews.

## Inspections

`#/hse/inspections` files a checklist from the site templates (Workplace walk and Area prestart, or whatever an admin saved). Each item is pass, fail, or N/A. Every failed item creates an action, linked both ways, with the owner and due date entered on the inspection. The inspection is an `hse_records` row with `kind` `inspection`, so it shows on the daily record and in the audit trail.

## Injury cases

`#/hse/injury` opens one case per injured person and links it to an incident. Classification is FAI, MTI, LTI, or RWI, with restricted-work and return-to-work dates, days lost or restricted, a review date, mechanism, suitable duties, and case notes. The name, body part, mechanism, treatment, suitable duties, medical note, and case notes are stored on `injury_cases` and are readable only by the person who opened the case and organisation admins (`profiles.role = admin`). Other people in the organisation see `injury_case_index`: case ID, classification, status, dates including the review date, and the linked incident. The daily record and the incident show that case ID only. The audit row records the case ID, classification, and review date, not the name or the medical text.

## Actions and links

`#/hse/actions` is the actions register. Each action has an owner, a due date, and a status (open, in progress, or done). Overdue is calculated when the due date is before today in Western Australia and the status is not done. Linking a record stores the same link on both sides, and those links show on the daily record timeline and on each record. Raising an action from a record links it automatically. Actions are `hse_records` rows with `kind` `action`, so the audit trigger covers them.

## Investigation

`#/hse/investigate/<record id>` opens from an incident. The ICAM section records the team, the sequence of events, evidence notes and photos, the four ICAM factors (absent or failed defences, individual and team actions, task and environmental conditions, organisational factors), root and contributing factors, and a sign-off. Creating a corrective action files an action and links it both ways to the incident. Export PDF downloads that investigation. The five whys stay on the same page. Photos stay on the device; the notes sync with the incident record.

## Dashboard

`#/hse/dashboard` counts the records already filed. Filter by date range and site. Incidents split by type, severity, site, and month. Actions show open, closed in the range, and overdue. Injury cases show LTI, MTI, FAI, and RWI counts and days lost. LTIFR and TRIFR appear after hours worked are saved on that screen (LTIFR is lost-time cases × 1,000,000 ÷ hours; TRIFR adds medical treatment and restricted work). Inspections compare filings with the weekly target across the range. Lead indicators use the same starter targets. Training shows current, expiring, expired, and missing required courses. Each count links through to the record.

## Daily record

`#/hse/day` is one day at a time, defaulting to today in Western Australia. Incidents, hazards and Take 5s open the full capture form. Meetings, prestarts and toolbox talks are a short note on that day. All of them save as `hse_records` rows, using `kind` as the type.

## Admin

https://synradai.github.io/beta/#/admin

Trent opens https://synradai.github.io/beta/, enters `trentrwood@outlook.com` or `nextlevelaccess@outlook.com`, and requests the 6-digit code. The signup trigger adds that user to `beta_admins`. He then enrols an authenticator. Configuration saves only after the session is authenticator-verified (aal2). Anyone else sees a closed page.

Labels, form fields, module order, inspection templates, and training-matrix columns are stored per organisation. The app reads them at startup, refreshes when the window regains focus, and listens on Supabase realtime. Reset to default removes that key so the built-in copy is used again. Each save or reset writes an audit event with the before and after values.

## Tests

```bash
npm run test:beta
npm run build
npm run build:beta
```
