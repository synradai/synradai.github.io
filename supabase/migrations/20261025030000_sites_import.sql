-- Safe Intelligence beta — sites under one organisation, people, and branding.
-- Apply on the beta project only (ref rocobdfuvaecrkzsxqub).
-- Do not apply this to the live project.
--
-- One company is one organisation. Sites hang off that organisation.
-- Later QR forms, registers, plant, and documents use the same site id.
-- This migration does not create those tables.

create table if not exists public.sites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  name text not null,
  client_name text not null default '',
  logo_path text,
  ruleset text not null default 'general',
  created_at timestamptz not null default now(),
  constraint sites_name_org unique (org_id, name),
  constraint sites_ruleset_check check (ruleset in ('general', 'mines', 'pageo'))
);

create index if not exists sites_org_idx on public.sites (org_id, created_at);

comment on table public.sites is
  'Sites belonging to one organisation. Records and people are scoped here. Later QR forms, registers, plant, and controlled documents use this id.';

create table if not exists public.people (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  site_id uuid not null references public.sites (id) on delete restrict,
  full_name text not null,
  role text not null default '',
  email text not null default '',
  phone text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists people_org_site_idx on public.people (org_id, site_id);

comment on table public.people is
  'People at a site. Used by import now. Later sign-on and plant can use the same id.';

-- Default site for every new organisation. Does not replace handle_new_user.
create or replace function beta_private.create_default_site()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.sites (org_id, name, ruleset)
  values (new.id, 'Main site', 'general')
  on conflict (org_id, name) do nothing;
  return new;
end;
$$;

revoke all on function beta_private.create_default_site() from public, anon;
grant execute on function beta_private.create_default_site() to authenticated;

drop trigger if exists organisations_default_site on public.organisations;
create trigger organisations_default_site
  after insert on public.organisations
  for each row execute function beta_private.create_default_site();

insert into public.sites (org_id, name, ruleset)
select o.id, 'Main site', 'general'
from public.organisations o
where not exists (select 1 from public.sites s where s.org_id = o.id);

alter table public.hse_records
  add column if not exists site_id uuid;

alter table public.injury_cases
  add column if not exists site_id uuid;

alter table public.injury_case_index
  add column if not exists site_id uuid;

update public.hse_records r
set site_id = (
  select s.id from public.sites s
  where s.org_id = r.org_id
  order by s.created_at, s.id
  limit 1
)
where r.site_id is null;

update public.injury_cases c
set site_id = (
  select s.id from public.sites s
  where s.org_id = c.org_id
  order by s.created_at, s.id
  limit 1
)
where c.site_id is null;

update public.injury_case_index i
set site_id = (
  select s.id from public.sites s
  where s.org_id = i.org_id
  order by s.created_at, s.id
  limit 1
)
where i.site_id is null;

alter table public.hse_records
  alter column site_id set not null;

alter table public.injury_cases
  alter column site_id set not null;

alter table public.injury_case_index
  alter column site_id set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'hse_records_site_id_fkey'
  ) then
    alter table public.hse_records
      add constraint hse_records_site_id_fkey
      foreign key (site_id) references public.sites (id) on delete restrict;
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'injury_cases_site_id_fkey'
  ) then
    alter table public.injury_cases
      add constraint injury_cases_site_id_fkey
      foreign key (site_id) references public.sites (id) on delete restrict;
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'injury_case_index_site_id_fkey'
  ) then
    alter table public.injury_case_index
      add constraint injury_case_index_site_id_fkey
      foreign key (site_id) references public.sites (id) on delete restrict;
  end if;
end $$;

create index if not exists hse_records_site_idx on public.hse_records (org_id, site_id);
create index if not exists injury_cases_site_idx on public.injury_cases (org_id, site_id);

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

  if new.site_id is not null and not exists (
    select 1 from public.sites s
    where s.id = new.site_id and s.org_id = new.org_id
  ) then
    raise exception 'Site is not in this organisation';
  end if;

  if new.site_id is null then
    select s.id into new.site_id
    from public.sites s
    where s.org_id = new.org_id
    order by s.created_at, s.id
    limit 1;
  end if;

  if new.site_id is null then
    raise exception 'This organisation has no site';
  end if;

  if new.updated_at is null then
    new.updated_at := now();
  end if;

  return new;
end;
$$;

