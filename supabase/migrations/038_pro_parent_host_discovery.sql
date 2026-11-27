-- 038: pro features for parents, boarding hosts and visitors. Safe to run more than once. Run after 037.

-- 1) Pet health and care details ------------------------------------------------
alter table public.pet_profiles add column if not exists size text;                       -- small | medium | large | giant
alter table public.pet_profiles add column if not exists vaccination_cert_url text;       -- public URL in pet-photos/<user_id>/vaccination/...
alter table public.pet_profiles add column if not exists vaccinated_until date;
alter table public.pet_profiles add column if not exists vet_name text;
alter table public.pet_profiles add column if not exists vet_phone text;
alter table public.pet_profiles add column if not exists feeding_notes text;
alter table public.pet_profiles add column if not exists medication_notes text;
alter table public.pet_profiles add column if not exists emergency_vet_consent boolean not null default false;
alter table public.pet_profiles add column if not exists is_puppy boolean not null default false;

-- 2) Host business settings -----------------------------------------------------
-- pricing_rules: { weekend_pct, holiday_pct, holidays: ['2026-11-01',...], long_stay_nights, long_stay_pct,
--                  extra_dog_pct, puppy_extra_rupees, pickup_fee_rupees }  (all optional; % are surcharges or discounts as noted in src/pricing.js)
alter table public.sitter_profiles add column if not exists pricing_rules jsonb not null default '{}'::jsonb;
alter table public.sitter_profiles add column if not exists cancellation_policy text not null default 'moderate';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'sitter_profiles_cancellation_policy_check') then
    alter table public.sitter_profiles add constraint sitter_profiles_cancellation_policy_check check (cancellation_policy in ('flexible','moderate','strict'));
  end if;
end $$;
alter table public.sitter_profiles add column if not exists instant_book boolean not null default false;   -- repeat clients book without approval
alter table public.sitter_profiles add column if not exists requires_vaccination boolean not null default false;
alter table public.sitter_profiles add column if not exists share_slug text;                               -- fursday.vercel.app/s/<slug>
create unique index if not exists sitter_profiles_share_slug on public.sitter_profiles (share_slug) where share_slug is not null;

-- 3) Bookings: several pets, repeat series, meet & greet, tips, boarding handover --
alter table public.bookings add column if not exists pet_ids uuid[];                 -- all pets on the booking; pet_id stays the first one
alter table public.bookings add column if not exists series_id uuid;
alter table public.bookings add column if not exists is_meet_greet boolean not null default false;
alter table public.bookings add column if not exists tip_paise integer not null default 0;
alter table public.bookings add column if not exists house_rules_accepted_at timestamptz;
alter table public.bookings add column if not exists cancellation_policy text;      -- the host's policy at booking time
alter table public.bookings add column if not exists checked_in_at timestamptz;
alter table public.bookings add column if not exists checked_out_at timestamptz;
alter table public.bookings add column if not exists handover jsonb not null default '{}'::jsonb;   -- { food, meds, belongings[], photos[], notes }

create table if not exists public.booking_series (
  id uuid primary key default gen_random_uuid(),
  pet_parent_id uuid not null references public.users(id) on delete cascade,
  sitter_id uuid not null references public.sitter_profiles(id) on delete cascade,
  service_type text not null,
  weekdays integer[] not null,            -- 0 = Sunday … 6 = Saturday
  time_slot text not null,
  start_date date not null,
  end_date date not null,
  status text not null default 'active' check (status in ('active','paused','ended')),
  created_at timestamptz not null default now()
);
alter table public.booking_series enable row level security;
drop policy if exists "Parents manage own series" on public.booking_series;
create policy "Parents manage own series" on public.booking_series for all using (pet_parent_id = auth.uid()) with check (pet_parent_id = auth.uid());
drop policy if exists "Sitters read their series" on public.booking_series;
create policy "Sitters read their series" on public.booking_series for select using (public.is_my_sitter_profile(sitter_id) or public.is_admin_user());

-- Daily updates during a stay (photos + note), posted by the sitter.
create table if not exists public.stay_updates (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  sitter_id uuid not null references public.sitter_profiles(id) on delete cascade,
  photo_urls text[] not null default '{}',
  note text,
  mood text,                               -- happy | settled | missing_you | unwell
  created_at timestamptz not null default now()
);
create or replace function public.is_booking_party(bid uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from bookings b left join sitter_profiles sp on sp.id = b.sitter_id
                 where b.id = bid and (b.pet_parent_id = auth.uid() or sp.user_id = auth.uid()));
