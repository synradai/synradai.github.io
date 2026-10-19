-- Require authenticator assurance level 2 (aal2) for authenticated access.
--
-- These are RESTRICTIVE policies: they do not grant access. They AND with the
-- existing permissive policies, so a password-only (aal1) session cannot read
-- or write user data. Apply this only after the frontend that forces TOTP
-- enrolment is live, so people can enrol before the database starts refusing
-- aal1 tokens.
--
-- hse_records exists on the beta project only. The block below no-ops where
-- that table is absent.

-- Data tables (for all)
do $$
declare t text;
begin
  foreach t in array array['incidents', 'field_reports', 'daily_log', 'shifts', 'learnings', 'ask_chats']
  loop
    execute format('drop policy if exists require_aal2 on public.%I', t);
    execute format(
      'create policy require_aal2 on public.%I as restrictive for all to authenticated using ((select auth.jwt()->>''aal'') = ''aal2'') with check ((select auth.jwt()->>''aal'') = ''aal2'')',
      t
    );
  end loop;
end $$;

-- organisations: select
drop policy if exists require_aal2 on public.organisations;
create policy require_aal2
  on public.organisations
  as restrictive
  for select
  to authenticated
  using ((select auth.jwt()->>'aal') = 'aal2');

-- profiles: select and update
drop policy if exists require_aal2_select on public.profiles;
create policy require_aal2_select
  on public.profiles
  as restrictive
  for select
  to authenticated
  using ((select auth.jwt()->>'aal') = 'aal2');

drop policy if exists require_aal2_update on public.profiles;
create policy require_aal2_update
  on public.profiles
  as restrictive
  for update
  to authenticated
  using ((select auth.jwt()->>'aal') = 'aal2')
  with check ((select auth.jwt()->>'aal') = 'aal2');

-- disclaimer_acks: select + insert (for all covers both; it does not grant new commands)
drop policy if exists require_aal2 on public.disclaimer_acks;
create policy require_aal2
  on public.disclaimer_acks
  as restrictive
  for all
  to authenticated
  using ((select auth.jwt()->>'aal') = 'aal2')
  with check ((select auth.jwt()->>'aal') = 'aal2');

-- client_errors: insert
drop policy if exists require_aal2 on public.client_errors;
create policy require_aal2
  on public.client_errors
  as restrictive
  for insert
  to authenticated
  with check ((select auth.jwt()->>'aal') = 'aal2');

-- beta HSE register, when that table is on this project
do $$
begin
  if to_regclass('public.hse_records') is not null then
    execute 'drop policy if exists require_aal2 on public.hse_records';
    execute $policy$
      create policy require_aal2
        on public.hse_records
        as restrictive
        for all
        to authenticated
        using ((select auth.jwt()->>'aal') = 'aal2')
        with check ((select auth.jwt()->>'aal') = 'aal2')
    $policy$;
  end if;
end $$;
