-- Safety Advisor — COMPLETE database setup (run once in Supabase SQL Editor)
-- Combines schema + sync + billing. Idempotent: safe to re-run.
-- ---------------------------------------------------------------------------

-- 1. TABLES -----------------------------------------------------------------
create table if not exists public.organisations (
  id                      uuid primary key default gen_random_uuid(),
  name                    text not null default 'My organisation',
  plan                    text not null default 'free',
  stripe_customer_id      text,
  stripe_subscription_id  text,
  subscription_status     text,
  current_period_end      timestamptz,
  trial_ends_at           timestamptz not null default (now() + interval '14 days'),
  created_at              timestamptz not null default now()
);
create index if not exists organisations_stripe_customer_idx on public.organisations(stripe_customer_id);

create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  org_id     uuid not null references public.organisations(id) on delete cascade,
  role       text not null default 'admin',
  full_name  text,
  created_at timestamptz not null default now()
);
create index if not exists profiles_org_id_idx on public.profiles(org_id);

create table if not exists public.shifts (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organisations(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  client_id   text,
  shift_date  date,
  data        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.incidents (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organisations(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  client_id     text,
  shift_id      uuid,
  occurred_at   timestamptz,
  incident_type text,
  data          jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.learnings (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organisations(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  client_id  text,
  data       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.field_reports (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organisations(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  client_id  text,
  data       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['shifts','incidents','learnings','field_reports'] loop
    execute format('create unique index if not exists %I on public.%I (user_id, client_id)', t || '_user_client_uniq', t);
  end loop;
end $$;

-- 2. FUNCTIONS --------------------------------------------------------------
create or replace function public.current_org_id()
returns uuid language sql stable security definer set search_path = public
as $$ select org_id from public.profiles where id = auth.uid() $$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
declare new_org_id uuid;
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
  after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create or replace function public.set_row_owner()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.user_id is null then new.user_id := auth.uid(); end if;
  if new.org_id is null then new.org_id := public.current_org_id(); end if;
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['shifts','incidents','learnings','field_reports'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_set_owner', t);
    execute format('create trigger %I before insert on public.%I for each row execute function public.set_row_owner()', t || '_set_owner', t);
    execute format('drop trigger if exists %I on public.%I', t || '_touch', t);
    execute format('create trigger %I before insert or update on public.%I for each row execute function public.touch_updated_at()', t || '_touch', t);
  end loop;
end $$;

-- 3. ROW-LEVEL SECURITY -----------------------------------------------------
alter table public.organisations enable row level security;
alter table public.profiles      enable row level security;
alter table public.shifts        enable row level security;
alter table public.incidents     enable row level security;
alter table public.learnings     enable row level security;
alter table public.field_reports enable row level security;

drop policy if exists org_select on public.organisations;
create policy org_select on public.organisations for select using (id = public.current_org_id());

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select using (org_id = public.current_org_id());
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update using (id = auth.uid());

do $$
declare t text;
begin
  foreach t in array array['shifts','incidents','learnings','field_reports'] loop
    execute format('drop policy if exists %1$s_all on public.%1$s', t);
    execute format('create policy %1$s_all on public.%1$s for all using (org_id = public.current_org_id()) with check (org_id = public.current_org_id())', t);
  end loop;
end $$;

-- 4. BACKFILL existing accounts (signed up before this ran) ------------------
do $$
declare u record; new_org uuid;
begin
  for u in select id, raw_user_meta_data from auth.users where id not in (select id from public.profiles) loop
    insert into public.organisations (name)
      values (coalesce(u.raw_user_meta_data->>'full_name', 'My organisation'))
      returning id into new_org;
    insert into public.profiles (id, org_id, role, full_name)
      values (u.id, new_org, 'admin', u.raw_user_meta_data->>'full_name');
  end loop;
end $$;
