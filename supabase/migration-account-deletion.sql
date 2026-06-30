-- Self-serve account deletion (Apple App Store requirement + Privacy Act right).
-- The authenticated user calls public.delete_my_account(); it removes their
-- organisation (which cascades their profile + all data) and their auth login.
-- SECURITY DEFINER so it can reach auth.users; only the signed-in user can run it
-- and it only ever deletes that user's own org/account (auth.uid()).

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  oid uuid;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  select org_id into oid from public.profiles where id = uid;

  -- Deleting the organisation cascades the profile and every data table that
  -- references organisations(id) on delete cascade (shifts, incidents,
  -- learnings, field_reports, daily_log, ask_chats).
  if oid is not null then
    delete from public.organisations where id = oid;
  end if;

  -- Remove the login itself.
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
