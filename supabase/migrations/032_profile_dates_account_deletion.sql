-- Profile facts the app shows: when a sitter was approved, when their
-- identity was verified. Plus in-app account deletion requests (required by
-- Apple App Store guideline 5.1.1(v) and promised in the Terms/Privacy Policy).

alter table public.sitter_profiles add column if not exists approved_at timestamptz;
alter table public.sitter_profiles add column if not exists aadhaar_verified_at timestamptz;

-- Best available backfill for sitters approved before these columns existed.
update public.sitter_profiles set approved_at = coalesce(updated_at, created_at)
  where status = 'active' and approved_at is null;
update public.sitter_profiles set aadhaar_verified_at = coalesce(updated_at, created_at)
  where aadhaar_verified = true and aadhaar_verified_at is null;

create table if not exists public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  reason text,
  status text not null default 'requested' check (status in ('requested', 'completed', 'cancelled')),
  requested_at timestamptz not null default now(),
  completed_at timestamptz
);
create unique index if not exists account_deletion_one_open_request
  on public.account_deletion_requests(user_id) where status = 'requested';

alter table public.account_deletion_requests enable row level security;
drop policy if exists "Users request their own deletion" on public.account_deletion_requests;
create policy "Users request their own deletion" on public.account_deletion_requests
  for insert with check (auth.uid() = user_id);
drop policy if exists "Users see their own deletion requests" on public.account_deletion_requests;
create policy "Users see their own deletion requests" on public.account_deletion_requests
  for select using (auth.uid() = user_id or public.is_admin_user());
drop policy if exists "Users cancel, admins complete deletion requests" on public.account_deletion_requests;
create policy "Users cancel, admins complete deletion requests" on public.account_deletion_requests
  for update using (auth.uid() = user_id or public.is_admin_user());

-- Sitter ratings never moved: reviews were inserted but nothing recomputed
-- sitter_profiles.rating / avg_rating / review_count, which every screen reads.
create or replace function public.refresh_sitter_rating()
returns trigger language plpgsql security definer set search_path = public as $$
declare sid uuid;
begin
  if tg_op = 'DELETE' then sid := old.sitter_id; else sid := new.sitter_id; end if;
  update public.sitter_profiles sp set
    review_count = r.cnt,
    avg_rating = coalesce(r.avg, 0),
    rating = coalesce(r.avg, 0)
  from (select count(*)::int as cnt, round(avg(rating)::numeric, 2) as avg from public.reviews where sitter_id = sid) r
  where sp.id = sid;
  return null;
end $$;
drop trigger if exists reviews_refresh_sitter_rating on public.reviews;
create trigger reviews_refresh_sitter_rating after insert or update or delete on public.reviews
  for each row execute function public.refresh_sitter_rating();
-- Bring existing sitters in line once.
update public.sitter_profiles sp set
  review_count = coalesce(r.cnt, 0), avg_rating = coalesce(r.avg, sp.avg_rating), rating = coalesce(r.avg, sp.rating)
from (select sitter_id, count(*)::int as cnt, round(avg(rating)::numeric, 2) as avg from public.reviews group by sitter_id) r
where sp.id = r.sitter_id;

notify pgrst, 'reload schema';
