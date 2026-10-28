-- Safe Intelligence: consolidated LIVE migration (DRY-RUN FIRST on a branch/scratch copy).
-- Source: migrations as applied on beta rocobdfuvaecrkzsxqub, in order. Generated 25 Oct 2026 AWST.
-- EXCLUDED: baseline_from_live (live already has it) and the authenticator-only migration (never applied on beta either).
-- REVIEW: grant_beta_admin_safe inserts beta user ids - must be re-pointed to Trent's LIVE auth user id.
begin;

-- ===== 20261019072758 beta_hse_records =====
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
;

-- ===== 20261019073556 hse_records_unique_per_org =====
-- Safe Intelligence beta — hse_records ids are unique per organisation.
-- Apply on the beta project only, after 20261019060723_beta_hse_records.sql.
-- Do not apply this to the live project (ref rgkiagqexoafmtxhrlqo).
--
-- Client ids are short text tokens, not uuids. A global primary key on id
-- would reject the same token in a second organisation. The key is
-- (org_id, id). RLS still limits each caller to current_org_id().

alter table public.hse_records drop constraint if exists hse_records_pkey;

alter table public.hse_records
  add constraint hse_records_pkey primary key (org_id, id);
;

-- ===== 20261019212751 harden_profiles_and_current_org_id =====
revoke update on public.profiles from authenticated;
grant update (full_name) on public.profiles to authenticated;
alter policy profiles_update on public.profiles using (id = auth.uid()) with check (id = auth.uid());
-- anon also inherits EXECUTE via PUBLIC, so revoke both and re-grant the roles that need it
revoke execute on function public.current_org_id() from public, anon;
grant execute on function public.current_org_id() to authenticated, service_role;;

-- ===== 20261019212814 revoke_anon_update_profiles =====
revoke update on public.profiles from anon;;

-- ===== 20261019212824 revoke_anon_update_profiles_columns =====
revoke update (id, org_id, role, full_name, created_at) on public.profiles from anon;;

-- ===== 20261019235016 beta_admin_config =====
-- Safe Intelligence beta — admin editor config.
-- Apply on the beta project only (ref rocobdfuvaecrkzsxqub).
-- Do not apply this to any other project.
--
-- beta_admins is filled by a signup trigger for two email addresses.
-- app_config is JSON per key, per organisation, with a version.
-- Writes require a listed admin in the caller's organisation.
-- Each insert, update, and delete writes an append-only audit event.

create schema if not exists beta_private;

revoke all on schema beta_private from public, anon;
grant usage on schema beta_private to authenticated, supabase_auth_admin;

create table if not exists public.beta_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now()
);

comment on table public.beta_admins is
  'Beta admin allow-list. Rows are added by beta_private.grant_beta_admin, not by the client.';

create table if not exists public.app_config (
  org_id uuid not null references public.organisations (id) on delete cascade,
  key text not null,
  value jsonb not null,
  version integer not null default 1,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  primary key (org_id, key),
  constraint app_config_key_check check (
    key in ('wording', 'forms', 'modules', 'inspection_templates', 'training_matrix')
  ),
  constraint app_config_value_size check (octet_length(value::text) < 200000)
);

comment on table public.app_config is
  'Per-organisation beta configuration. Code defaults apply when a key is absent.';

create table if not exists public.app_config_versions (
  org_id uuid not null references public.organisations (id) on delete cascade,
  key text not null,
  version integer not null,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  primary key (org_id, key, version)
);

comment on table public.app_config_versions is
  'Previous and current app_config values. Clients cannot write this table.';

create table if not exists public.audit_events (
  id bigint generated always as identity primary key,
  org_id uuid not null references public.organisations (id) on delete cascade,
  actor_id uuid,
  action text not null,
  entity text not null,
  entity_id text,
  summary text,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now(),
  constraint audit_events_action_check check (action in ('create', 'update', 'delete', 'export'))
);

create index if not exists audit_events_org_created_idx
  on public.audit_events (org_id, created_at desc);

comment on table public.audit_events is
  'Append-only audit. Clients can read their organisation. Writes come from triggers.';

create or replace function public.is_beta_admin()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1
    from public.beta_admins
    where user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_beta_admin() from public, anon;
grant execute on function public.is_beta_admin() to authenticated;

create or replace function public.app_config_stamp()
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
    new.version := 1;
  else
    new.org_id := old.org_id;
    new.version := old.version + 1;
  end if;

  new.updated_by := auth.uid();
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.app_config_stamp() from public, anon;
grant execute on function public.app_config_stamp() to authenticated;

