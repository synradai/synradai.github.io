-- Client error log — lightweight crash reporting without a third-party service.
-- The app inserts a row when it hits an uncaught error on a user's device
-- (capped per session, message/stack truncated client-side). Users can only
-- INSERT their own rows and can never read any (no select policy) — reading is
-- done by us via the SQL editor / Management API. Safe to re-run.

create table if not exists public.client_errors (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind       text,          -- 'error' | 'promise'
  message    text,
  stack      text,
  url        text,          -- app path where it happened
  ua         text,          -- device/browser
  build      text,          -- build.txt stamp the device was running
  created_at timestamptz not null default now()
);

alter table public.client_errors enable row level security;

drop policy if exists client_errors_insert on public.client_errors;
create policy client_errors_insert on public.client_errors
  for insert to authenticated with check (user_id = auth.uid());
