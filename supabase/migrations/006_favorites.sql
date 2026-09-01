-- Favorites table for pet parents to save preferred sitters
create table if not exists favorites (
  id uuid default gen_random_uuid() primary key,
  pet_parent_id uuid not null references users(id) on delete cascade,
  sitter_id uuid not null references sitter_profiles(id) on delete cascade,
  favorited_at timestamp default now(),
  unique(pet_parent_id, sitter_id)
);

-- Enable RLS
alter table favorites enable row level security;

-- RLS Policies
drop policy if exists "Pet parents can view their favorites" on favorites;
drop policy if exists "Pet parents can add favorites" on favorites;
drop policy if exists "Pet parents can remove favorites" on favorites;

create policy "Pet parents can view their favorites" on favorites for select using (pet_parent_id = auth.uid());
create policy "Pet parents can add favorites" on favorites for insert with check (pet_parent_id = auth.uid());
create policy "Pet parents can remove favorites" on favorites for delete using (pet_parent_id = auth.uid());
