-- Security hardening from the 2026-07-12 pentest (findings 1–3, all Low).
-- Zero app impact: the edge functions call these as service_role, which retains
-- execute. Only the unnecessary public/anon/authenticated grants are removed.
-- Safe to re-run.

-- 1. bump_ai_usage takes an arbitrary uid and is SECURITY DEFINER (bypasses RLS).
--    Nobody but the AI-proxy edge function (service_role) should call it —
--    revoke it from clients so a user can't inflate another user's AI counter.
revoke execute on function public.bump_ai_usage(uuid) from public, anon, authenticated;

-- 2. Trigger functions only make sense fired by a trigger (they need NEW row
--    context). Remove the pointless public execute grants — defence in depth.
revoke execute on function public.touch_updated_at() from public, anon, authenticated;
revoke execute on function public.set_row_owner() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- 3. Pin the search_path on the one trigger function that was missed (all other
--    functions already set it), closing the mutable-search_path lint.
alter function public.touch_updated_at() set search_path = public;
