-- Real admin identity + closes several "using (true)" RLS holes that were
-- left as explicit TODOs in migrations 008-012. Until now AdminPanel was
-- just a client-side password check over the same shared anon/authenticated
-- key everyone else uses — meaning admin_audit_logs, disputes (all),
-- referrals (all), sitter_availability (all), and promo_codes (all writes)
-- were readable/writable by ANY authenticated (or even anon) caller who
-- crafted a direct REST request, not just the real admin.

-- A real admin identity: a flag on the same users row everyone already has,
-- checked by a SECURITY DEFINER function so RLS policies can call it without
-- re-triggering RLS on users (which would recurse).
alter table public.users add column if not exists is_admin boolean not null default false;

create or replace function public.is_admin_user()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce((select is_admin from public.users where id = auth.uid()), false);
$$;

revoke all on function public.is_admin_user() from public;
grant execute on function public.is_admin_user() to authenticated, anon;

-- admin_audit_logs: tighten the read policy, and add the INSERT policy that
-- was missing entirely (with RLS on and zero insert policies, every write
-- from auditService.js was being silently denied — caught by its own
-- try/catch and only ever logged to the browser console).
drop policy if exists "Only admins can view audit logs" on admin_audit_logs;
create policy "Admins can view audit logs" on admin_audit_logs
  for select using (is_admin_user());
create policy "Admins can insert audit logs" on admin_audit_logs
  for insert with check (is_admin_user() and admin_id = auth.uid());

-- disputes: real admin check on the read policy, plus the missing UPDATE
-- policy (resolveDispute() in AdminDisputes.js was updating with no error
-- check — the update was being silently denied by RLS and the UI still
-- showed "Dispute resolved!").
drop policy if exists "Admins can view all disputes" on disputes;
create policy "Admins can view all disputes" on disputes
  for select using (is_admin_user());
create policy "Admins can update disputes" on disputes
  for update using (is_admin_user()) with check (is_admin_user());

-- disputes: DisputeForm.js/AdminDisputes.js need a "who this dispute is
-- against" column distinct from reported_by ("who filed it") to notify the
-- right person and show them on the sitter's side — this column never
-- existed, so filing a dispute has been failing outright (unknown column).
alter table disputes add column if not exists reported_user_id uuid references users(id) on delete set null;
create index if not exists idx_disputes_reported_user_id on disputes(reported_user_id);

-- referrals: real admin check; narrow referral_bonuses inserts to admin-only
-- (was "with check (true)" — any authenticated caller could insert
-- themselves a fake paid bonus; nothing in the app currently relies on a
-- wider insert path, this was pure exposure).
drop policy if exists "Admins can view all referrals" on referrals;
create policy "Admins can view all referrals" on referrals
  for select using (is_admin_user());
drop policy if exists "System can create bonuses" on referral_bonuses;
create policy "Admins can create bonuses" on referral_bonuses
  for insert with check (is_admin_user());

-- sitter_availability: real admin check.
drop policy if exists "Admins can view all availability" on sitter_availability;
create policy "Admins can view all availability" on sitter_availability
  for select using (is_admin_user());

-- promo_codes: real admin check. The old "for all using (true)" granted
-- unrestricted insert/update/delete (and a redundant select) to anyone —
-- any authenticated caller could create or edit discount codes.
drop policy if exists "Admins can manage promo codes" on promo_codes;
create policy "Admins can manage promo codes" on promo_codes
  for all using (is_admin_user()) with check (is_admin_user());

-- walk_photo_reports: same "using (true)" pattern as the others above, but
-- for actual photos of someone's pet/home plus the booking_id/pet_parent_id/
-- sitter_id that go with them — readable by any authenticated or anon
-- caller platform-wide, not just the two people on that booking.
drop policy if exists "Anyone can view walk photo reports" on walk_photo_reports;
create policy "Booking counterparts can view walk photo reports" on walk_photo_reports
  for select using (
    is_admin_user()
    or pet_parent_id = auth.uid()
    or sitter_id in (select id from sitter_profiles where user_id = auth.uid())
  );

-- One-time: mark the account(s) that should actually have admin access.
-- Run this yourself with the real email(s) before relying on the policies
-- above — until then, is_admin defaults to false for everyone and nobody
-- (including the real admin) can read/write the admin-only tables.
-- update public.users set is_admin = true where email = 'you@example.com';