drop trigger if exists app_config_stamp on public.app_config;
create trigger app_config_stamp
  before insert or update on public.app_config
  for each row execute function public.app_config_stamp();

create or replace function beta_private.audit_app_config()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  next_action text;
  next_summary text;
  org uuid;
begin
  org := coalesce(new.org_id, old.org_id);

  if tg_op = 'INSERT' then
    next_action := 'create';
    next_summary := format('Created %s v%s', new.key, new.version);
  elsif tg_op = 'UPDATE' then
    next_action := 'update';
    next_summary := format('Updated %s v%s to v%s', new.key, old.version, new.version);
  else
    next_action := 'delete';
    next_summary := format('Reset %s to default (was v%s)', old.key, old.version);
  end if;

  if tg_op <> 'DELETE' then
    insert into public.app_config_versions (org_id, key, version, value, updated_at, updated_by)
    values (new.org_id, new.key, new.version, new.value, new.updated_at, new.updated_by)
    on conflict (org_id, key, version) do nothing;
  end if;

  insert into public.audit_events (org_id, actor_id, action, entity, entity_id, summary, before, after)
  values (
    org,
    auth.uid(),
    next_action,
    'app_config',
    coalesce(new.key, old.key),
    next_summary,
    case when tg_op = 'INSERT' then null else old.value end,
    case when tg_op = 'DELETE' then null else new.value end
  );

  return coalesce(new, old);
end;
$$;

revoke all on function beta_private.audit_app_config() from public, anon;
grant execute on function beta_private.audit_app_config() to authenticated;

drop trigger if exists audit_app_config on public.app_config;
create trigger audit_app_config
  after insert or update or delete on public.app_config
  for each row execute function beta_private.audit_app_config();

create or replace function beta_private.grant_beta_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is not null and lower(new.email) in (
    'trentrwood@outlook.com',
    'nextlevelaccess@outlook.com'
  ) then
    insert into public.beta_admins (user_id, email)
    values (new.id, lower(new.email))
    on conflict (user_id) do update set email = excluded.email;
  end if;
  return new;
end;
$$;

revoke all on function beta_private.grant_beta_admin() from public, anon, authenticated;
grant execute on function beta_private.grant_beta_admin() to supabase_auth_admin;

drop trigger if exists beta_admin_on_signup on auth.users;
create trigger beta_admin_on_signup
  after insert or update of email on auth.users
  for each row execute function beta_private.grant_beta_admin();

insert into public.beta_admins (user_id, email)
select id, lower(email)
from auth.users
where email is not null
  and lower(email) in ('trentrwood@outlook.com', 'nextlevelaccess@outlook.com')
on conflict (user_id) do update set email = excluded.email;

alter table public.beta_admins enable row level security;
alter table public.app_config enable row level security;
alter table public.app_config_versions enable row level security;
alter table public.audit_events enable row level security;

revoke all on public.beta_admins from public, anon, authenticated;
grant select on public.beta_admins to authenticated;

revoke all on public.app_config from public, anon, authenticated;
grant select, insert, update, delete on public.app_config to authenticated;

revoke all on public.app_config_versions from public, anon, authenticated;
grant select on public.app_config_versions to authenticated;

revoke all on public.audit_events from public, anon, authenticated;
grant select on public.audit_events to authenticated;

drop policy if exists beta_admins_self on public.beta_admins;
create policy beta_admins_self
  on public.beta_admins
  for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists app_config_read on public.app_config;
create policy app_config_read
  on public.app_config
  for select
  to authenticated
  using (org_id = public.current_org_id());

drop policy if exists app_config_insert on public.app_config;
create policy app_config_insert
  on public.app_config
  for insert
  to authenticated
  with check (
    org_id = public.current_org_id()
    and public.is_beta_admin()
  );

drop policy if exists app_config_update on public.app_config;
create policy app_config_update
  on public.app_config
  for update
  to authenticated
  using (
    org_id = public.current_org_id()
    and public.is_beta_admin()
  )
  with check (
    org_id = public.current_org_id()
    and public.is_beta_admin()
  );

drop policy if exists app_config_delete on public.app_config;
create policy app_config_delete
  on public.app_config
  for delete
  to authenticated
  using (
    org_id = public.current_org_id()
    and public.is_beta_admin()
  );