revoke all on function public.hse_records_stamp() from public, anon;
grant execute on function public.hse_records_stamp() to authenticated;

create or replace function public.sites_stamp()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if (select count(*) from public.sites where org_id = old.org_id) <= 1 then
      raise exception 'Keep at least one site';
    end if;
    return old;
  end if;

  if tg_op = 'INSERT' then
    -- A signed-in member is forced onto their own organisation.
    -- Signup and the backfill insert a site before a profile exists, and
    -- they already set org_id. Row level security still blocks a member
    -- with no organisation from writing through the API.
    if public.current_org_id() is not null then
      new.org_id := public.current_org_id();
    elsif new.org_id is null then
      raise exception 'No organisation for this site';
    end if;
    new.created_at := coalesce(new.created_at, now());
  else
    new.id := old.id;
    new.org_id := old.org_id;
    new.created_at := old.created_at;
  end if;

  new.name := left(btrim(coalesce(new.name, '')), 160);
  if new.name = '' then
    raise exception 'Add the site name';
  end if;
  if new.ruleset is null or new.ruleset not in ('general', 'mines', 'pageo') then
    new.ruleset := 'general';
  end if;
  new.client_name := left(btrim(coalesce(new.client_name, '')), 160);
  return new;
end;
$$;

revoke all on function public.sites_stamp() from public, anon;
grant execute on function public.sites_stamp() to authenticated;

drop trigger if exists sites_stamp on public.sites;
create trigger sites_stamp
  before insert or update or delete on public.sites
  for each row execute function public.sites_stamp();

create or replace function public.people_stamp()
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
    new.created_at := coalesce(new.created_at, now());
  else
    new.id := old.id;
    new.org_id := old.org_id;
    new.created_at := old.created_at;
  end if;

  if not exists (
    select 1 from public.sites s
    where s.id = new.site_id and s.org_id = new.org_id
  ) then
    raise exception 'Site is not in this organisation';
  end if;

  new.full_name := left(btrim(coalesce(new.full_name, '')), 160);
  if new.full_name = '' then
    raise exception 'Add the name';
  end if;
  new.role := left(btrim(coalesce(new.role, '')), 160);
  new.email := left(btrim(coalesce(new.email, '')), 160);
  new.phone := left(btrim(coalesce(new.phone, '')), 40);
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.people_stamp() from public, anon;
grant execute on function public.people_stamp() to authenticated;

drop trigger if exists people_stamp on public.people;
create trigger people_stamp
  before insert or update on public.people
  for each row execute function public.people_stamp();

create or replace function public.organisations_guard()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.id := old.id;
  new.plan := old.plan;
  new.created_at := old.created_at;
  new.name := left(btrim(coalesce(new.name, '')), 160);
  if new.name = '' then
    raise exception 'Add the company name';
  end if;
  return new;
end;
$$;

revoke all on function public.organisations_guard() from public, anon;
grant execute on function public.organisations_guard() to authenticated;

drop trigger if exists organisations_guard on public.organisations;
create trigger organisations_guard
  before update on public.organisations
  for each row execute function public.organisations_guard();

