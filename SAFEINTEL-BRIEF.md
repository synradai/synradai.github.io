# SafeIntel — Safety Intelligence App

*Founding brief / product vision. This is the "why" behind the build in this repo.*

## Product
Mobile-first AI safety application. MVP built and running on phone, iteratively updated.

**Stack:** Vite/React frontend, Supabase backend, Anthropic API integration.

**Core features:**
- Incident reporting and daily meeting notes
- Field leadership observations, hazard ID, HAZOP logging
- Voice-to-text input for fast field capture
- Document scanning (JSAs, work permits, Take 5s) with text extraction
- AI-generated reports via Anthropic API (correct wording/format)
- AI safety search — pulls safety stats and patterns, improves as it trains
- Voice conversation with AI assistant

## Positioning
**Safety intelligence tool** — not a data collection app. Sell the patterns, insights,
and AI-generated reports that make advisers smarter and faster. Data flows through,
gets de-identified, what stays is the learning.

## Data strategy (critical)
De-identify documents and photos **client-side before upload**. Strip company branding,
site names, personnel details, image EXIF/metadata. Supabase retains only safety data
and analytics — never sensitive company data.

**Why this wins:**
- Reduces compliance liability (not holding sensitive data)
- Portable across all sites — generic, not company-specific
- De-identified aggregate data becomes the moat
- Future revenue: sell aggregate safety insights/trends back to mining companies

## Compliance roadmap
- Australian Privacy Act alignment
- Supabase **Sydney region** for data residency (non-negotiable)
- Privacy policy + ToS written by someone who knows the Privacy Act — not a template
- Encryption in transit (HTTPS) and at rest
- API keys server-side only, never client-side
- Rate limiting + input validation
- SOC 2 / ISO 27001 later — only when selling to big miners

## Business structure
Launch everything through **Simrad AI Pty Ltd** (holding entity). Hey Miss, SafeIntel,
and any future apps all sit under it.
*(Note: confirm exact spelling — "Simrad" vs "Synrad" — before registration/trademark.)*

**Setup checklist:**
- Company registration (Pty Ltd)
- Trust
- Business bank account
- Insurance — professional indemnity / product liability
- Finding new accountant/advisor (not happy with current people)

## App Store launch checklist
- Apple + Google developer accounts (separate)
- Code signing certificates
- Privacy policy + ToS locked in
- App permissions justified
- Copyright documented (code/branding auto-yours)
- Trademark on Simrad + app name (worth doing if serious)
- Liability insurance (the big one)

## Validation
Showed it to safety advisers on site — they tried to download it on the spot. Real
demand from people in the field. Only two comparable apps exist and neither is great.

## Why SafeIntel over Synrad AI
- Synrad was service-heavy: chasing clients, integrations, ongoing support — conflicted with home/custody goals
- SafeIntel is a product: build once, sell many, scales without being on every call
- Owns the data-insight moat; gets stronger with accumulated safety patterns
- Solves an actual market gap people are asking for

## Next steps
1. Paste founder brief prompt into Claude Code ✅ (this doc)
2. Lock down security hardening (2FA, auth, encryption)
3. Document de-identification workflow
4. Sort company structure + find right advisor
5. Plan enterprise launch strategy
