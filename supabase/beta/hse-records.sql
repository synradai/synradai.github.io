-- Safe Intelligence BETA register.
-- Run this in the NEW beta Supabase project only (SQL editor or a migration
-- on that project). Do not run it on the live project
-- (ref rgkiagqexoafmtxhrlqo). The beta app will not connect to that project.
--
-- Photos stay on the device. `payload` is the record without image data.

create table if not exists public.hse_records (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists hse_records_user_updated
  on public.hse_records (user_id, updated_at desc);

alter table public.hse_records enable row level security;

revoke all on public.hse_records from anon;
grant select, insert, update, delete on public.hse_records to authenticated;

drop policy if exists "beta select own hse records" on public.hse_records;
create policy "beta select own hse records"
  on public.hse_records for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "beta insert own hse records" on public.hse_records;
create policy "beta insert own hse records"
  on public.hse_records for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "beta update own hse records" on public.hse_records;
create policy "beta update own hse records"
  on public.hse_records for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "beta delete own hse records" on public.hse_records;
create policy "beta delete own hse records"
  on public.hse_records for delete
  to authenticated
  using (auth.uid() = user_id);
