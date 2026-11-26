-- PHASE 1 (before launch). Do NOT run during Phase 0. Turn on together with
-- REACT_APP_ADMIN_REQUIRE_2FA=true (admin build) and ADMIN_REQUIRE_2FA=true (Vercel env).
-- Admin powers now require a two-factor session (Supabase MFA, "aal2").
-- An emailed sign-in code alone (aal1) no longer unlocks any admin data,
-- so a compromised inbox is not enough to reach customer data.
--
-- The admin website enrols each admin in an authenticator app (TOTP) the
-- first time they sign in after this, then asks for the app code every time.
-- Run AFTER 033.

-- "Is this person an admin at all?" - used only to decide whether to show
-- the two-factor screen. Grants nothing by itself.
create or replace function public.is_admin_account()
returns boolean language sql security definer stable set search_path = public as $$
  select coalesce((select is_admin from public.users where id = auth.uid()), false);
$$;
revoke all on function public.is_admin_account() from public;
grant execute on function public.is_admin_account() to authenticated;

-- Every RLS policy that grants admin access goes through this function, so
-- requiring aal2 here applies the rule everywhere at once.
create or replace function public.is_admin_user()
returns boolean language sql security definer stable set search_path = public as $$
  select coalesce((select is_admin from public.users where id = auth.uid()), false)
     and coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2';
$$;

notify pgrst, 'reload schema';
