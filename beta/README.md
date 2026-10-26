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

Sign-in is email and password (`signInWithPassword`). The session stays in this browser. The sign-in screen does not send a code, a magic link, or a password-reset email, and there is no authenticator step. There is no separate `#/join` page. A link that still opens the site root is forwarded to `/beta/` when the token is not for the live project. A new address is sent the Confirm signup email. A later code is sent with the Magic Link template. Both templates must contain `{{ .Token }}` and must not contain `{{ .ConfirmationURL }}`, or the message is a link instead of a code. Dashboard: Authentication → Emails → Templates → Confirm signup, and the same for Magic Link. Subject: `Your Safe Intelligence code`. Body: `Your Safe Intelligence code is {{ .Token }}`. It expires in an hour. Add these to the beta project's Auth redirect allow list (needed if a link is still in a template):

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

`generate-grok` calls the xAI Responses API (`grok-4.7`, reasoning effort `low`). It checks the signed-in user with `auth.getUser()` and does not require an authenticator. It does not check subscription or trial. `supabase/config.toml` sets `verify_jwt = false` for this function, because the beta project signs ES256 tokens. The daily cap uses the existing `bump_ai_usage` function. Redeploy `generate-grok` after pulling these changes.

Deploy **`submit-form`** to the beta project as well. It is public: a worker has no session. `verify_jwt` is false and the function checks the QR token itself. It does not call `requireAal2`. Photo and signature files go in the private `form-evidence` bucket. A stop-the-job action is stored in the app. Email is left as `emailHook: pending` until `RESEND_API_KEY` and `RESEND_FROM` are set; this function does not send mail.

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

## Sites and import

One company is one organisation. `#/setup` names the company and each site, including the client name and a logo stored in the private `site-logos` bucket. The header switches the active site. New records, injury cases, and imported people take that site id. Existing rows were backfilled onto a site named Main site. Organisation admins (`profiles.role = admin`) change sites, the company name, and the logo. PDF exports for the active site print that client name and logo.

`#/import` copies a CSV into training records, people, actions, or incidents on the active site. Map the columns, preview the rows, import the valid ones, and download an error report for the rest. An Airtable import is a one-off copy: paste a personal access token and a base ID, pick a table, map fields, and import. The token is sent once to the `airtable-import` edge function and is not stored. There is no live sync.

## QR forms

`#/hse/forms` lists submissions for the site in the header. Filter by form or by stop-the-job, open one submission, and export CSV or PDF. `#/hse/forms/codes` creates a code for Take 5, JHA, or a vehicle/plant prestart and prints a sheet with the site client name and logo. The code is a row in `qr_codes` (`target_type` `form` now; `register`, `vehicle`, and `document` are reserved). `#/f/<token>` is the public form: no login, the name is remembered on the device, and a critical No shows STOP THE JOB and files an action for the site supervisor. Set that supervisor on `#/setup`. Templates are edited on `#/admin` under QR forms, versioned in `app_config`, and audited. The prestart asks for odometer kilometres and engine hours, and either or both can be filled in.

## Training

`#/training` stores a person, role, site, one or more courses or tickets, a completed date, and an expiry on an `hse_records` row (`kind` `training`). The course field is a multi-select: tick several tickets, or import them separated by commas. The people matrix marks each ticked course. Expiring means the expiry falls within 30 days. Filter by site and role. A cell that has a record opens that record. Export CSV downloads the filtered grid and writes an audit event.

`#/registers` is the company register builder. Each base is a tile (two-letter colour, name, when it was opened). A base has tabs, a spreadsheet grid, and saved views for filter, group, sort, hidden fields, and row colour. Click a row to edit the whole record, which is the way to edit on a phone. The first visit seeds a Scaffold Register and an Equipment Inspection Register. QR Codes is a forms library: title, link, and a QR image for each code. Row changes are written to the audit trail. CSV import on a tab splits multi-select cells on commas. The older `#/hse/register` list of HSE records stays as it is.

## Inspections