$$;
create or replace function public.is_booking_sitter(bid uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from bookings b join sitter_profiles sp on sp.id = b.sitter_id where b.id = bid and sp.user_id = auth.uid());
$$;
grant execute on function public.is_booking_party(uuid), public.is_booking_sitter(uuid) to authenticated;
alter table public.stay_updates enable row level security;
drop policy if exists "Booking parties read stay updates" on public.stay_updates;
create policy "Booking parties read stay updates" on public.stay_updates for select using (public.is_booking_party(booking_id) or public.is_admin_user());
drop policy if exists "Sitter posts stay updates" on public.stay_updates;
create policy "Sitter posts stay updates" on public.stay_updates for insert with check (public.is_booking_sitter(booking_id) and public.is_my_sitter_profile(sitter_id));

-- Hosts review the parent and the dog after a completed booking.
create table if not exists public.parent_reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings(id) on delete cascade,
  sitter_id uuid not null references public.sitter_profiles(id) on delete cascade,
  pet_parent_id uuid not null references public.users(id) on delete cascade,
  pet_id uuid references public.pet_profiles(id) on delete set null,
  rating integer not null check (rating between 1 and 5),
  dog_behaviour text,                      -- calm | playful | anxious | reactive
  note text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now()
);
create or replace function public.is_active_sitter() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from sitter_profiles where user_id = auth.uid() and status = 'active');
$$;
grant execute on function public.is_active_sitter() to authenticated;
alter table public.parent_reviews enable row level security;
drop policy if exists "Sitters review completed bookings" on public.parent_reviews;
create policy "Sitters review completed bookings" on public.parent_reviews for insert with check (
  public.is_my_sitter_profile(sitter_id) and exists (select 1 from public.bookings b where b.id = booking_id and b.sitter_id = parent_reviews.sitter_id and b.status = 'completed'));
drop policy if exists "Parent, active sitters and admins read parent reviews" on public.parent_reviews;
create policy "Parent, active sitters and admins read parent reviews" on public.parent_reviews for select using (
  pet_parent_id = auth.uid() or public.is_active_sitter() or public.is_admin_user());

-- 4) Ask a sitter a question before booking ----------------------------------------
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  pet_parent_id uuid not null references public.users(id) on delete cascade,
  sitter_id uuid not null references public.sitter_profiles(id) on delete cascade,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (pet_parent_id, sitter_id)
);
create table if not exists public.conversation_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create or replace function public.in_conversation(cid uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from conversations c left join sitter_profiles sp on sp.id = c.sitter_id
                 where c.id = cid and (c.pet_parent_id = auth.uid() or sp.user_id = auth.uid()));
$$;
grant execute on function public.in_conversation(uuid) to authenticated;
alter table public.conversations enable row level security;
alter table public.conversation_messages enable row level security;
drop policy if exists "Parents start conversations" on public.conversations;
create policy "Parents start conversations" on public.conversations for insert with check (pet_parent_id = auth.uid());
drop policy if exists "Participants read conversations" on public.conversations;
create policy "Participants read conversations" on public.conversations for select using (public.in_conversation(id) or public.is_admin_user());
drop policy if exists "Participants touch conversations" on public.conversations;
create policy "Participants touch conversations" on public.conversations for update using (public.in_conversation(id));
drop policy if exists "Participants send messages" on public.conversation_messages;
create policy "Participants send messages" on public.conversation_messages for insert with check (sender_id = auth.uid() and public.in_conversation(conversation_id));
drop policy if exists "Participants read messages" on public.conversation_messages;
create policy "Participants read messages" on public.conversation_messages for select using (public.in_conversation(conversation_id) or public.is_admin_user());
drop policy if exists "Recipients mark messages read" on public.conversation_messages;
create policy "Recipients mark messages read" on public.conversation_messages for update using (public.in_conversation(conversation_id) and sender_id <> auth.uid());
do $$ begin
  begin alter publication supabase_realtime add table public.conversation_messages; exception when duplicate_object then null; end;
end $$;

-- 5) Email/push delivery bookkeeping and phone verification -----------------------
alter table public.notifications add column if not exists emailed_at timestamptz;
alter table public.notifications add column if not exists pushed_at timestamptz;
alter table public.users add column if not exists phone_verified_at timestamptz;
-- Public columns only (031): phone_verified_at is not secret, so let the app read it.
grant select (phone_verified_at) on public.users to anon, authenticated;

-- Copy Supabase Auth's confirmed phone onto public.users, so the app and admin can trust it.
create or replace function public.sync_phone_verified() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.phone_confirmed_at is not null and (old.phone_confirmed_at is distinct from new.phone_confirmed_at or old.phone is distinct from new.phone) then
    update public.users set phone = '+' || ltrim(new.phone, '+'), phone_verified_at = new.phone_confirmed_at where id = new.id;
  end if;
  return new;
end $$;
drop trigger if exists sync_phone_verified on auth.users;
create trigger sync_phone_verified after update on auth.users for each row execute function public.sync_phone_verified();

-- 6) Visitors browse before signing in: public sitter info and reviews -------------
drop policy if exists "Anyone reads reviews" on public.reviews;
create policy "Anyone reads reviews" on public.reviews for select using (true);
grant select on public.reviews to anon;
grant select on public.sitter_services to anon;
grant select on public.sitter_profile_photos to anon;

