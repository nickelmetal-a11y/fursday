-- The chat-photos bucket was created via the Storage API with `public: true`,
-- which only affects reads (the public URL path). Unlike the older buckets
-- (pet-photos, sitter-photos, walk-photos), it never got RLS policies on
-- storage.objects allowing authenticated users to actually upload to it —
-- confirmed in production: "Photo failed to send: new row violates
-- row-level security policy".
create policy "Authenticated users can upload chat photos"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'chat-photos');

create policy "Anyone can view chat photos"
  on storage.objects for select
  using (bucket_id = 'chat-photos');
