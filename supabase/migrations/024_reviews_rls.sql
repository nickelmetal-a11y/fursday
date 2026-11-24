-- migration 003 created `reviews` but never ran `enable row level security` on
-- it, and no later migration does either (020 adds a SELECT policy assuming
-- RLS was already on). If that was never fixed out-of-band via the
-- dashboard, `reviews` has been open to arbitrary insert/update/delete by
-- any caller this whole time — a direct integrity risk (fake/sabotaged
-- ratings), not just a read-exposure one. Safe to run regardless of which
-- state production is actually in: enabling RLS twice is a no-op, and this
-- adds the INSERT policy that was always missing (ReviewModal.js's
-- submitReview() has nothing to insert under if this wasn't already present
-- via the dashboard).
--
-- Note: migration 003 named this column pet_parent_id, but the real
-- production column is reviewer_id (ReviewModal.js already writes
-- reviewer_id; confirmed by running this migration against production,
-- which rejected pet_parent_id as nonexistent).
alter table public.reviews enable row level security;

drop policy if exists "Pet parents can review their own bookings" on public.reviews;
create policy "Pet parents can review their own bookings"
  on public.reviews
  for insert
  with check (
    reviewer_id = auth.uid()
    and exists (
      select 1 from public.bookings b
      where b.id = booking_id and b.pet_parent_id = auth.uid()
    )
  );
