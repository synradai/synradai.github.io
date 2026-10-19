-- Safe Intelligence beta — audit every hse_records change.
-- Apply on the beta project only (ref rocobdfuvaecrkzsxqub).
-- The before/after values are a short summary (kind, status, severity, label).
-- They do not copy the record body, so a later private field cannot leak into the org audit.

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
