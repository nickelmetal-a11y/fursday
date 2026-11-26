-- Phase 0: zones & addresses, sitter service radius, availability reads,
-- referral redemption. Run AFTER 030–033. Safe to re-run.

-- 1. Saved addresses (Home, Work, …). Booking still copies the chosen address
--    onto the booking row, so a later edit never changes a past booking.
create table if not exists public.user_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  label text not null default 'Home',
  flat text, building text, society text,
  area text,                 -- locality name, e.g. 'Sector 56' or 'Baner'
  pincode text,
  city_id uuid references public.cities(id),
  lat double precision, lng double precision,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists user_addresses_user on public.user_addresses(user_id);
alter table public.user_addresses enable row level security;
drop policy if exists "Own addresses" on public.user_addresses;
create policy "Own addresses" on public.user_addresses for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Admins read addresses" on public.user_addresses;
create policy "Admins read addresses" on public.user_addresses for select using (public.is_admin_user());

alter table public.bookings add column if not exists address_area text;
alter table public.bookings add column if not exists address_pincode text;
alter table public.bookings add column if not exists address_lat double precision;
alter table public.bookings add column if not exists address_lng double precision;

-- 2. Service zones the admin opens or closes. A city with no zones at all is
--    treated as fully open by the app, so nothing breaks before zones exist.
create table if not exists public.service_zones (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.cities(id),
  name text not null,                       -- e.g. 'Sector 50–57 cluster'
  pincodes text[] not null default '{}',
  center_lat double precision, center_lng double precision,
  radius_km numeric,
  is_open boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.service_zones enable row level security;
drop policy if exists "Anyone reads zones" on public.service_zones;
create policy "Anyone reads zones" on public.service_zones for select using (true);
drop policy if exists "Admins manage zones" on public.service_zones;
create policy "Admins manage zones" on public.service_zones for all using (public.is_admin_user()) with check (public.is_admin_user());

create table if not exists public.zone_waitlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  city_id uuid references public.cities(id),
  area text, pincode text,
  created_at timestamptz not null default now()
);
alter table public.zone_waitlist enable row level security;
drop policy if exists "Join waitlist" on public.zone_waitlist;
create policy "Join waitlist" on public.zone_waitlist for insert with check (auth.uid() = user_id);
drop policy if exists "Admins read waitlist" on public.zone_waitlist;
create policy "Admins read waitlist" on public.zone_waitlist for select using (public.is_admin_user());

-- 3. Where a sitter works from and how far they travel.
alter table public.sitter_profiles add column if not exists service_radius_km numeric not null default 5;
alter table public.sitter_profiles add column if not exists base_area text;
alter table public.sitter_profiles add column if not exists base_pincode text;
alter table public.sitter_profiles add column if not exists headline text;      -- one-line pitch on cards
alter table public.sitter_profiles add column if not exists highlights text[];  -- e.g. {'Large breeds','First aid trained'}
alter table public.sitter_profiles add column if not exists profile_updated_at timestamptz;

-- 4. Availability calendar: parents must see blocked dates too, or booking
--    can't avoid them (the old policy only exposed available rows).
drop policy if exists "Anyone reads availability" on public.sitter_availability;
create policy "Anyone reads availability" on public.sitter_availability for select using (true);
create unique index if not exists sitter_availability_one_per_day on public.sitter_availability(sitter_id, date);

-- 5. Referrals: amounts live in app_settings so the admin can change them.
insert into public.app_settings(key, value) values ('referral_reward_rs', '100'), ('referral_signup_rs', '50')
  on conflict (key) do nothing;

-- Redeem someone's code once per person; creates pending credits for both.
-- Credits are applied by the admin after the new person's first completed booking.
create or replace function public.apply_referral_code(p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r record; reward numeric; signup numeric;
begin
  if auth.uid() is null then return jsonb_build_object('error', 'not_signed_in'); end if;
  select * into r from referrals where upper(referral_code) = upper(trim(p_code)) for update;
  if not found then return jsonb_build_object('error', 'invalid'); end if;
  if r.referrer_id = auth.uid() then return jsonb_build_object('error', 'own_code'); end if;
  if exists (select 1 from referrals where referred_user_id = auth.uid()) then return jsonb_build_object('error', 'already_referred'); end if;
  select coalesce(nullif(value, '')::numeric, 100) into reward from app_settings where key = 'referral_reward_rs';
  select coalesce(nullif(value, '')::numeric, 50) into signup from app_settings where key = 'referral_signup_rs';
  -- A code can refer many people: record each use as its own row.
  insert into referrals(referrer_id, referred_user_id, referral_code, status, used_at)
    values (r.referrer_id, auth.uid(), r.referral_code || '-' || substr(auth.uid()::text, 1, 6), 'used', now());
  insert into referral_bonuses(user_id, amount, type, status) values
    (r.referrer_id, coalesce(reward, 100), 'referral_reward', 'pending'),
    (auth.uid(), coalesce(signup, 50), 'signup_bonus', 'pending');
  return jsonb_build_object('ok', true, 'reward', coalesce(reward, 100), 'signup', coalesce(signup, 50));
end $$;
revoke all on function public.apply_referral_code(text) from public;
grant execute on function public.apply_referral_code(text) to authenticated;

drop policy if exists "Users create own referral code" on referrals;
create policy "Users create own referral code" on referrals for insert with check (referrer_id = auth.uid() and referred_user_id is null);

notify pgrst, 'reload schema';
