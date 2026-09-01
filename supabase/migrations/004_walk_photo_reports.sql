-- Walk photo reports table for proof of service
create table if not exists walk_photo_reports (
  id uuid default gen_random_uuid() primary key,
  booking_id uuid not null unique references bookings(id) on delete cascade,
  sitter_id uuid not null references sitter_profiles(id) on delete cascade,
  pet_parent_id uuid not null references users(id) on delete cascade,
  photo_urls text[] default '{}',
  photo_count int default 0,
  parent_confirmed boolean default false,
  confirmed_at timestamp,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

-- Add columns to bookings table for walk report tracking
alter table bookings add column if not exists photo_report_id uuid references walk_photo_reports(id) on delete set null;
alter table bookings add column if not exists sitter_uploaded_photos boolean default false;
alter table bookings add column if not exists parent_confirmed_photos boolean default false;

-- Enable RLS
alter table walk_photo_reports enable row level security;

-- RLS Policies
drop policy if exists "Anyone can view walk photo reports" on walk_photo_reports;
drop policy if exists "Sitters can upload photos for their bookings" on walk_photo_reports;
drop policy if exists "Pet parents can confirm photo reports" on walk_photo_reports;

create policy "Anyone can view walk photo reports" on walk_photo_reports for select using (true);
create policy "Sitters can upload photos" on walk_photo_reports for insert with check (sitter_id in (select id from sitter_profiles where user_id = auth.uid()));
create policy "Sitters can update their photos" on walk_photo_reports for update using (sitter_id in (select id from sitter_profiles where user_id = auth.uid()));
create policy "Pet parents can confirm photos" on walk_photo_reports for update using (pet_parent_id = auth.uid());