drop policy if exists app_config_versions_read on public.app_config_versions;
create policy app_config_versions_read
  on public.app_config_versions
  for select
  to authenticated
  using (org_id = public.current_org_id());

drop policy if exists audit_events_read on public.audit_events;
create policy audit_events_read
  on public.audit_events
  for select
  to authenticated
  using (org_id = public.current_org_id());

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'app_config'
  ) then
    alter publication supabase_realtime add table public.app_config;
  end if;
end $$;
;

-- ===== 20261019235839 hse_record_audit =====
create or replace function beta_private.hse_record_brief(payload jsonb, kind text)
returns jsonb
language sql
immutable
set search_path = public
as $$
  select jsonb_build_object(
    'kind', coalesce(kind, ''),
    'status', coalesce(payload->>'status', ''),
    'severity', coalesce(payload->>'severity', ''),
    'label', left(coalesce(
      payload #>> '{fields,title}',
      payload #>> '{fields,topic}',
      payload #>> '{fields,task}',
      payload #>> '{fields,siteArea}',
      ''
    ), 160)
  );
$$;

revoke all on function beta_private.hse_record_brief(jsonb, text) from public, anon, authenticated;

create or replace function beta_private.audit_hse_record()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  brief_before jsonb;
  brief_after jsonb;
  next_action text;
  kind text;
  label text;
begin
  kind := coalesce(new.kind, old.kind, 'record');

  if tg_op = 'INSERT' then
    next_action := 'create';
    brief_after := beta_private.hse_record_brief(new.payload, new.kind);
    label := coalesce(brief_after->>'label', '');
  elsif tg_op = 'UPDATE' then
    next_action := 'update';
    brief_before := beta_private.hse_record_brief(old.payload, old.kind);
    brief_after := beta_private.hse_record_brief(new.payload, new.kind);
    label := coalesce(brief_after->>'label', '');
  else
    next_action := 'delete';
    brief_before := beta_private.hse_record_brief(old.payload, old.kind);
    label := coalesce(brief_before->>'label', '');
  end if;

  insert into public.audit_events (org_id, actor_id, action, entity, entity_id, summary, before, after)
  values (
    coalesce(new.org_id, old.org_id),
    auth.uid(),
    next_action,
    'hse_records',
    coalesce(new.id, old.id),
    format(
      '%s %s%s',
      case next_action when 'create' then 'Created' when 'update' then 'Updated' else 'Deleted' end,
      kind,
      case when label <> '' then ' · ' || label else '' end
    ),
    brief_before,
    brief_after
  );

  return coalesce(new, old);
end;
$$;

revoke all on function beta_private.audit_hse_record() from public, anon;
grant execute on function beta_private.audit_hse_record() to authenticated;

drop trigger if exists audit_hse_record on public.hse_records;
create trigger audit_hse_record
  after insert or update or delete on public.hse_records
  for each row execute function beta_private.audit_hse_record();

grant insert on public.audit_events to authenticated;
grant usage, select on sequence public.audit_events_id_seq to authenticated;

drop policy if exists audit_events_export on public.audit_events;
create policy audit_events_export
  on public.audit_events
  for insert
  to authenticated
  with check (
    org_id = public.current_org_id()
    and actor_id = (select auth.uid())
    and action = 'export'
    and entity is not null
    and before is null
  );
;

-- ===== 20261020001006 injury_cases =====
-- Safe Intelligence beta — injury cases.
-- Apply on the beta project only (ref rocobdfuvaecrkzsxqub).
-- The name, body part, treatment, and note are readable only by the creator
-- and organisation admins (profiles.role = admin). Everyone else in the org
-- sees injury_case_index: case id, classification, status, dates, and the
-- linked event. Audit rows use that same public summary.

create or replace function beta_private.is_org_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and org_id = public.current_org_id()
      and role = 'admin'
  );
$$;

revoke all on function beta_private.is_org_admin() from public, anon;
grant execute on function beta_private.is_org_admin() to authenticated;

create table if not exists public.injury_cases (
  id text not null,
  org_id uuid not null references public.organisations(id) on delete cascade,
  user_id uuid not null,
  seq integer not null,
  case_code text not null,
  event_id text not null,
  person_name text not null,
  body_part text not null default '',
  treatment text not null default '',
  classification text not null,
  status text not null default 'open',
  restricted_from date,
  rtw_on date,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (org_id, id),
  unique (org_id, seq),
  unique (org_id, case_code),
  constraint injury_cases_classification check (classification in ('FAI', 'MTI', 'LTI', 'RWI')),
  constraint injury_cases_status check (status in ('open', 'restricted', 'returned', 'closed'))
);