-- 6a) Boarding capacity: parents can't read other parents' bookings, so count booked dogs per night here.
create or replace function public.host_nights_taken(p_sitter_ids uuid[], p_from date, p_to date)
returns table (sitter_id uuid, night date, dogs integer) language sql stable security definer set search_path = public as $$
  select b.sitter_id, n::date as night, sum(coalesce(array_length(b.pet_ids, 1), 1))::int as dogs
  from bookings b
  cross join lateral generate_series(b.booking_date, greatest(b.booking_date, coalesce(b.end_date, b.booking_date + 1) - 1), interval '1 day') n
  where b.sitter_id = any(p_sitter_ids)
    and b.service_type in ('boarding', 'housesit')
    and b.status in ('pending', 'confirmed', 'active')
    and n::date between p_from and p_to
  group by b.sitter_id, n::date;
$$;
grant execute on function public.host_nights_taken(uuid[], date, date) to anon, authenticated;

-- 6c) The booked sitter can read the pet's care details (vet, food, medicines).
drop policy if exists "Booked sitters read pets" on public.pet_profiles;
create policy "Booked sitters read pets" on public.pet_profiles for select using (
  exists (select 1 from public.bookings b where (b.pet_id = pet_profiles.id or pet_profiles.id = any(b.pet_ids)) and public.is_booking_sitter(b.id)));

-- 6d) Meet & greet adds a new service type; drop any hand-made CHECK on bookings.service_type.
do $$ declare c record; begin
  for c in select conname from pg_constraint where conrelid = 'public.bookings'::regclass and contype = 'c'
           and pg_get_constraintdef(oid) ilike '%service_type%' loop
    execute format('alter table public.bookings drop constraint %I', c.conname);
  end loop;
end $$;

-- 6b) Favourite sitters: migration 006 never ran on production, so the heart did nothing.
create table if not exists public.favorites (
  id uuid default gen_random_uuid() primary key,
  pet_parent_id uuid not null references public.users(id) on delete cascade,
  sitter_id uuid not null references public.sitter_profiles(id) on delete cascade,
  favorited_at timestamptz default now(),
  unique (pet_parent_id, sitter_id)
);
alter table public.favorites enable row level security;
drop policy if exists "Pet parents can view their favorites" on public.favorites;
create policy "Pet parents can view their favorites" on public.favorites for select using (pet_parent_id = auth.uid());
drop policy if exists "Pet parents can add favorites" on public.favorites;
create policy "Pet parents can add favorites" on public.favorites for insert with check (pet_parent_id = auth.uid());
drop policy if exists "Pet parents can remove favorites" on public.favorites;
create policy "Pet parents can remove favorites" on public.favorites for delete using (pet_parent_id = auth.uid());

-- 7) Money guard (replaces 037's): also protect prices, tips and the policy, and let
--    security-definer functions (e.g. apply_promo_to_booking) through. Runs as the caller (not security
--    definer) so current_user is the real role: 'authenticated'/'anon' from the app, the owner inside RPCs.
create or replace function public.guard_booking_money() returns trigger language plpgsql security invoker set search_path = public as $$
declare caller text := coalesce(current_setting('request.jwt.claims', true)::json->>'role', '');
begin
  if caller = 'service_role' or current_user not in ('authenticated', 'anon') or public.is_admin_user() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.payment_status is not null and new.payment_status not in ('unpaid','pending') then new.payment_status := 'unpaid'; end if;
    new.payment_id := null; new.razorpay_order_id := null; new.payment_mode := null;
    new.paid_at := null; new.captured_at := null; new.payout_status := null;
    new.payout_release_at := null; new.released_at := null; new.refunded_amount_paise := 0;
    new.tip_paise := 0;
    return new;
  end if;
  if new.payment_status is distinct from old.payment_status
     or new.payment_id is distinct from old.payment_id
     or new.razorpay_order_id is distinct from old.razorpay_order_id
     or new.payment_mode is distinct from old.payment_mode
     or new.paid_at is distinct from old.paid_at
     or new.captured_at is distinct from old.captured_at
     or new.payout_status is distinct from old.payout_status
     or new.payout_release_at is distinct from old.payout_release_at
     or new.released_at is distinct from old.released_at
     or new.refunded_amount_paise is distinct from old.refunded_amount_paise
     or new.tip_paise is distinct from old.tip_paise
     or new.gross_amount_paise is distinct from old.gross_amount_paise
     or new.sitter_payout_paise is distinct from old.sitter_payout_paise
     or new.cancellation_policy is distinct from old.cancellation_policy then
    raise exception 'Payment fields can only be changed by Fursday''s server';
  end if;
  return new;
end $$;

notify pgrst, 'reload schema';
