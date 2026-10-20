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
