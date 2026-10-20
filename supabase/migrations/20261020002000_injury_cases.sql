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
