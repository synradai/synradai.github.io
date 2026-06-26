-- Safety Advisor — sync migration (run AFTER schema.sql)
-- ---------------------------------------------------------------------------
-- Adds what cloud sync needs:
--   * client_id  — the app's own record id (from generateId()), so a local
--                  record maps 1:1 to its cloud row and upserts cleanly.
--   * updated_at — last-write-wins timestamp, kept current by a trigger.
--   * a unique (user_id, client_id) constraint so .upsert() can match.
--   * a BEFORE INSERT trigger that fills user_id/org_id automatically, so the
--     client never has to trust the browser to set ownership.
--
-- Safe to re-run. Run in Supabase → SQL Editor → New query.
-- ---------------------------------------------------------------------------

-- 1. Columns + constraints on each data table -------------------------------
do $$
declare t text;
begin
  foreach t in array array['shifts','incidents','learnings','field_reports'] loop
    execute format('alter table public.%I add column if not exists client_id text', t);
    execute format('alter table public.%I add column if not exists updated_at timestamptz not null default now()', t);
    execute format(
      'create unique index if not exists %I on public.%I (user_id, client_id)',
      t || '_user_client_uniq', t
    );
  end loop;
end $$;

-- 2. Keep updated_at current on every write ---------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 3. Auto-fill ownership on insert (client only sends client_id + data) ------
create or replace function public.set_row_owner()
returns trigger
language plpgsql security definer set search_path = public
as $$
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
    execute format(
      'create trigger %I before insert on public.%I for each row execute function public.set_row_owner()',
      t || '_set_owner', t
    );
    execute format('drop trigger if exists %I on public.%I', t || '_touch', t);
    execute format(
      'create trigger %I before insert or update on public.%I for each row execute function public.touch_updated_at()',
      t || '_touch', t
    );
  end loop;
end $$;