`#/hse/inspections` files a checklist from the site templates (Workplace walk and Area prestart, or whatever an admin saved). Each item is pass, fail, or N/A. Every failed item creates an action, linked both ways, with the owner and due date entered on the inspection. The inspection is an `hse_records` row with `kind` `inspection`, so it shows on the daily record and in the audit trail.

## Injury cases

`#/hse/injury` opens one case per injured person and links it to an incident. Classification is FAI, MTI, LTI, or RWI, with restricted-work and return-to-work dates, days lost or restricted, a review date, mechanism, suitable duties, and case notes. The name, body part, mechanism, treatment, suitable duties, medical note, and case notes are stored on `injury_cases` and are readable only by the person who opened the case and organisation admins (`profiles.role = admin`). Other people in the organisation see `injury_case_index`: case ID, classification, status, dates including the review date, and the linked incident. The daily record and the incident show that case ID only. The audit row records the case ID, classification, and review date, not the name or the medical text.

## Actions and links

`#/hse/actions` is the actions register. The owner is picked from people in the organisation (`profiles` in that org), stored as `ownerId` plus their display name. A due date and a status (open, in progress, or done) sit on the same action. Overdue is calculated when the due date is before today in Western Australia and the status is not done. Send reminder records `remindedOn` for that Perth day (the `hse_records` audit trigger covers the update) and asks the `action-reminder` edge function to email the owner. One reminder per action per day. Email sends only when `RESEND_API_KEY` and `RESEND_FROM` are set on the beta project; otherwise the in-app reminder still records. The function does not use the signup mailer. Linking a record stores the same link on both sides. Inspections and ICAM corrective actions use the same owner list. Actions are `hse_records` rows with `kind` `action`.

## Notifiable incidents

On an incident (`#/hse/record/<id>`), flag it as notifiable to WorkSafe. That sets the notifiable check, raises the driving severity to at least 4, and opens the escalate path. The checklist records immediate notification (s.38), scene preservation (s.39), written notice within 48 hours when WorkSafe asks, and a dangerous-goods report within 21 days when dangerous goods are involved. The lodgement record stores the reference number, the date, and who lodged it on the incident, so the `hse_records` audit trigger covers it. The page links to WorkSafe’s own report page. This app does not lodge the notification.

## Investigation

`#/hse/investigate/<record id>` opens from an incident. The ICAM section records the team, the sequence of events, evidence notes and photos, the four ICAM factors (absent or failed defences, individual and team actions, task and environmental conditions, organisational factors), root and contributing factors, and a sign-off. Creating a corrective action files an action and links it both ways to the incident. Export PDF downloads that investigation. The five whys stay on the same page. Photos stay on the device; the notes sync with the incident record.

## Dashboard

`#/hse/dashboard` counts the records already filed. Filter by date range and site. Incidents split by type, severity, site, and month. Actions show open, closed in the range, and overdue. Injury cases show LTI, MTI, FAI, and RWI counts and days lost. LTIFR and TRIFR appear after hours worked are saved on that screen (LTIFR is lost-time cases × 1,000,000 ÷ hours; TRIFR adds medical treatment and restricted work). Inspections compare filings with the weekly target across the range. Lead indicators use the same starter targets. Training shows current, expiring, expired, and missing required courses. Each count links through to the record.

## Daily record

`#/hse/day` is one day at a time, defaulting to today in Western Australia. Incidents, hazards and Take 5s open the full capture form. Meetings, prestarts and toolbox talks are a short note on that day. All of them save as `hse_records` rows, using `kind` as the type.

## Admin

https://synradai.github.io/beta/#/admin

Trent opens https://synradai.github.io/beta/, enters `trentrwood@outlook.com` or `nextlevelaccess@outlook.com`, and requests the 6-digit code. That code signs him in. The signup trigger adds that user to `beta_admins`. Configuration saves for a listed beta admin. Anyone else sees a closed page.

Labels, form fields, module order, inspection templates, and training-matrix columns are stored per organisation. The app reads them at startup, refreshes when the window regains focus, and listens on Supabase realtime. Reset to default removes that key so the built-in copy is used again. Each save or reset writes an audit event with the before and after values.

## Tests

```bash
npm run test:beta
npm run build
npm run build:beta
```
