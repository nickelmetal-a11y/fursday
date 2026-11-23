-- Same failure mode as public.users (migration 015): these tables work fine
-- for service_role but silently hide data from real authenticated users who
-- legitimately need to see it. Confirmed via side-by-side testing (real user
-- session vs service_role) during a full RLS audit.

-- sitter_services: pricing is core marketplace discovery info - a parent
-- must be able to see what a sitter charges before ever booking them.
create policy "Anyone can read sitter services"
  on sitter_services
  for select
  to anon, authenticated
  using (true);

-- reviews: a public trust signal on a sitter's profile - needs to be
-- readable by anyone, not just the reviewer/reviewed booking's parties.
create policy "Anyone can read reviews"
  on reviews
  for select
  to anon, authenticated
  using (true);

-- pet_profiles: a sitter needs to see the pet's name/breed/notes for a
-- booking she's actually confirmed to handle - counterpart-via-booking,
-- same shape as the public.users fix, not fully public (unlike the two
-- above) since pet notes can include sensitive household details.
create policy "Sitters can read pets for their own bookings"
  on pet_profiles
  for select
  to authenticated
  using (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM bookings b
      JOIN sitter_profiles sp ON sp.id = b.sitter_id
      WHERE b.pet_id = pet_profiles.id AND sp.user_id = auth.uid()
    )
  );
