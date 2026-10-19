-- Safe Intelligence beta — org-scoped HSE register.
-- Apply on the beta project only, on top of the existing live-shaped schema.
-- Do not apply this to the live project (ref rgkiagqexoafmtxhrlqo).
--
-- Already present on that schema (this file does not recreate them):
--   public.organisations, public.profiles, public.current_org_id(),
--   the handle_new_user trigger, and the existing data tables.
-- Photos stay on the device. payload is the record without image bytes.

create table if not exists public.hse_records (
  id text primary key,
  org_id uuid not null references public.organisations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists hse_records_org_updated_idx
  on public.hse_records (org_id, updated_at desc);

create index if not exists hse_records_user_idx
  on public.hse_records (user_id);

comment on table public.hse_records is
  'Beta HSE register (incident, hazard, take 5, scene check). Org-scoped. Photos are not stored here.';

-- Stamp the caller's org and, on insert, the caller. A member cannot write
-- another organisation's id. Runs as the caller (security invoker).
create or replace function public.hse_records_stamp()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if public.current_org_id() is null then
    raise exception 'No organisation for this user';
  end if;

  if tg_op = 'INSERT' then
    new.org_id := public.current_org_id();
    new.user_id := auth.uid();
    new.created_at := coalesce(new.created_at, now());
  else
    new.org_id := old.org_id;
    new.user_id := old.user_id;
    new.created_at := old.created_at;
  end if;

  if new.updated_at is null then
    new.updated_at := now();
  end if;

  return new;
end;
$$;

revoke all on function public.hse_records_stamp() from public, anon;
grant execute on function public.hse_records_stamp() to authenticated;

drop trigger if exists hse_records_stamp on public.hse_records;
create trigger hse_records_stamp
  before insert or update on public.hse_records
  for each row execute function public.hse_records_stamp();

alter table public.hse_records enable row level security;

revoke all on public.hse_records from public, anon;
grant select, insert, update, delete on public.hse_records to authenticated;

drop policy if exists hse_records_org on public.hse_records;
create policy hse_records_org
  on public.hse_records
  for all
  to authenticated
  using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());