create index if not exists injury_cases_event_idx on public.injury_cases (org_id, event_id);

create table if not exists public.injury_case_index (
  id text not null,
  org_id uuid not null references public.organisations(id) on delete cascade,
  case_code text not null,
  event_id text not null,
  classification text not null,
  status text not null,
  restricted_from date,
  rtw_on date,
  created_at timestamptz not null default now(),
  primary key (org_id, id)
);

create index if not exists injury_case_index_event_idx on public.injury_case_index (org_id, event_id);

alter table public.injury_cases enable row level security;
alter table public.injury_case_index enable row level security;

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
  new.person_name := left(btrim(coalesce(new.person_name, '')), 160);
  new.body_part := left(coalesce(new.body_part, ''), 160);
  new.treatment := left(coalesce(new.treatment, ''), 2000);
  new.note := left(coalesce(new.note, ''), 4000);
  new.event_id := left(btrim(coalesce(new.event_id, '')), 80);
  if new.person_name = '' or new.event_id = '' then
    raise exception 'An injury case needs a person and a linked event';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function beta_private.stamp_injury_case() from public, anon;
grant execute on function beta_private.stamp_injury_case() to authenticated;

drop trigger if exists stamp_injury_case on public.injury_cases;
create trigger stamp_injury_case
  before insert or update on public.injury_cases
  for each row execute function beta_private.stamp_injury_case();

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
    id, org_id, case_code, event_id, classification, status, restricted_from, rtw_on, created_at
  ) values (
    new.id, new.org_id, new.case_code, new.event_id, new.classification, new.status,
    new.restricted_from, new.rtw_on, new.created_at
  )
  on conflict (org_id, id) do update set
    case_code = excluded.case_code,
    event_id = excluded.event_id,
    classification = excluded.classification,
    status = excluded.status,
    restricted_from = excluded.restricted_from,
    rtw_on = excluded.rtw_on;
  return new;
end;
$$;

revoke all on function beta_private.sync_injury_index() from public, anon;
grant execute on function beta_private.sync_injury_index() to authenticated;

drop trigger if exists sync_injury_index on public.injury_cases;
create trigger sync_injury_index
  after insert or update or delete on public.injury_cases
  for each row execute function beta_private.sync_injury_index();

create or replace function beta_private.injury_brief(case_row public.injury_cases)
returns jsonb
language sql
immutable
set search_path = public
as $$
  select jsonb_build_object(
    'case_code', coalesce(case_row.case_code, ''),
    'classification', coalesce(case_row.classification, ''),
    'status', coalesce(case_row.status, ''),
    'event_id', coalesce(case_row.event_id, '')
  );
$$;

revoke all on function beta_private.injury_brief(public.injury_cases) from public, anon, authenticated;

create or replace function beta_private.audit_injury_case()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  next_action text;
  brief_before jsonb;
  brief_after jsonb;
  code text;
begin
  if tg_op = 'INSERT' then
    next_action := 'create';
    brief_after := beta_private.injury_brief(new);
    code := new.case_code;
  elsif tg_op = 'UPDATE' then
    next_action := 'update';
    brief_before := beta_private.injury_brief(old);
    brief_after := beta_private.injury_brief(new);
    code := new.case_code;
  else
    next_action := 'delete';
    brief_before := beta_private.injury_brief(old);
    code := old.case_code;
  end if;

  insert into public.audit_events (org_id, actor_id, action, entity, entity_id, summary, before, after)
  values (
    coalesce(new.org_id, old.org_id),
    auth.uid(),
    next_action,
    'injury_cases',
    coalesce(new.id, old.id),
    format(
      '%s injury case %s',
      case next_action when 'create' then 'Created' when 'update' then 'Updated' else 'Deleted' end,
      coalesce(code, '')
    ),
    brief_before,
    brief_after
  );
  return coalesce(new, old);
end;
$$;

revoke all on function beta_private.audit_injury_case() from public, anon;
grant execute on function beta_private.audit_injury_case() to authenticated;

drop trigger if exists audit_injury_case on public.injury_cases;
create trigger audit_injury_case
  after insert or update or delete on public.injury_cases
  for each row execute function beta_private.audit_injury_case();

drop policy if exists injury_cases_select on public.injury_cases;
create policy injury_cases_select on public.injury_cases
  for select to authenticated
  using (
    org_id = public.current_org_id()
    and (user_id = (select auth.uid()) or beta_private.is_org_admin())
  );

