-- Safe Intelligence beta — generic QR codes and no-login form submissions.
-- Apply on the beta project only.
-- Do not apply this to any other project.
--
-- qr_codes is the reusable code for a form today. Later modules can point the
-- same row at a register item, a vehicle, or a document (target_type). This
-- migration does not create those registers.
-- A worker with a code files through the submit-form edge function. The
-- anon and authenticated roles cannot insert submissions or list tokens
-- they do not already hold.

alter table public.sites
  add column if not exists supervisor_id uuid references public.profiles (id) on delete set null;

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

comment on table public.qr_codes is
  'Generic site QR code. target_type form is live. register, vehicle, and document are reserved so later modules can reuse this table.';

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

create index if not exists form_submissions_org_site_idx
  on public.form_submissions (org_id, site_id, created_at desc);

create index if not exists form_submissions_qr_created_idx
  on public.form_submissions (qr_id, created_at desc);

comment on table public.form_submissions is
  'One filled QR form. Answers store storage paths, not image bytes. Writes go through the submit-form edge function.';

alter table public.app_config drop constraint if exists app_config_key_check;
alter table public.app_config add constraint app_config_key_check check (
  key in ('wording', 'forms', 'modules', 'inspection_templates', 'training_matrix', 'qr_forms')
);

-- Service-role inserts (stop-the-job actions) keep the supplied org and a
-- real member of that org. Signed-in users stay on the existing path.
create or replace function public.hse_records_stamp()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if tg_op = 'INSERT' and auth.role() = 'service_role' then
    if new.org_id is null or new.user_id is null then
      raise exception 'Service insert needs an organisation and a member';
    end if;
    if not exists (
      select 1 from public.profiles p
      where p.id = new.user_id and p.org_id = new.org_id
    ) then
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
grant execute on function public.hse_records_stamp() to authenticated, service_role;

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

  if new.supervisor_id is not null and not exists (
    select 1 from public.profiles p
    where p.id = new.supervisor_id and p.org_id = new.org_id
  ) then
    raise exception 'Supervisor is not in this organisation';
  end if;

  return new;
end;
$$;

revoke all on function public.sites_stamp() from public, anon;
grant execute on function public.sites_stamp() to authenticated;

create or replace function public.qr_codes_stamp()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    return old;
  end if;

  if public.current_org_id() is null then
    raise exception 'No organisation for this user';
  end if;

  if tg_op = 'INSERT' then
    new.org_id := public.current_org_id();
    new.created_at := coalesce(new.created_at, now());
    if new.active is null then
      new.active := true;
    end if;
  else
    new.id := old.id;
    new.org_id := old.org_id;
    new.site_id := old.site_id;
    new.token := old.token;
    new.target_type := old.target_type;
    new.target_id := old.target_id;
    new.created_at := old.created_at;
  end if;

  if not exists (
    select 1 from public.sites s
    where s.id = new.site_id and s.org_id = new.org_id
  ) then
    raise exception 'Site is not in this organisation';
  end if;

  new.label := left(btrim(coalesce(new.label, '')), 160);
  new.target_id := left(btrim(coalesce(new.target_id, '')), 160);
  if new.target_id = '' then
    raise exception 'QR target is missing';
  end if;
  if new.token is null or new.token !~ '^[A-Za-z0-9_-]{20,80}$' then
    raise exception 'QR token is not valid';
  end if;

  return new;
end;
$$;

revoke all on function public.qr_codes_stamp() from public, anon;
grant execute on function public.qr_codes_stamp() to authenticated;

drop trigger if exists qr_codes_stamp on public.qr_codes;
create trigger qr_codes_stamp
  before insert or update or delete on public.qr_codes
  for each row execute function public.qr_codes_stamp();

create or replace function public.form_submissions_stamp()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Submissions are filed through the form code';
  end if;

  if tg_op = 'UPDATE' then
    new.id := old.id;
    new.org_id := old.org_id;
    new.site_id := old.site_id;
    new.qr_id := old.qr_id;
    new.form_id := old.form_id;
    new.form_version := old.form_version;
    new.form_title := old.form_title;
    new.area_label := old.area_label;
    new.person_name := old.person_name;
    new.company := old.company;
    new.role := old.role;
    new.answers := old.answers;
    new.failed := old.failed;
    new.stopped := old.stopped;
    new.created_at := old.created_at;
    return new;
  end if;

  if new.org_id is null or new.site_id is null or new.qr_id is null then
    raise exception 'Submission is missing its code';
  end if;
  if not exists (
    select 1 from public.qr_codes q
    where q.id = new.qr_id
      and q.org_id = new.org_id
      and q.site_id = new.site_id
      and q.active
      and q.target_type = 'form'
  ) then
    raise exception 'QR code is not an active form';
  end if;

  new.person_name := left(btrim(coalesce(new.person_name, '')), 160);
  if new.person_name = '' then
    raise exception 'Add your name';
  end if;
  new.company := left(btrim(coalesce(new.company, '')), 160);
  new.role := left(btrim(coalesce(new.role, '')), 160);
  new.form_id := left(btrim(coalesce(new.form_id, '')), 80);
  new.form_title := left(btrim(coalesce(new.form_title, '')), 160);
  new.area_label := left(btrim(coalesce(new.area_label, '')), 160);
  new.created_at := coalesce(new.created_at, now());
  if new.answers is null then
    new.answers := '{}'::jsonb;
  end if;
  if new.failed is null then
    new.failed := '[]'::jsonb;
  end if;
  if new.stopped is null then
    new.stopped := false;
  end if;
  return new;
end;
$$;

revoke all on function public.form_submissions_stamp() from public, anon, authenticated;
grant execute on function public.form_submissions_stamp() to service_role;

