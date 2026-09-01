-- Reviews table for sitter ratings
create table if not exists reviews (
  id uuid default gen_random_uuid() primary key,
  booking_id uuid not null unique references bookings(id) on delete cascade,
  sitter_id uuid not null references sitter_profiles(id) on delete cascade,
  pet_parent_id uuid not null references users(id) on delete cascade,
  rating int not null check (rating >= 1 and rating <= 5),
  review_text text,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

-- Update sitter_profiles with average rating
alter table sitter_profiles add column if not exists avg_rating numeric(3,2) default 5.0;
alter table sitter_profiles add column if not exists review_count int default 0;