create or replace function beta_private.stamp_injury_case()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  next_seq integer;
begin
  if tg_op = 'INSERT' then
    new.org_id := public.current_org_id();
    new.user_id := (select auth.uid());
    if new.org_id is null or new.user_id is null then
      raise exception 'Sign in before opening an injury case';
    end if;
    perform pg_advisory_xact_lock(hashtext(new.org_id::text));
    select coalesce(max(seq), 0) + 1 into next_seq
      from public.injury_cases
      where org_id = new.org_id;
    new.seq := next_seq;
    new.case_code := 'INJ-' || lpad(next_seq::text, 4, '0');
    new.created_at := now();
  else
    new.org_id := old.org_id;
    new.user_id := old.user_id;
    new.seq := old.seq;
    new.case_code := old.case_code;
    new.created_at := old.created_at;
  end if;

  if new.site_id is not null and not exists (
    select 1 from public.sites s
    where s.id = new.site_id and s.org_id = new.org_id
  ) then
    raise exception 'Site is not in this organisation';
  end if;

  if new.site_id is null then
    select s.id into new.site_id
    from public.sites s
    where s.org_id = new.org_id
    order by s.created_at, s.id
    limit 1;
  end if;

  if new.site_id is null then
    raise exception 'This organisation has no site';
  end if;

  new.person_name := left(btrim(coalesce(new.person_name, '')), 160);
  new.body_part := left(coalesce(new.body_part, ''), 160);
  new.treatment := left(coalesce(new.treatment, ''), 2000);
  new.note := left(coalesce(new.note, ''), 4000);
  new.mechanism := left(coalesce(new.mechanism, ''), 500);
  new.duties := left(coalesce(new.duties, ''), 4000);
  new.case_notes := left(coalesce(new.case_notes, ''), 4000);
  new.event_id := left(btrim(coalesce(new.event_id, '')), 80);
  if new.person_name = '' or new.event_id = '' then
    raise exception 'An injury case needs a person and a linked event';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create or replace function beta_private.sync_injury_index()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.injury_case_index
      where org_id = old.org_id and id = old.id;
    return old;
  end if;
  insert into public.injury_case_index (
    id, org_id, site_id, case_code, event_id, classification, status, restricted_from, rtw_on, review_on, created_at
  ) values (
    new.id, new.org_id, new.site_id, new.case_code, new.event_id, new.classification, new.status,
    new.restricted_from, new.rtw_on, new.review_on, new.created_at
  )
  on conflict (org_id, id) do update set
    site_id = excluded.site_id,
    case_code = excluded.case_code,
    event_id = excluded.event_id,
    classification = excluded.classification,
    status = excluded.status,
    restricted_from = excluded.restricted_from,
    rtw_on = excluded.rtw_on,
    review_on = excluded.review_on;
  return new;
end;
$$;

create or replace function beta_private.injury_brief(case_row public.injury_cases)
returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_object(
    'case_code', coalesce(case_row.case_code, ''),
    'classification', coalesce(case_row.classification, ''),
    'status', coalesce(case_row.status, ''),
    'event_id', coalesce(case_row.event_id, ''),
    'review_on', coalesce(case_row.review_on::text, ''),
    'site_id', coalesce(case_row.site_id::text, '')
  );
$$;

revoke all on function beta_private.injury_brief(public.injury_cases) from public, anon, authenticated;

create or replace function beta_private.audit_site()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  next_action text;
  label text;
  brief_before jsonb;
  brief_after jsonb;
begin
  label := left(coalesce(new.name, old.name, ''), 160);
  if tg_op = 'INSERT' then
    next_action := 'create';
    brief_after := jsonb_build_object(
      'name', label,
      'client_name', left(coalesce(new.client_name, ''), 160),
      'ruleset', coalesce(new.ruleset, ''),
      'has_logo', new.logo_path is not null
    );
  elsif tg_op = 'UPDATE' then
    next_action := 'update';
    brief_before := jsonb_build_object(
      'name', left(coalesce(old.name, ''), 160),
      'client_name', left(coalesce(old.client_name, ''), 160),
      'ruleset', coalesce(old.ruleset, ''),
      'has_logo', old.logo_path is not null
    );
    brief_after := jsonb_build_object(
      'name', label,
      'client_name', left(coalesce(new.client_name, ''), 160),
      'ruleset', coalesce(new.ruleset, ''),
      'has_logo', new.logo_path is not null
    );
  else
    next_action := 'delete';
    brief_before := jsonb_build_object(
      'name', label,
      'ruleset', coalesce(old.ruleset, ''),
      'has_logo', old.logo_path is not null
    );
  end if;

  insert into public.audit_events (org_id, actor_id, action, entity, entity_id, summary, before, after)
  values (
    coalesce(new.org_id, old.org_id),
    auth.uid(),
    next_action,
    'sites',
    coalesce(new.id, old.id)::text,
    format(
      '%s site%s',
      case next_action when 'create' then 'Created' when 'update' then 'Updated' else 'Deleted' end,
      case when label <> '' then ' · ' || label else '' end
    ),
    brief_before,
    brief_after
  );
  return coalesce(new, old);
end;
$$;

revoke all on function beta_private.audit_site() from public, anon;
grant execute on function beta_private.audit_site() to authenticated;

drop trigger if exists audit_site on public.sites;
create trigger audit_site
  after insert or update or delete on public.sites
  for each row execute function beta_private.audit_site();

create or replace function beta_private.audit_person()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  next_action text;
  label text;
  brief_before jsonb;
  brief_after jsonb;
