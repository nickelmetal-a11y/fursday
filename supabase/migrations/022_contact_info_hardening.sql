-- Closes the residual gap flagged in migration 015: Postgres RLS is
-- row-level, not column-level, so the "public profile info" policy that
-- makes users rows readable for discovery (sitter cards, chat headers) also
-- exposes phone/email on that same row to anyone, including a caller who
-- never goes through the app UI at all (just a direct REST request against
-- the publishable anon key, which is already visible in the client bundle).
-- Confirmed as practically reachable, not just theoretical: sitter user_ids
-- are discoverable via the public explore listing.
--
-- Fix: revoke column-level SELECT on phone/email entirely (this is enforced
-- independently of RLS, so it closes the hole even though RLS can't), and
-- replace every direct read of those two columns with a SECURITY DEFINER
-- function that enforces the real authorization: self, an admin, or a
-- genuine booking counterpart. Requires migration 021 (is_admin_user()) to
-- already be applied.

revoke select (phone, email) on public.users from anon, authenticated;

create or replace function public.get_user_contact(target_id uuid)
returns table(phone text, email text)
language sql
security definer
stable
set search_path = public
as $$
  select u.phone, u.email
  from public.users u
  where u.id = target_id
    and (
      auth.uid() = target_id
      or public.is_admin_user()
      or exists (
        select 1 from public.bookings b
        left join public.sitter_profiles sp on sp.id = b.sitter_id
        where (b.pet_parent_id = auth.uid() and target_id = sp.user_id)
           or (sp.user_id = auth.uid() and target_id = b.pet_parent_id)
      )
      -- A pet parent also needs to see the phone of a sitter who has bid on
      -- their open broadcast request (BroadcastRequest.js), before any
      -- actual booking exists yet to satisfy the check above.
      or exists (
        select 1 from public.broadcast_responses br
        join public.broadcast_requests req on req.id = br.request_id
        join public.sitter_profiles sp on sp.id = br.sitter_id
        where req.pet_parent_id = auth.uid() and sp.user_id = target_id
      )
    );
$$;

revoke all on function public.get_user_contact(uuid) from public;
grant execute on function public.get_user_contact(uuid) to authenticated;

-- IMPORTANT: deploy the app code changes that switch every phone/email read
-- over to supabase.rpc('get_user_contact', { target_id }) BEFORE running
-- this migration. Any query still requesting users(phone, email) directly
-- (embedded or not) will start failing with a permission error the moment
-- this is applied.