drop policy if exists injury_cases_insert on public.injury_cases;
create policy injury_cases_insert on public.injury_cases
  for insert to authenticated
  with check (
    org_id = public.current_org_id()
    and user_id = (select auth.uid())
  );

drop policy if exists injury_cases_update on public.injury_cases;
create policy injury_cases_update on public.injury_cases
  for update to authenticated
  using (
    org_id = public.current_org_id()
    and (user_id = (select auth.uid()) or beta_private.is_org_admin())
  )
  with check (org_id = public.current_org_id());

drop policy if exists injury_cases_delete on public.injury_cases;
create policy injury_cases_delete on public.injury_cases
  for delete to authenticated
  using (
    org_id = public.current_org_id()
    and (user_id = (select auth.uid()) or beta_private.is_org_admin())
  );

drop policy if exists injury_case_index_select on public.injury_case_index;
create policy injury_case_index_select on public.injury_case_index
  for select to authenticated
  using (org_id = public.current_org_id());

grant select, insert, update, delete on public.injury_cases to authenticated;
grant select on public.injury_case_index to authenticated;
revoke insert, update, delete on public.injury_case_index from authenticated, anon;
;

-- ===== 20261020032315 grant_beta_admin_safe =====
-- A failure while recording beta_admins must not roll back the auth.users insert.
create or replace function beta_private.grant_beta_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is not null and lower(new.email) in (
    'trentrwood@outlook.com',
    'nextlevelaccess@outlook.com'
  ) then
    begin
      insert into public.beta_admins (user_id, email)
      values (new.id, lower(new.email))
      on conflict (user_id) do update set email = excluded.email;
    exception
      when others then
        raise warning 'grant_beta_admin skipped for %: %', new.id, sqlerrm;
    end;
  end if;
  return new;
end;
$$;

revoke all on function beta_private.grant_beta_admin() from public, anon, authenticated;
grant execute on function beta_private.grant_beta_admin() to supabase_auth_admin;
;

-- ===== 20261020065914 injury_rtw =====
-- Return-to-work fields on injury cases. Medical text stays off the public index.

alter table public.injury_cases
  add column if not exists mechanism text not null default '',
  add column if not exists duties text not null default '',
  add column if not exists case_notes text not null default '',
  add column if not exists review_on date;

alter table public.injury_case_index
  add column if not exists review_on date;

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
    id, org_id, case_code, event_id, classification, status, restricted_from, rtw_on, review_on, created_at
  ) values (
    new.id, new.org_id, new.case_code, new.event_id, new.classification, new.status,
    new.restricted_from, new.rtw_on, new.review_on, new.created_at
  )
  on conflict (org_id, id) do update set
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
immutable
set search_path = public
as $$
  select jsonb_build_object(
    'case_code', coalesce(case_row.case_code, ''),
    'classification', coalesce(case_row.classification, ''),
    'status', coalesce(case_row.status, ''),
    'event_id', coalesce(case_row.event_id, ''),
    'review_on', coalesce(case_row.review_on::text, '')
  );
$$;
;

-- ===== 20261025031915 sites_import =====
-- loaded from file in the next attempt if this placeholder fails
select 1;;

-- ===== 20261025031937 sites_import_tables =====
-- Safe Intelligence beta — sites under one organisation, people, and branding.
-- Apply on the beta project only (ref rocobdfuvaecrkzsxqub).
-- Do not apply this to the live project.

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
;

-- ===== 20261025031955 sites_import_stamps =====
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
;

-- ===== 20261025032012 sites_import_injury =====
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
;

-- ===== 20261025032025 sites_import_audit =====
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
;

-- ===== 20261025032036 sites_import_rls =====
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
;

-- ===== 20261025053107 qr_forms =====
-- loaded from file in the next step;

