# Legal Review Brief — Safe Intelligence (Synrad AI)

*Ready to email to a fixed-fee tech firm (e.g. Sprintlaw, LegalVision). Ask for
a fixed-fee quote and turnaround up front.*

---

**To:** [firm]
**From:** Trent [surname], sole trader trading as **Synrad AI** (ABN: [pending — registering this week]), Mandurah WA. Contact: synradai@outlook.com

## What I'm asking for

A fixed-fee review of three documents for a paid consumer SaaS product, plus
answers to the specific questions below:

1. Terms of Service — live at https://synradai.github.io/terms.html
2. Privacy Policy — live at https://synradai.github.io/privacy.html
3. AI & Safety disclaimer (in-app; text available on request)

All three were self-drafted without legal review. The product is about to take
its first paying subscribers.

## What the product is

**Safe Intelligence** (https://synradai.github.io) — a web app for FIFO mining
safety advisors in WA. Subscription A$29/month via Stripe, 14-day free trial.
Users are individual safety professionals (B2C); possible company licences later.

Features: daily shift workflow (handovers, meetings, site rounds), incident
reports, field leadership reports, a daily work log, document scanning, and AI
assistance throughout.

## The AI parts (the area I most want scrutiny on)

- **"Gaz"** — an AI assistant that answers safety questions, drawing on general
  knowledge of Australian/WA WHS legislation and publicly documented mining
  operator safety frameworks. It is instructed to tell users to verify against
  their site's current procedures, and not to present company rules as
  authoritative.
- **AI-drafted reports** — the app turns the user's own notes/voice into
  formatted incident / field leadership / findings reports. The user reviews and
  edits before using them.
- AI processing is done by **Anthropic** (US company) via API — prompt content
  crosses borders. No user data is used to train models (API terms).
- **In-app acknowledgment**: before first use, every user must acknowledge a
  plain-language disclaimer (AI can be wrong; not professional/legal advice;
  verify before acting; user stays responsible). The acknowledgment is recorded
  server-side with name, date, and account.

## Data we hold

- Account data: email, name, password hash (Supabase auth), 2FA optional.
- Safety records the user creates: shift logs, incident reports (may name
  individuals and describe injuries — potentially health/sensitive information),
  photos, AI chat history.
- Hosting: Supabase (currently **Seoul region — overseas storage**), payments by
  Stripe. The app has built-in de-identification features (strips company
  names/branding from AI-processed documents; user-configurable name stripping).
- Users can self-delete their account and all data in-app (Privacy Act erasure +
  App Store requirement).

## Specific questions

1. **Liability limitation** — are our limitation/exclusion clauses enforceable
   under Australian Consumer Law for a paid consumer product, given the safety
   context? What wording do we need?
2. **AI disclaimer adequacy** — in a safety-critical industry, is our disclaimer
   plus logged acknowledgment reasonably protective? What's missing? Worst case:
   the AI gives an incorrect answer about a WHS obligation and a user acts on it
   before an incident.
3. **Privacy Act / APPs** — is the policy adequate for: overseas disclosure
   (Anthropic US, hosting in Korea), potentially sensitive/health information in
   incident reports, and our de-identification claims?
4. **Structure** — does staying a sole trader materially change my personal
   exposure vs incorporating a Pty Ltd before taking paying customers? Blunt
   recommendation wanted.
5. **Subscriptions** — any mandatory disclosure/auto-renewal wording for AU
   consumer subscriptions we're missing at checkout?
6. **Beta testers** — anything extra needed for ~10 free beta users before
   public launch (they use the same terms)?

## Practical

- Fixed fee and turnaround estimate before starting, please.
- Deliverable: tracked changes/redlines on the three documents + short written
  answers to the six questions.
