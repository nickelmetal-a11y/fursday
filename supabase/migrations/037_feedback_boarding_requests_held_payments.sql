-- 037: feedback tab, boarding-only hosts, smart nearby requests, pay-at-booking.
-- Safe to run more than once. Run after 035 (036 is the Mac session's push tokens).

-- 1) Feedback from any screen --------------------------------------------------
create table if not exists public.app_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  kind text not null default 'idea' check (kind in ('idea','problem','love')),
  message text not null check (char_length(message) between 3 and 2000),
  screen text,
  role text,
  lang text,
  platform text,
  screenshot_path text,
  status text not null default 'new' check (status in ('new','planned','done','wont_do')),
  admin_note text,
  created_at timestamptz not null default now()
);
alter table public.app_feedback enable row level security;
drop policy if exists "Users send feedback" on public.app_feedback;
create policy "Users send feedback" on public.app_feedback for insert with check (user_id = auth.uid());
drop policy if exists "Users read own feedback" on public.app_feedback;
create policy "Users read own feedback" on public.app_feedback for select using (user_id = auth.uid() or public.is_admin_user());
drop policy if exists "Admins update feedback" on public.app_feedback;
create policy "Admins update feedback" on public.app_feedback for update using (public.is_admin_user()) with check (public.is_admin_user());

insert into storage.buckets (id, name, public) values ('feedback', 'feedback', false) on conflict (id) do nothing;
drop policy if exists "Users upload feedback screenshots" on storage.objects;
create policy "Users upload feedback screenshots" on storage.objects for insert to authenticated
  with check (bucket_id = 'feedback' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "Admins read feedback screenshots" on storage.objects;
create policy "Admins read feedback screenshots" on storage.objects for select to authenticated
  using (bucket_id = 'feedback' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin_user()));

-- 2) Boarding-only hosts --------------------------------------------------------
alter table public.sitter_profiles add column if not exists provider_type text not null default 'sitter';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'sitter_profiles_provider_type_check') then
    alter table public.sitter_profiles add constraint sitter_profiles_provider_type_check check (provider_type in ('sitter','boarding','both'));
  end if;
end $$;
-- home_details: { home_type, outdoor[], someone_home, kids, other_pets, sleeping, ac, max_dogs, sizes[], rules, vet_km, updates }
alter table public.sitter_profiles add column if not exists home_details jsonb not null default '{}'::jsonb;
alter table public.sitter_profiles add column if not exists home_photos text[] not null default '{}';

-- 3) Smart nearby requests ------------------------------------------------------
create table if not exists public.broadcast_requests (
  id uuid primary key default gen_random_uuid(),
  pet_parent_id uuid references public.users(id) on delete cascade,
  city_id uuid,
  service_type text,
  scheduled_date date,
  scheduled_time text,
  area text,
  notes text,
  status text default 'open',
  chosen_sitter_id uuid,
  created_at timestamptz default now()
);
alter table public.broadcast_requests add column if not exists end_date date;
alter table public.broadcast_requests add column if not exists pet_id uuid references public.pet_profiles(id) on delete set null;
-- A snapshot (name, breed, size, age, notes) so sitters see the dog without reading pet_profiles.
alter table public.broadcast_requests add column if not exists pet_summary jsonb not null default '{}'::jsonb;
alter table public.broadcast_requests add column if not exists address_pincode text;
alter table public.broadcast_requests add column if not exists address_lat double precision;
alter table public.broadcast_requests add column if not exists address_lng double precision;
alter table public.broadcast_requests add column if not exists mode text not null default 'compare';
alter table public.broadcast_requests add column if not exists budget_max_paise integer;
alter table public.broadcast_requests add column if not exists wave integer not null default 1;
alter table public.broadcast_requests add column if not exists radius_km numeric not null default 5;
alter table public.broadcast_requests add column if not exists last_wave_at timestamptz default now();
alter table public.broadcast_requests add column if not exists expires_at timestamptz;
alter table public.broadcast_requests add column if not exists booking_id uuid references public.bookings(id) on delete set null;

