-- sitter-photos bucket has the same gap chat-photos had: created via the
-- Storage API this session with public:true (reads only), never got an
-- INSERT policy on storage.objects. Confirmed broken for real authenticated
-- users in production — this blocks the sitter avatar/portfolio photo
-- upload fix shipped earlier (that fix was only verified via service_role,
-- which bypasses RLS and masked this).
create policy "Authenticated users can upload sitter photos"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'sitter-photos');

create policy "Anyone can view sitter photos"
  on storage.objects for select
  using (bucket_id = 'sitter-photos');
