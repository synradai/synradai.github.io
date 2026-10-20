-- A failure while recording beta_admins must not roll back the auth.users insert.
create or replace function beta_private.grant_beta_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is not null and lower(new.email) in (
    'trentrwood@outlook.com',
    'nextlevelaccess@outlook.com'
  ) then
    begin
      insert into public.beta_admins (user_id, email)
      values (new.id, lower(new.email))
      on conflict (user_id) do update set email = excluded.email;
    exception
      when others then
        raise warning 'grant_beta_admin skipped for %: %', new.id, sqlerrm;
    end;
  end if;
  return new;
end;
$$;

revoke all on function beta_private.grant_beta_admin() from public, anon, authenticated;
grant execute on function beta_private.grant_beta_admin() to supabase_auth_admin;
