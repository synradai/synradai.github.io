-- Safe Intelligence beta — admin editor config.
-- Apply on the beta project only (ref rocobdfuvaecrkzsxqub).
-- Do not apply this to any other project.
--
-- beta_admins is filled by a signup trigger for two email addresses.
-- app_config is JSON per key, per organisation, with a version.
-- Writes require a listed admin whose session is aal2.
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
    and (select auth.jwt()->>'aal') = 'aal2'
  );

drop policy if exists app_config_update on public.app_config;
create policy app_config_update
  on public.app_config
  for update
  to authenticated
  using (
    org_id = public.current_org_id()
    and public.is_beta_admin()
    and (select auth.jwt()->>'aal') = 'aal2'
  )
  with check (
    org_id = public.current_org_id()
    and public.is_beta_admin()
    and (select auth.jwt()->>'aal') = 'aal2'
  );

drop policy if exists app_config_delete on public.app_config;
create policy app_config_delete
  on public.app_config
  for delete
  to authenticated
  using (
    org_id = public.current_org_id()
    and public.is_beta_admin()
    and (select auth.jwt()->>'aal') = 'aal2'
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