begin
  label := left(coalesce(new.full_name, old.full_name, ''), 160);
  if tg_op = 'INSERT' then
    next_action := 'create';
    brief_after := jsonb_build_object(
      'full_name', label,
      'role', left(coalesce(new.role, ''), 160),
      'site_id', coalesce(new.site_id::text, '')
    );
  elsif tg_op = 'UPDATE' then
    next_action := 'update';
    brief_before := jsonb_build_object(
      'full_name', left(coalesce(old.full_name, ''), 160),
      'role', left(coalesce(old.role, ''), 160),
      'site_id', coalesce(old.site_id::text, '')
    );
    brief_after := jsonb_build_object(
      'full_name', label,
      'role', left(coalesce(new.role, ''), 160),
      'site_id', coalesce(new.site_id::text, '')
    );
  else
    next_action := 'delete';
    brief_before := jsonb_build_object(
      'full_name', label,
      'role', left(coalesce(old.role, ''), 160),
      'site_id', coalesce(old.site_id::text, '')
    );
  end if;

  insert into public.audit_events (org_id, actor_id, action, entity, entity_id, summary, before, after)
  values (
    coalesce(new.org_id, old.org_id),
    auth.uid(),
    next_action,
    'people',
    coalesce(new.id, old.id)::text,
    format(
      '%s person%s',
      case next_action when 'create' then 'Created' when 'update' then 'Updated' else 'Deleted' end,
      case when label <> '' then ' · ' || label else '' end
    ),
    brief_before,
    brief_after
  );
  return coalesce(new, old);
end;
$$;

revoke all on function beta_private.audit_person() from public, anon;
grant execute on function beta_private.audit_person() to authenticated;

drop trigger if exists audit_person on public.people;
create trigger audit_person
  after insert or update or delete on public.people
  for each row execute function beta_private.audit_person();

alter table public.sites enable row level security;
alter table public.people enable row level security;

revoke all on public.sites from public, anon;
revoke all on public.people from public, anon;
grant select, insert, update, delete on public.sites to authenticated;
grant select, insert, update, delete on public.people to authenticated;
grant update on public.organisations to authenticated;

drop policy if exists sites_read on public.sites;
create policy sites_read
  on public.sites
  for select
  to authenticated
  using (org_id = public.current_org_id());

drop policy if exists sites_insert on public.sites;
create policy sites_insert
  on public.sites
  for insert
  to authenticated
  with check (org_id = public.current_org_id() and beta_private.is_org_admin());

drop policy if exists sites_update on public.sites;
create policy sites_update
  on public.sites
  for update
  to authenticated
  using (org_id = public.current_org_id() and beta_private.is_org_admin())
  with check (org_id = public.current_org_id() and beta_private.is_org_admin());

drop policy if exists sites_delete on public.sites;
create policy sites_delete
  on public.sites
  for delete
  to authenticated
  using (org_id = public.current_org_id() and beta_private.is_org_admin());

drop policy if exists people_org on public.people;
create policy people_org
  on public.people
  for all
  to authenticated
  using (org_id = public.current_org_id())
  with check (
    org_id = public.current_org_id()
    and exists (
      select 1 from public.sites s
      where s.id = site_id and s.org_id = public.current_org_id()
    )
  );

drop policy if exists organisations_admin_update on public.organisations;
create policy organisations_admin_update
  on public.organisations
  for update
  to authenticated
  using (id = public.current_org_id() and beta_private.is_org_admin())
  with check (id = public.current_org_id() and beta_private.is_org_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site-logos', 'site-logos', false, 1048576, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists site_logos_read on storage.objects;
create policy site_logos_read
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'site-logos'
    and (storage.foldername(name))[1] = public.current_org_id()::text
  );

drop policy if exists site_logos_insert on storage.objects;
create policy site_logos_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'site-logos'
    and (storage.foldername(name))[1] = public.current_org_id()::text
    and beta_private.is_org_admin()
  );

drop policy if exists site_logos_update on storage.objects;
create policy site_logos_update
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'site-logos'
    and (storage.foldername(name))[1] = public.current_org_id()::text
    and beta_private.is_org_admin()
  )
  with check (
    bucket_id = 'site-logos'
    and (storage.foldername(name))[1] = public.current_org_id()::text
    and beta_private.is_org_admin()
  );

drop policy if exists site_logos_delete on storage.objects;
create policy site_logos_delete
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'site-logos'
    and (storage.foldername(name))[1] = public.current_org_id()::text
    and beta_private.is_org_admin()
  );