create table if not exists public.broadcast_responses (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references public.broadcast_requests(id) on delete cascade,
  sitter_id uuid references public.sitter_profiles(id) on delete cascade,
  status text default 'offered',
  offered_price integer,
  created_at timestamptz default now()
);
alter table public.broadcast_responses add column if not exists message text;
alter table public.broadcast_responses add column if not exists proposed_time text;
create unique index if not exists broadcast_responses_one_per_sitter on public.broadcast_responses (request_id, sitter_id);

-- Who was told about a request, in which wave, and whether they looked.
create table if not exists public.broadcast_recipients (
  request_id uuid not null references public.broadcast_requests(id) on delete cascade,
  sitter_id uuid not null references public.sitter_profiles(id) on delete cascade,
  wave integer not null default 1,
  distance_km numeric,
  notified_at timestamptz not null default now(),
  viewed_at timestamptz,
  declined_at timestamptz,
  decline_reason text,
  primary key (request_id, sitter_id)
);

-- The two older tables were created by hand with unknown policies; start clean.
do $$ declare p record; begin
  for p in select policyname, tablename from pg_policies where schemaname = 'public'
    and tablename in ('broadcast_requests','broadcast_responses','broadcast_recipients') loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;
alter table public.broadcast_requests enable row level security;
alter table public.broadcast_responses enable row level security;
alter table public.broadcast_recipients enable row level security;

-- Policies on requests and recipients refer to each other; security-definer helpers
-- break the loop (Postgres otherwise reports infinite recursion in policy).
create or replace function public.owns_broadcast(req uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from broadcast_requests where id = req and pet_parent_id = auth.uid());
$$;
create or replace function public.invited_to_broadcast(req uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from broadcast_recipients r join sitter_profiles sp on sp.id = r.sitter_id where r.request_id = req and sp.user_id = auth.uid());
$$;
create or replace function public.is_my_sitter_profile(sid uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from sitter_profiles where id = sid and user_id = auth.uid());
$$;
create or replace function public.can_respond_to_broadcast(req uuid, sid uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from broadcast_recipients r join broadcast_requests q on q.id = r.request_id join sitter_profiles sp on sp.id = r.sitter_id
                 where r.request_id = req and r.sitter_id = sid and q.status = 'open' and (q.expires_at is null or q.expires_at > now())
                   and sp.user_id = auth.uid() and sp.status = 'active');
$$;
grant execute on function public.owns_broadcast(uuid), public.invited_to_broadcast(uuid), public.is_my_sitter_profile(uuid), public.can_respond_to_broadcast(uuid, uuid) to authenticated;

create policy "Parents manage own requests" on public.broadcast_requests for all
  using (pet_parent_id = auth.uid()) with check (pet_parent_id = auth.uid());
create policy "Invited sitters read requests" on public.broadcast_requests for select using (public.invited_to_broadcast(id));
create policy "Admins read requests" on public.broadcast_requests for select using (public.is_admin_user());

create policy "Parents invite sitters" on public.broadcast_recipients for insert with check (public.owns_broadcast(request_id));
create policy "Parents see who was invited" on public.broadcast_recipients for select using (public.owns_broadcast(request_id) or public.is_admin_user());
create policy "Sitters see own invites" on public.broadcast_recipients for select using (public.is_my_sitter_profile(sitter_id));
create policy "Sitters mark invites viewed or declined" on public.broadcast_recipients for update using (public.is_my_sitter_profile(sitter_id)) with check (public.is_my_sitter_profile(sitter_id));

create policy "Invited active sitters respond" on public.broadcast_responses for insert with check (public.can_respond_to_broadcast(request_id, sitter_id));
create policy "Sitters read own responses" on public.broadcast_responses for select using (public.is_my_sitter_profile(sitter_id));
create policy "Sitters update own responses" on public.broadcast_responses for update using (public.is_my_sitter_profile(sitter_id))
  with check (public.is_my_sitter_profile(sitter_id) and status <> 'chosen');
