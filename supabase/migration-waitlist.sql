-- Launch waitlist — emails captured from the public waitlist.html page via the
-- `waitlist` edge function (which verifies a Turnstile token first). No RLS
-- policies on purpose: only the service role (the function) touches this table.
-- Safe to re-run.

create table if not exists public.waitlist (
  id         uuid primary key default gen_random_uuid(),
  email      text not null unique,
  name       text,
  source     text,           -- where they came from (e.g. 'waitlist-page')
  created_at timestamptz not null default now()
);

alter table public.waitlist enable row level security;
