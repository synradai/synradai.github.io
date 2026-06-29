-- Add cloud sync for Daily Log and Gaz chats (same shape/RLS as the other
-- synced tables). Reuses existing functions: set_row_owner, touch_updated_at,
-- current_org_id. Safe to re-run.

create table if not exists public.daily_log (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organisations(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  client_id  text,
  data       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ask_chats (
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
  foreach t in array array['daily_log','ask_chats'] loop
    execute format('create unique index if not exists %I on public.%I (user_id, client_id)', t || '_user_client_uniq', t);
    execute format('drop trigger if exists %I on public.%I', t || '_set_owner', t);
    execute format('create trigger %I before insert on public.%I for each row execute function public.set_row_owner()', t || '_set_owner', t);
    execute format('drop trigger if exists %I on public.%I', t || '_touch', t);
    execute format('create trigger %I before insert or update on public.%I for each row execute function public.touch_updated_at()', t || '_touch', t);
  end loop;
end $$;

alter table public.daily_log enable row level security;
alter table public.ask_chats enable row level security;

do $$
declare t text;
begin
  foreach t in array array['daily_log','ask_chats'] loop
    execute format('drop policy if exists %1$s_all on public.%1$s', t);
    execute format('create policy %1$s_all on public.%1$s for all using (org_id = public.current_org_id()) with check (org_id = public.current_org_id())', t);
  end loop;
end $$;