-- ===== 20261025055300 qr_forms_tables =====
alter table public.sites add column if not exists supervisor_id uuid references public.profiles (id) on delete set null;
create index if not exists sites_supervisor_idx on public.sites (supervisor_id);
create table if not exists public.qr_codes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  site_id uuid not null references public.sites (id) on delete restrict,
  token text not null unique,
  target_type text not null,
  target_id text not null,
  label text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint qr_codes_target_type_check check (target_type in ('form', 'register', 'vehicle', 'document')),
  constraint qr_codes_token_check check (token ~ '^[A-Za-z0-9_-]{20,80}$')
);
create index if not exists qr_codes_org_site_idx on public.qr_codes (org_id, site_id);
comment on table public.qr_codes is 'Generic site QR code. target_type form is live. register, vehicle, and document are reserved so later modules can reuse this table.';
create table if not exists public.form_submissions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  site_id uuid not null references public.sites (id) on delete restrict,
  qr_id uuid not null references public.qr_codes (id) on delete restrict,
  form_id text not null,
  form_version integer not null default 0,
  form_title text not null default '',
  area_label text not null default '',
  person_name text not null,
  company text not null default '',
  role text not null default '',
  answers jsonb not null default '{}'::jsonb,
  failed jsonb not null default '[]'::jsonb,
  stopped boolean not null default false,
  action_id text,
  created_at timestamptz not null default now()
);
create index if not exists form_submissions_org_site_idx on public.form_submissions (org_id, site_id, created_at desc);
create index if not exists form_submissions_qr_created_idx on public.form_submissions (qr_id, created_at desc);
comment on table public.form_submissions is 'One filled QR form. Answers store storage paths, not image bytes. Writes go through the submit-form edge function.';
alter table public.app_config drop constraint if exists app_config_key_check;
alter table public.app_config add constraint app_config_key_check check (key in ('wording', 'forms', 'modules', 'inspection_templates', 'training_matrix', 'qr_forms'));;

-- ===== 20261025055318 qr_forms_stamps =====
create or replace function public.hse_records_stamp()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if tg_op = 'INSERT' and auth.role() = 'service_role' then
    if new.org_id is null or new.user_id is null then
      raise exception 'Service insert needs an organisation and a member';
    end if;
    if not exists (select 1 from public.profiles p where p.id = new.user_id and p.org_id = new.org_id) then
      raise exception 'That member is not in this organisation';
    end if;
    new.created_at := coalesce(new.created_at, now());
  else
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
  end if;
  if new.site_id is not null and not exists (select 1 from public.sites s where s.id = new.site_id and s.org_id = new.org_id) then
    raise exception 'Site is not in this organisation';
  end if;
  if new.site_id is null then
    select s.id into new.site_id from public.sites s where s.org_id = new.org_id order by s.created_at, s.id limit 1;
  end if;
  if new.site_id is null then
    raise exception 'This organisation has no site';
  end if;
  if new.updated_at is null then new.updated_at := now(); end if;
  return new;
end;
$$;
revoke all on function public.hse_records_stamp() from public, anon;
grant execute on function public.hse_records_stamp() to authenticated, service_role;

create or replace function public.sites_stamp()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    if (select count(*) from public.sites where org_id = old.org_id) <= 1 then
      raise exception 'Keep at least one site';
    end if;
    return old;
  end if;
  if tg_op = 'INSERT' then
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
  if new.name = '' then raise exception 'Add the site name'; end if;
  if new.ruleset is null or new.ruleset not in ('general', 'mines', 'pageo') then new.ruleset := 'general'; end if;
  new.client_name := left(btrim(coalesce(new.client_name, '')), 160);
  if new.supervisor_id is not null and not exists (select 1 from public.profiles p where p.id = new.supervisor_id and p.org_id = new.org_id) then
    raise exception 'Supervisor is not in this organisation';
  end if;
  return new;
end;
$$;
revoke all on function public.sites_stamp() from public, anon;
grant execute on function public.sites_stamp() to authenticated;

create or replace function public.qr_codes_stamp()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if tg_op = 'DELETE' then return old; end if;
  if public.current_org_id() is null then raise exception 'No organisation for this user'; end if;
  if tg_op = 'INSERT' then
    new.org_id := public.current_org_id();
    new.created_at := coalesce(new.created_at, now());
    if new.active is null then new.active := true; end if;
  else
    new.id := old.id;
    new.org_id := old.org_id;
    new.site_id := old.site_id;
    new.token := old.token;
    new.target_type := old.target_type;
    new.target_id := old.target_id;
    new.created_at := old.created_at;
  end if;
  if not exists (select 1 from public.sites s where s.id = new.site_id and s.org_id = new.org_id) then
    raise exception 'Site is not in this organisation';
  end if;
  new.label := left(btrim(coalesce(new.label, '')), 160);
  new.target_id := left(btrim(coalesce(new.target_id, '')), 160);
  if new.target_id = '' then raise exception 'QR target is missing'; end if;
  if new.token is null or new.token !~ '^[A-Za-z0-9_-]{20,80}$' then raise exception 'QR token is not valid'; end if;
  return new;
