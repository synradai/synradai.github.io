-- Email-code sign-in is enough on beta. Admin writes still require a listed
-- beta admin in the caller's organisation. The authenticator condition
-- comes off. Apply on the beta project only. Do not apply this to the live project.
--
-- The old restrictive authenticator policies were never applied on beta, so they are not dropped here.

drop policy if exists app_config_insert on public.app_config;
create policy app_config_insert
  on public.app_config
  for insert
  to authenticated
  with check (
    org_id = public.current_org_id()
    and public.is_beta_admin()
  );

drop policy if exists app_config_update on public.app_config;
create policy app_config_update
  on public.app_config
  for update
  to authenticated
  using (
    org_id = public.current_org_id()
    and public.is_beta_admin()
  )
  with check (
    org_id = public.current_org_id()
    and public.is_beta_admin()
  );

drop policy if exists app_config_delete on public.app_config;
create policy app_config_delete
  on public.app_config
  for delete
  to authenticated
  using (
    org_id = public.current_org_id()
    and public.is_beta_admin()
  );
