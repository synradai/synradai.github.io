-- Safety Advisor — billing migration (run AFTER schema.sql)
-- ---------------------------------------------------------------------------
-- Adds subscription tracking to the organisation (the billing entity, so this
-- works for B2C "org of one" today and B2B teams later). Access model:
--   allowed = subscription_status = 'active'  OR  now() < trial_ends_at
-- i.e. everyone gets 14 free days, then needs an active subscription.
--
-- Safe to re-run. Run in Supabase → SQL Editor → New query.
-- ---------------------------------------------------------------------------

alter table public.organisations add column if not exists stripe_customer_id      text;
alter table public.organisations add column if not exists stripe_subscription_id  text;
alter table public.organisations add column if not exists subscription_status     text;            -- active | past_due | canceled | null
alter table public.organisations add column if not exists current_period_end      timestamptz;
alter table public.organisations add column if not exists trial_ends_at           timestamptz not null default (now() + interval '14 days');

-- Look up an org by its Stripe customer id (used by the webhook). The webhook
-- runs with the service role and bypasses RLS, but the index keeps it fast.
create index if not exists organisations_stripe_customer_idx
  on public.organisations(stripe_customer_id);