end;
$$;
revoke all on function public.qr_codes_stamp() from public, anon;
grant execute on function public.qr_codes_stamp() to authenticated;
drop trigger if exists qr_codes_stamp on public.qr_codes;
create trigger qr_codes_stamp before insert or update or delete on public.qr_codes for each row execute function public.qr_codes_stamp();

create or replace function public.form_submissions_stamp()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Submissions are filed through the form code';
  end if;
  if tg_op = 'UPDATE' then
    new.id := old.id; new.org_id := old.org_id; new.site_id := old.site_id; new.qr_id := old.qr_id;
    new.form_id := old.form_id; new.form_version := old.form_version; new.form_title := old.form_title;
    new.area_label := old.area_label; new.person_name := old.person_name; new.company := old.company;
    new.role := old.role; new.answers := old.answers; new.failed := old.failed; new.stopped := old.stopped;
    new.created_at := old.created_at;
    return new;
  end if;
  if new.org_id is null or new.site_id is null or new.qr_id is null then
    raise exception 'Submission is missing its code';
  end if;
  if not exists (select 1 from public.qr_codes q where q.id = new.qr_id and q.org_id = new.org_id and q.site_id = new.site_id and q.active and q.target_type = 'form') then
    raise exception 'QR code is not an active form';
  end if;
  new.person_name := left(btrim(coalesce(new.person_name, '')), 160);
  if new.person_name = '' then raise exception 'Add your name'; end if;
  new.company := left(btrim(coalesce(new.company, '')), 160);
  new.role := left(btrim(coalesce(new.role, '')), 160);
  new.form_id := left(btrim(coalesce(new.form_id, '')), 80);
  new.form_title := left(btrim(coalesce(new.form_title, '')), 160);
  new.area_label := left(btrim(coalesce(new.area_label, '')), 160);
  new.created_at := coalesce(new.created_at, now());
  if new.answers is null then new.answers := '{}'::jsonb; end if;
  if new.failed is null then new.failed := '[]'::jsonb; end if;
  if new.stopped is null then new.stopped := false; end if;
  return new;
end;
$$;
revoke all on function public.form_submissions_stamp() from public, anon, authenticated;
grant execute on function public.form_submissions_stamp() to service_role;
drop trigger if exists form_submissions_stamp on public.form_submissions;
create trigger form_submissions_stamp before insert or update on public.form_submissions for each row execute function public.form_submissions_stamp();;

