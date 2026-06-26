-- Safety Advisor / SafeIntel — AI usage metering + rate limit (run after setup-all.sql)
-- ---------------------------------------------------------------------------
-- Caps how many AI calls one account can make per day so a single user can't
-- run up the Anthropic bill, and gives a usage record for future billing tiers.
-- Only the service role (the edge function) touches this table.
-- ---------------------------------------------------------------------------

create table if not exists public.ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day     date not null default current_date,
  count   int  not null default 0,
  primary key (user_id, day)
);

alter table public.ai_usage enable row level security;
-- No policies on purpose: nobody but the service role may read/write usage.

-- Atomically add one to today's count for a user and return the new total.
create or replace function public.bump_ai_usage(uid uuid)
returns int language plpgsql security definer set search_path = public as $$
declare c int;
begin
  insert into public.ai_usage (user_id, day, count) values (uid, current_date, 1)
    on conflict (user_id, day) do update set count = public.ai_usage.count + 1
    returning count into c;
  return c;
end; $$;
