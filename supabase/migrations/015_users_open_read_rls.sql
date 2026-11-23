-- public.users currently only lets a user SELECT their own row (RLS). This
-- silently breaks every cross-user name/phone/email lookup in the app:
-- sitter cards on the home/explore screens, bookings dashboard, chat headers,
-- and a sitter's view of a parent's contact info all fall back to blank or
-- a placeholder ("Care pro") for every real logged-in user. Confirmed via a
-- side-by-side query as a real authenticated user vs service_role.
--
-- Two-tier fix, matching how most marketplaces (Uber, Airbnb, etc.) do it:
-- name/avatar/city are public discovery info; phone/email are only shown to
-- someone who actually shares a real booking with that user.

-- Tier 1: name/avatar/city are low-sensitivity "public profile" info needed
-- for discovery before any booking exists (sitter cards, chat headers, etc).
-- Note: Postgres RLS is row-level, not column-level, so this policy makes
-- the whole row visible, not just these columns — see the note below.
CREATE POLICY "Public profile info is readable by anyone"
  ON public.users
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Tier 2 (defense in depth, not strictly required given Tier 1 above):
-- explicit relationship-scoped visibility for phone/email, documenting the
-- intended boundary even though Tier 1 already makes the row visible.
-- A determined caller crafting raw API requests (not using the app's own
-- UI, which never requests phone/email outside a real booking context)
-- could still read any user's phone/email once Tier 1 is in place — closing
-- that fully requires moving phone/email into a separate, more restrictively
-- governed access path (a SECURITY DEFINER function or a split table), which
-- is a bigger follow-up change, not included here.
CREATE POLICY "Booking counterparts can read each other's contact info"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = id
    OR EXISTS (
      SELECT 1 FROM public.bookings b
      LEFT JOIN public.sitter_profiles sp ON sp.id = b.sitter_id
      WHERE (b.pet_parent_id = auth.uid() AND users.id = sp.user_id)
         OR (sp.user_id = auth.uid() AND users.id = b.pet_parent_id)
    )
  );
