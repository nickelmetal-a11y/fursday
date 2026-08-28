-- Sitter profile photos table (max 3 photos per sitter)
create table sitter_profile_photos (
  id uuid default gen_random_uuid() primary key,
  sitter_id uuid not null references sitter_profiles(id) on delete cascade,
  photo_url text not null,
  display_order int default 0,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

alter table sitter_profile_photos enable row level security;

-- RLS Policies
drop policy if exists "Sitters can view own photos" on sitter_profile_photos;
create policy "Sitters can view own photos"
  on sitter_profile_photos for select
  using (sitter_id in (
    select id from sitter_profiles where user_id = auth.uid()
  ));

drop policy if exists "Sitters can insert own photos" on sitter_profile_photos;
create policy "Sitters can insert own photos"
  on sitter_profile_photos for insert
  with check (sitter_id in (
    select id from sitter_profiles where user_id = auth.uid()
  ));

drop policy if exists "Sitters can update own photos" on sitter_profile_photos;
create policy "Sitters can update own photos"
  on sitter_profile_photos for update
  using (sitter_id in (
    select id from sitter_profiles where user_id = auth.uid()
  ));

drop policy if exists "Sitters can delete own photos" on sitter_profile_photos;
create policy "Sitters can delete own photos"
  on sitter_profile_photos for delete
  using (sitter_id in (
    select id from sitter_profiles where user_id = auth.uid()
  ));

-- Public read access (anyone can view sitter photos)
drop policy if exists "Public can view sitter photos" on sitter_profile_photos;
create policy "Public can view sitter photos"
  on sitter_profile_photos for select
  using (true);
