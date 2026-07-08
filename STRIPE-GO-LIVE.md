# Stripe Go-Live Runbook — Safe Intelligence

Everything staged so the test→live flip takes under an hour. **Do not flip until
the three gates are closed** (per Director's ruling, 2026-07-08 company run).

## Gates (all must be ✓ before going live)

- [ ] **ABN registered** (abr.gov.au — free, ~30 min, usually instant)
- [ ] **Lawyer-reviewed** Terms / Privacy / AI disclaimer published
- [ ] **Insurance policy in force** (broker confirmed classification: software vs professional advice)
- [x] AI disclaimer acknowledgment gate live in app (named + logged) — done 2026-07-08

## Trent's steps (need your identity/bank — I can't do these)

1. **Activate the live Stripe account**: Stripe Dashboard → leave the Sandbox
   (top-left account picker) → complete business activation: sole trader details,
   **ABN**, bank account for payouts, ID verification.
2. **Create the live product**: Product "Safe Intelligence", recurring price
   **A$29/month**. Copy the live `price_...` id.
   - Pricing decision first (Marketer/Director recommendation): sign-up copy
     should say **"Early supporter rate — $29/month for your first 6 months,
     then $49/month"**. If adopting, we implement the 6-month step-up later via
     a scheduled price migration; the founding price object stays $29.
3. **Live webhook**: Developers → Webhooks → Add endpoint (in LIVE mode):
   - URL: `https://rgkiagqexoafmtxhrlqo.supabase.co/functions/v1/stripe-webhook`
   - Events: `checkout.session.completed`, `customer.subscription.created`,
     `customer.subscription.updated`, `customer.subscription.deleted`
   - Copy the live `whsec_...` signing secret.
4. Hand me: the **live secret key** (a *restricted* key is fine — same scopes as
   the test one), the **live price id**, and the **live webhook secret**.

## My steps (once you hand those over)

1. Set edge-function secrets to the live values: `STRIPE_SECRET_KEY`,
   `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET` (via Management API).
2. End-to-end test with a real card (yours): subscribe → verify org flips to
   `active` via webhook → open billing portal → cancel → verify status updates
   → refund the test charge in the dashboard.
3. Verify failed-payment flow behaviour (subscription_status handling).
4. Confirm no secret keys anywhere in the frontend (already true — checkout is
   server-side; re-audit on flip day anyway).

## GST note

Not registered for GST (and not required under A$75k turnover). Stripe invoices
will carry the ABN once activation is done. When approaching $75k/yr: register
for GST, enable Stripe Tax, price becomes GST-inclusive — revisit then.

## Rollback

Swap the three secrets back to the test values — the app needs no redeploy
(functions read secrets at runtime).