drop trigger if exists form_submissions_stamp on public.form_submissions;
create trigger form_submissions_stamp
  before insert or update on public.form_submissions
  for each row execute function public.form_submissions_stamp();

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
      'has_logo', new.logo_path is not null,
      'has_supervisor', new.supervisor_id is not null
    );
  elsif tg_op = 'UPDATE' then
    next_action := 'update';
    brief_before := jsonb_build_object(
      'name', left(coalesce(old.name, ''), 160),
      'client_name', left(coalesce(old.client_name, ''), 160),
      'ruleset', coalesce(old.ruleset, ''),
      'has_logo', old.logo_path is not null,
      'has_supervisor', old.supervisor_id is not null
    );
    brief_after := jsonb_build_object(
      'name', label,
      'client_name', left(coalesce(new.client_name, ''), 160),
      'ruleset', coalesce(new.ruleset, ''),
      'has_logo', new.logo_path is not null,
      'has_supervisor', new.supervisor_id is not null
    );
  else
    next_action := 'delete';
    brief_before := jsonb_build_object(
      'name', label,
      'ruleset', coalesce(old.ruleset, ''),
      'has_logo', old.logo_path is not null,
      'has_supervisor', old.supervisor_id is not null
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

create or replace function beta_private.audit_qr_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  next_action text;
  label text;
begin
  label := left(coalesce(new.label, old.label, ''), 160);
  if tg_op = 'INSERT' then
    next_action := 'create';
  elsif tg_op = 'UPDATE' then
    next_action := 'update';
  else
    next_action := 'delete';
  end if;

  insert into public.audit_events (org_id, actor_id, action, entity, entity_id, summary, before, after)
  values (
    coalesce(new.org_id, old.org_id),
    auth.uid(),
    next_action,
    'qr_codes',
    coalesce(new.id, old.id)::text,
    format(
      '%s QR code%s',
      case next_action when 'create' then 'Created' when 'update' then 'Updated' else 'Deleted' end,
      case when label <> '' then ' · ' || label else '' end
    ),
    case when tg_op = 'INSERT' then null else jsonb_build_object(
      'label', left(coalesce(old.label, ''), 160),
      'target_type', coalesce(old.target_type, ''),
      'target_id', left(coalesce(old.target_id, ''), 80),
      'active', old.active
    ) end,
    case when tg_op = 'DELETE' then null else jsonb_build_object(
      'label', label,
      'target_type', coalesce(new.target_type, ''),
      'target_id', left(coalesce(new.target_id, ''), 80),
      'active', new.active
    ) end
  );
  return coalesce(new, old);
end;
$$;

revoke all on function beta_private.audit_qr_code() from public, anon;
grant execute on function beta_private.audit_qr_code() to authenticated;

drop trigger if exists audit_qr_code on public.qr_codes;
create trigger audit_qr_code
  after insert or update or delete on public.qr_codes
  for each row execute function beta_private.audit_qr_code();

create or replace function beta_private.audit_form_submission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_events (org_id, actor_id, action, entity, entity_id, summary, before, after)
  values (
    new.org_id,
    null,
    'create',
    'form_submissions',
    new.id::text,
    format(
      'Filed %s%s%s',
      coalesce(nullif(new.form_title, ''), 'form'),
      case when new.stopped then ' · stop the job' else '' end,
      case when new.area_label <> '' then ' · ' || left(new.area_label, 80) else '' end
    ),
    null,
    jsonb_build_object(
      'form_title', left(coalesce(new.form_title, ''), 160),
      'stopped', new.stopped,
      'area_label', left(coalesce(new.area_label, ''), 160),
      'person_name', left(coalesce(new.person_name, ''), 160)
    )
  );
  return new;
end;
$$;

revoke all on function beta_private.audit_form_submission() from public, anon, authenticated;
grant execute on function beta_private.audit_form_submission() to service_role;

drop trigger if exists audit_form_submission on public.form_submissions;
create trigger audit_form_submission
  after insert on public.form_submissions
  for each row execute function beta_private.audit_form_submission();

grant usage on schema beta_private to service_role;
grant execute on function beta_private.audit_hse_record() to service_role;

alter table public.qr_codes enable row level security;
alter table public.form_submissions enable row level security;

revoke all on public.qr_codes from public, anon;
grant select, insert, update, delete on public.qr_codes to authenticated;

revoke all on public.form_submissions from public, anon, authenticated;
grant select on public.form_submissions to authenticated;
grant all on public.qr_codes to service_role;
grant all on public.form_submissions to service_role;

drop policy if exists qr_codes_select on public.qr_codes;
create policy qr_codes_select
  on public.qr_codes
  for select
  to authenticated
  using (org_id = public.current_org_id());

drop policy if exists qr_codes_insert on public.qr_codes;
create policy qr_codes_insert
  on public.qr_codes
  for insert
  to authenticated
  with check (org_id = public.current_org_id() and beta_private.is_org_admin());

drop policy if exists qr_codes_update on public.qr_codes;
create policy qr_codes_update
  on public.qr_codes
  for update
  to authenticated
  using (org_id = public.current_org_id() and beta_private.is_org_admin())
  with check (org_id = public.current_org_id() and beta_private.is_org_admin());

drop policy if exists qr_codes_delete on public.qr_codes;
create policy qr_codes_delete
  on public.qr_codes
  for delete
  to authenticated
  using (org_id = public.current_org_id() and beta_private.is_org_admin());

drop policy if exists form_submissions_select on public.form_submissions;
create policy form_submissions_select
  on public.form_submissions
  for select
  to authenticated
  using (org_id = public.current_org_id());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('form-evidence', 'form-evidence', false, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists form_evidence_read on storage.objects;
create policy form_evidence_read
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'form-evidence'
    and (storage.foldername(name))[1] = public.current_org_id()::text
  );
