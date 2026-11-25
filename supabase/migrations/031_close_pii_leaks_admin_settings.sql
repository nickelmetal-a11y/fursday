-- 1) users.phone / users.email were still readable by anyone holding the
--    public anon key. Migration 022's `revoke select (phone, email)` was a
--    no-op: Supabase grants table-level SELECT, and a column revoke cannot
--    take away what a table-level grant gives. Fix: drop the table-level
--    grant and re-grant only the public columns.
--    GOTCHA for future migrations: a NEW column on public.users is not
--    readable by the app until it is added to the grant below.
revoke select on public.users from anon, authenticated;
grant select (id, name, city_id, avatar_url, created_at, updated_at, terms_agreed_at)
  on public.users to anon, authenticated;
-- phone/email stay reachable only through get_user_contact() (migration 022);
-- is_admin only through is_admin_user() (migration 021).

-- 2) sitter_profiles.upi_id duplicated the payout UPI from sitter_pii, but on a
--    publicly readable table. Copy anything there into sitter_pii, then drop it.
insert into public.sitter_pii (sitter_id, upi_id)
  select id, upi_id from public.sitter_profiles where upi_id is not null
  on conflict (sitter_id) do update set upi_id = coalesce(public.sitter_pii.upi_id, excluded.upi_id);
alter table public.sitter_profiles drop column if exists upi_id;

-- 3) Admins need to see Aadhaar/UPI to verify sitters and pay them.
drop policy if exists "Admins can view sitter PII" on public.sitter_pii;
create policy "Admins can view sitter PII" on public.sitter_pii
  for select using (public.is_admin_user());

-- 4) app_settings (support phone/WhatsApp) was created outside migrations.
--    Everyone may read it; only admins may change it.
create table if not exists public.app_settings (
  key text primary key,
  value text,
  updated_at timestamptz default now()
);
alter table public.app_settings add column if not exists updated_at timestamptz default now();
alter table public.app_settings enable row level security;
drop policy if exists "Anyone can read app settings" on public.app_settings;
create policy "Anyone can read app settings" on public.app_settings for select using (true);
drop policy if exists "Admins can insert app settings" on public.app_settings;
create policy "Admins can insert app settings" on public.app_settings for insert with check (public.is_admin_user());
drop policy if exists "Admins can update app settings" on public.app_settings;
create policy "Admins can update app settings" on public.app_settings for update using (public.is_admin_user()) with check (public.is_admin_user());

notify pgrst, 'reload schema';
