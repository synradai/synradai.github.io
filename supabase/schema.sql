-- Safety Advisor — Supabase schema (Phase 1)
-- ---------------------------------------------------------------------------
-- Design goal: ship B2C now without blocking B2B later.
--
-- Every record carries an org_id. A solo subscriber is simply an
-- "organisation of one" — when they sign up, a trigger auto-creates their org
-- and makes them its admin. Adding B2B later means letting an admin invite more
-- users INTO an existing org; no tables change, no re-platforming.
--
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- It is safe to re-run: it uses "if not exists" / "or replace" throughout.
-- ---------------------------------------------------------------------------

-- 1. ORGANISATIONS ----------------------------------------------------------
create table if not exists public.organisations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null default 'My organisation',
  plan        text not null default 'free',      -- free | pro | team (Stripe later)
  created_at  timestamptz not null default now()
);

-- 2. PROFILES (one row per auth user, links them to an org + role) -----------
create table if not exists public.profiles (
  id        uuid primary key references auth.users(id) on delete cascade,
  org_id    uuid not null references public.organisations(id) on delete cascade,
  role      text not null default 'admin',       -- admin | member
  full_name text,
  created_at timestamptz not null default now()
);
create index if not exists profiles_org_id_idx on public.profiles(org_id);

-- 3. DATA TABLES ------------------------------------------------------------
-- Shift/incident/etc. payloads are stored as jsonb to match the app's existing
-- shapes (see the shift data shape in the app). Promoted columns (date, type)
-- exist where we want to query/sort without unpacking the blob.

create table if not exists public.shifts (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organisations(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  shift_date  date,
  data        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists shifts_org_idx  on public.shifts(org_id);
create index if not exists shifts_user_idx on public.shifts(user_id);

create table if not exists public.incidents (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organisations(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  shift_id      uuid references public.shifts(id) on delete set null,
  occurred_at   timestamptz,
  incident_type text,
  data          jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);
create index if not exists incidents_org_idx on public.incidents(org_id);

create table if not exists public.learnings (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organisations(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists learnings_org_idx on public.learnings(org_id);

create table if not exists public.field_reports (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organisations(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists field_reports_org_idx on public.field_reports(org_id);

-- 4. AUTO-CREATE AN ORG FOR EACH NEW USER (the "org of one" magic) -----------
-- On signup: make a fresh organisation and a profile that owns it as admin.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  new_org_id uuid;
begin
  insert into public.organisations (name)
    values (coalesce(new.raw_user_meta_data->>'full_name', 'My organisation'))
    returning id into new_org_id;

  insert into public.profiles (id, org_id, role, full_name)
    values (new.id, new_org_id, 'admin', new.raw_user_meta_data->>'full_name');

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 5. ROW-LEVEL SECURITY -----------------------------------------------------
-- Rule: you can only touch rows belonging to YOUR organisation. For B2C that's
-- just your own data. For B2B later, every member of an org sees the org's data
-- (tighten to role-based if you want members to see only their own).

-- Helper: the caller's org_id.
create or replace function public.current_org_id()
returns uuid
language sql stable security definer set search_path = public
as $$ select org_id from public.profiles where id = auth.uid() $$;

alter table public.organisations enable row level security;
alter table public.profiles      enable row level security;
alter table public.shifts        enable row level security;
alter table public.incidents     enable row level security;
alter table public.learnings     enable row level security;
alter table public.field_reports enable row level security;

-- Organisations: read your own org.
drop policy if exists org_select on public.organisations;
create policy org_select on public.organisations
  for select using (id = public.current_org_id());

-- Profiles: read profiles in your org; update your own.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (org_id = public.current_org_id());
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update using (id = auth.uid());

-- Generic org-scoped policy applied to each data table.
do $$
declare t text;
begin
  foreach t in array array['shifts','incidents','learnings','field_reports'] loop
    execute format('drop policy if exists %1$s_all on public.%1$s', t);
    execute format($f$
      create policy %1$s_all on public.%1$s
        for all
        using      (org_id = public.current_org_id())
        with check (org_id = public.current_org_id())
    $f$, t);
  end loop;
end $$;