-- ===== 20261025055334 qr_forms_rls =====
alter table public.qr_codes enable row level security;
alter table public.form_submissions enable row level security;
revoke all on public.qr_codes from public, anon;
grant select, insert, update, delete on public.qr_codes to authenticated;
revoke all on public.form_submissions from public, anon, authenticated;
grant select on public.form_submissions to authenticated;
grant all on public.qr_codes to service_role;
grant all on public.form_submissions to service_role;
drop policy if exists qr_codes_select on public.qr_codes;
create policy qr_codes_select on public.qr_codes for select to authenticated using (org_id = public.current_org_id());
drop policy if exists qr_codes_insert on public.qr_codes;
create policy qr_codes_insert on public.qr_codes for insert to authenticated with check (org_id = public.current_org_id() and beta_private.is_org_admin());
drop policy if exists qr_codes_update on public.qr_codes;
create policy qr_codes_update on public.qr_codes for update to authenticated using (org_id = public.current_org_id() and beta_private.is_org_admin()) with check (org_id = public.current_org_id() and beta_private.is_org_admin());
drop policy if exists qr_codes_delete on public.qr_codes;
create policy qr_codes_delete on public.qr_codes for delete to authenticated using (org_id = public.current_org_id() and beta_private.is_org_admin());
drop policy if exists form_submissions_select on public.form_submissions;
create policy form_submissions_select on public.form_submissions for select to authenticated using (org_id = public.current_org_id());
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('form-evidence', 'form-evidence', false, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists form_evidence_read on storage.objects;
create policy form_evidence_read on storage.objects for select to authenticated using (bucket_id = 'form-evidence' and (storage.foldername(name))[1] = public.current_org_id()::text);;

-- ===== 20261025055338 qr_forms_audit =====
create or replace function beta_private.audit_site()
returns trigger language plpgsql security definer set search_path = public as $$
declare next_action text; label text; brief_before jsonb; brief_after jsonb;
begin
  label := left(coalesce(new.name, old.name, ''), 160);
  if tg_op = 'INSERT' then
    next_action := 'create';
    brief_after := jsonb_build_object('name', label, 'client_name', left(coalesce(new.client_name, ''), 160), 'ruleset', coalesce(new.ruleset, ''), 'has_logo', new.logo_path is not null, 'has_supervisor', new.supervisor_id is not null);
  elsif tg_op = 'UPDATE' then
    next_action := 'update';
    brief_before := jsonb_build_object('name', left(coalesce(old.name, ''), 160), 'client_name', left(coalesce(old.client_name, ''), 160), 'ruleset', coalesce(old.ruleset, ''), 'has_logo', old.logo_path is not null, 'has_supervisor', old.supervisor_id is not null);
    brief_after := jsonb_build_object('name', label, 'client_name', left(coalesce(new.client_name, ''), 160), 'ruleset', coalesce(new.ruleset, ''), 'has_logo', new.logo_path is not null, 'has_supervisor', new.supervisor_id is not null);
  else
    next_action := 'delete';
    brief_before := jsonb_build_object('name', label, 'ruleset', coalesce(old.ruleset, ''), 'has_logo', old.logo_path is not null, 'has_supervisor', old.supervisor_id is not null);
  end if;
  insert into public.audit_events (org_id, actor_id, action, entity, entity_id, summary, before, after)
  values (coalesce(new.org_id, old.org_id), auth.uid(), next_action, 'sites', coalesce(new.id, old.id)::text,
    format('%s site%s', case next_action when 'create' then 'Created' when 'update' then 'Updated' else 'Deleted' end, case when label <> '' then ' · ' || label else '' end),
    brief_before, brief_after);
  return coalesce(new, old);
end; $$;

create or replace function beta_private.audit_qr_code()
returns trigger language plpgsql security definer set search_path = public as $$
declare next_action text; label text;
begin
  label := left(coalesce(new.label, old.label, ''), 160);
  if tg_op = 'INSERT' then next_action := 'create';
  elsif tg_op = 'UPDATE' then next_action := 'update';
  else next_action := 'delete'; end if;
  insert into public.audit_events (org_id, actor_id, action, entity, entity_id, summary, before, after)
  values (coalesce(new.org_id, old.org_id), auth.uid(), next_action, 'qr_codes', coalesce(new.id, old.id)::text,
    format('%s QR code%s', case next_action when 'create' then 'Created' when 'update' then 'Updated' else 'Deleted' end, case when label <> '' then ' · ' || label else '' end),
    case when tg_op = 'INSERT' then null else jsonb_build_object('label', left(coalesce(old.label, ''), 160), 'target_type', coalesce(old.target_type, ''), 'target_id', left(coalesce(old.target_id, ''), 80), 'active', old.active) end,
    case when tg_op = 'DELETE' then null else jsonb_build_object('label', label, 'target_type', coalesce(new.target_type, ''), 'target_id', left(coalesce(new.target_id, ''), 80), 'active', new.active) end);
  return coalesce(new, old);
end; $$;
revoke all on function beta_private.audit_qr_code() from public, anon;
grant execute on function beta_private.audit_qr_code() to authenticated;
drop trigger if exists audit_qr_code on public.qr_codes;
create trigger audit_qr_code after insert or update or delete on public.qr_codes for each row execute function beta_private.audit_qr_code();

create or replace function beta_private.audit_form_submission()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_events (org_id, actor_id, action, entity, entity_id, summary, before, after)
  values (new.org_id, null, 'create', 'form_submissions', new.id::text,
    format('Filed %s%s%s', coalesce(nullif(new.form_title, ''), 'form'), case when new.stopped then ' · stop the job' else '' end, case when new.area_label <> '' then ' · ' || left(new.area_label, 80) else '' end),
    null, jsonb_build_object('form_title', left(coalesce(new.form_title, ''), 160), 'stopped', new.stopped, 'area_label', left(coalesce(new.area_label, ''), 160), 'person_name', left(coalesce(new.person_name, ''), 160)));
  return new;
end; $$;
revoke all on function beta_private.audit_form_submission() from public, anon, authenticated;
grant execute on function beta_private.audit_form_submission() to service_role;
drop trigger if exists audit_form_submission on public.form_submissions;
create trigger audit_form_submission after insert on public.form_submissions for each row execute function beta_private.audit_form_submission();
grant usage on schema beta_private to service_role;
grant execute on function beta_private.audit_hse_record() to service_role;;

commit;
