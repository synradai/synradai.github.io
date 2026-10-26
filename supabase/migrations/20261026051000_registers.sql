-- Safe Intelligence beta — company registers (bases, tabs, fields, views, rows).
-- Apply on the beta project only. Do not apply this to any other project.

create table if not exists public.registers (
  id text primary key,
  org_id uuid not null references public.organisations (id) on delete cascade,
  name text not null,
  abbr text not null default '',
  color text not null default '#8eb4ff',
  starred boolean not null default false,
  kind text not null default 'base',
  opened_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint registers_kind_check check (kind in ('base', 'forms'))
);

create unique index if not exists registers_org_name_idx on public.registers (org_id, name);

create table if not exists public.register_tables (
  id text primary key,
  org_id uuid not null references public.organisations (id) on delete cascade,
  register_id text not null references public.registers (id) on delete cascade,
  name text not null,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists register_tables_register_idx on public.register_tables (register_id, position);

create table if not exists public.register_fields (
  id text primary key,
  org_id uuid not null references public.organisations (id) on delete cascade,
  table_id text not null references public.register_tables (id) on delete cascade,
  name text not null,
  field_type text not null,
  options jsonb not null default '[]'::jsonb,
  position integer not null default 0,
  constraint register_fields_type_check check (field_type in (
    'text', 'number', 'date', 'single_select', 'multi_select', 'checkbox', 'attachment', 'url', 'qr'
  ))
);

create index if not exists register_fields_table_idx on public.register_fields (table_id, position);

create table if not exists public.register_views (
  id text primary key,
  org_id uuid not null references public.organisations (id) on delete cascade,
  table_id text not null references public.register_tables (id) on delete cascade,
  name text not null,
  config jsonb not null default '{}'::jsonb,
  position integer not null default 0
);

create index if not exists register_views_table_idx on public.register_views (table_id, position);

create table if not exists public.register_rows (
  id text primary key,
  org_id uuid not null references public.organisations (id) on delete cascade,
  table_id text not null references public.register_tables (id) on delete cascade,
  site_id uuid references public.sites (id) on delete set null,
  values jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists register_rows_table_idx on public.register_rows (table_id, updated_at desc);

comment on table public.registers is
  'A company register base. Tabs, fields, views, and rows hang off this row. Org-scoped.';

create or replace function public.registers_stamp()
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
  else
    new.org_id := old.org_id;
  end if;
  if tg_table_name in ('registers', 'register_rows') then
    if tg_op = 'INSERT' then
      new.created_at := coalesce(new.created_at, now());
    else
      new.created_at := old.created_at;
    end if;
    new.updated_at := now();
  elsif tg_table_name = 'register_tables' and tg_op = 'INSERT' then
    new.created_at := coalesce(new.created_at, now());
  elsif tg_table_name = 'register_tables' then
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;

revoke all on function public.registers_stamp() from public, anon;
grant execute on function public.registers_stamp() to authenticated;

drop trigger if exists registers_stamp on public.registers;
create trigger registers_stamp
  before insert or update on public.registers
  for each row execute function public.registers_stamp();

drop trigger if exists register_tables_stamp on public.register_tables;
create trigger register_tables_stamp
  before insert or update on public.register_tables
  for each row execute function public.registers_stamp();

drop trigger if exists register_fields_stamp on public.register_fields;
create trigger register_fields_stamp
  before insert or update on public.register_fields
  for each row execute function public.registers_stamp();

drop trigger if exists register_views_stamp on public.register_views;
create trigger register_views_stamp
  before insert or update on public.register_views
  for each row execute function public.registers_stamp();

drop trigger if exists register_rows_stamp on public.register_rows;
create trigger register_rows_stamp
  before insert or update on public.register_rows
  for each row execute function public.registers_stamp();

alter table public.registers enable row level security;
alter table public.register_tables enable row level security;
alter table public.register_fields enable row level security;
alter table public.register_views enable row level security;
alter table public.register_rows enable row level security;

revoke all on public.registers from public, anon;
revoke all on public.register_tables from public, anon;
revoke all on public.register_fields from public, anon;
revoke all on public.register_views from public, anon;
revoke all on public.register_rows from public, anon;

grant select, insert, update, delete on public.registers to authenticated;
grant select, insert, update, delete on public.register_tables to authenticated;
grant select, insert, update, delete on public.register_fields to authenticated;
grant select, insert, update, delete on public.register_views to authenticated;
grant select, insert, update, delete on public.register_rows to authenticated;

drop policy if exists registers_org on public.registers;
create policy registers_org on public.registers
  for all to authenticated
  using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());

drop policy if exists register_tables_org on public.register_tables;
create policy register_tables_org on public.register_tables
  for all to authenticated
  using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());

drop policy if exists register_fields_org on public.register_fields;
create policy register_fields_org on public.register_fields
  for all to authenticated
  using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());

drop policy if exists register_views_org on public.register_views;
create policy register_views_org on public.register_views
  for all to authenticated
  using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());

drop policy if exists register_rows_org on public.register_rows;
create policy register_rows_org on public.register_rows
  for all to authenticated
  using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());

create or replace function beta_private.register_row_brief(row_values jsonb)
returns jsonb
language sql
immutable
set search_path = public
as $$
  select jsonb_build_object(
    'label', left(coalesce(
      row_values->>'tag',
      row_values->>'title',
      row_values->>'name',
      row_values->>'item',
      row_values->>'description',
      ''
    ), 160)
  );
$$;

revoke all on function beta_private.register_row_brief(jsonb) from public, anon, authenticated;

create or replace function beta_private.audit_register_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  brief_before jsonb;
  brief_after jsonb;
  next_action text;
  label text;
begin
  if tg_op = 'INSERT' then
    next_action := 'create';
    brief_after := beta_private.register_row_brief(new.values);
    label := coalesce(brief_after->>'label', '');
  elsif tg_op = 'UPDATE' then
    next_action := 'update';
    brief_before := beta_private.register_row_brief(old.values);
    brief_after := beta_private.register_row_brief(new.values);
    label := coalesce(brief_after->>'label', '');
  else
    next_action := 'delete';
    brief_before := beta_private.register_row_brief(old.values);
    label := coalesce(brief_before->>'label', '');
  end if;

  insert into public.audit_events (org_id, actor_id, action, entity, entity_id, summary, before, after)
  values (
    coalesce(new.org_id, old.org_id),
    auth.uid(),
    next_action,
    'register_rows',
    coalesce(new.id, old.id),
    format(
      '%s register row%s',
      case next_action when 'create' then 'Created' when 'update' then 'Updated' else 'Deleted' end,
      case when label <> '' then ' · ' || label else '' end
    ),
    brief_before,
    brief_after
  );

  return coalesce(new, old);
end;
$$;

revoke all on function beta_private.audit_register_row() from public, anon;
grant execute on function beta_private.audit_register_row() to authenticated;

drop trigger if exists audit_register_row on public.register_rows;
create trigger audit_register_row
  after insert or update or delete on public.register_rows
  for each row execute function beta_private.audit_register_row();
