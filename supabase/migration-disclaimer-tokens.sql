-- 1) AI disclaimer acknowledgments — named, dated, logged (Critic requirement:
--    must exist before the first beta user). One row per user per disclaimer
--    version; a future wording change bumps the version and re-prompts everyone.
-- 2) Per-user AI token usage on ai_usage — makes heavy users visible before
--    the spend cap is hit, and turns the daily limit into a tunable.
-- Safe to re-run.

create table if not exists public.disclaimer_acks (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  version    int  not null,
  full_name  text,
  ua         text,
  acked_at   timestamptz not null default now(),
  unique (user_id, version)
);

alter table public.disclaimer_acks enable row level security;

drop policy if exists disclaimer_acks_insert on public.disclaimer_acks;
create policy disclaimer_acks_insert on public.disclaimer_acks
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists disclaimer_acks_select on public.disclaimer_acks;
create policy disclaimer_acks_select on public.disclaimer_acks
  for select to authenticated using (user_id = auth.uid());

-- Token usage columns on the existing rate-limit table.
alter table public.ai_usage add column if not exists tokens_in  bigint not null default 0;
alter table public.ai_usage add column if not exists tokens_out bigint not null default 0;

-- Service-role helper the AI proxy calls after each successful generation.
create or replace function public.add_ai_tokens(uid uuid, tin bigint, tout bigint)
returns void language sql security definer set search_path = public as $$
  update public.ai_usage
     set tokens_in = tokens_in + greatest(tin, 0),
         tokens_out = tokens_out + greatest(tout, 0)
   where user_id = uid and day = current_date;
$$;

revoke all on function public.add_ai_tokens(uuid, bigint, bigint) from public, anon, authenticated;