create policy "Parents read offers" on public.broadcast_responses for select using (public.owns_broadcast(request_id) or public.is_admin_user());
create policy "Parents choose an offer" on public.broadcast_responses for update using (public.owns_broadcast(request_id));

-- Sitters may only set viewed/declined on their invite; the wave and distance stay as the parent wrote them.
create or replace function public.guard_broadcast_recipient() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.owns_broadcast(new.request_id) and not public.is_admin_user() then
    new.request_id := old.request_id; new.sitter_id := old.sitter_id; new.wave := old.wave;
    new.distance_km := old.distance_km; new.notified_at := old.notified_at;
  end if;
  return new;
end $$;
drop trigger if exists guard_broadcast_recipient on public.broadcast_recipients;
create trigger guard_broadcast_recipient before update on public.broadcast_recipients for each row execute function public.guard_broadcast_recipient();
create index if not exists broadcast_recipients_sitter on public.broadcast_recipients (sitter_id);
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'broadcast_requests_status_check') then
    update public.broadcast_requests set status = 'open' where status is null;
    alter table public.broadcast_requests add constraint broadcast_requests_status_check check (status in ('open','filled','cancelled','expired'));
  end if;
end $$;

-- 4) Pay at booking, release after the service ----------------------------------
-- payment_status: unpaid → authorized (held, sitter not yet accepted) → held (captured, Fursday holding)
--                 → refunded / partially_refunded / voided. Legacy 'paid' = held.
-- payout_status:  null → on_hold (until payout_release_at) → ready → paid. 'disputed' pauses it.
alter table public.bookings add column if not exists payment_status text;
alter table public.bookings add column if not exists payment_id text;
alter table public.bookings add column if not exists payout_status text;
alter table public.bookings add column if not exists razorpay_order_id text;
alter table public.bookings add column if not exists payment_mode text;            -- 'live' | 'test' | 'simulated'
alter table public.bookings add column if not exists paid_at timestamptz;
alter table public.bookings add column if not exists captured_at timestamptz;
alter table public.bookings add column if not exists payout_release_at timestamptz;
alter table public.bookings add column if not exists released_at timestamptz;
alter table public.bookings add column if not exists refunded_amount_paise integer not null default 0;

create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  kind text not null,            -- authorized | captured | voided | refunded | released | paid_out | disputed
  amount_paise integer,
  gateway_ref text,
  note text,
  created_at timestamptz not null default now()
);
alter table public.payment_events enable row level security;
drop policy if exists "Booking parties read payment events" on public.payment_events;
create policy "Booking parties read payment events" on public.payment_events for select using (
  public.is_admin_user() or exists (
    select 1 from public.bookings b left join public.sitter_profiles sp on sp.id = b.sitter_id
    where b.id = booking_id and (b.pet_parent_id = auth.uid() or sp.user_id = auth.uid())));
-- The server (service role) writes payment events; admins may log a manual payout.
drop policy if exists "Admins log payouts" on public.payment_events;
create policy "Admins log payouts" on public.payment_events for insert with check (public.is_admin_user());

-- Only the server (service role) or an admin may change money fields on a booking.
create or replace function public.guard_booking_money() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(current_setting('request.jwt.claims', true)::json->>'role', '') = 'service_role' or public.is_admin_user() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    -- A new booking always starts unpaid, whatever the app sent.
    if new.payment_status is not null and new.payment_status not in ('unpaid','pending') then new.payment_status := 'unpaid'; end if;
    new.payment_id := null; new.razorpay_order_id := null; new.payment_mode := null;
    new.paid_at := null; new.captured_at := null; new.payout_status := null;
    new.payout_release_at := null; new.released_at := null; new.refunded_amount_paise := 0;
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
     or new.refunded_amount_paise is distinct from old.refunded_amount_paise then
    raise exception 'Payment fields can only be changed by Fursday''s server';
  end if;
  return new;
end $$;
drop trigger if exists guard_booking_money on public.bookings;
create trigger guard_booking_money before insert or update on public.bookings for each row execute function public.guard_booking_money();

notify pgrst, 'reload schema';
