-- Sitter availability calendar system
create table if not exists sitter_availability (
  id uuid default gen_random_uuid() primary key,
  sitter_id uuid not null references sitter_profiles(id) on delete cascade,
  date date not null,
  time_slots text[], -- e.g., ["09:00-11:00", "14:00-17:00"]
  is_available boolean default true,
  max_bookings_per_day integer default 3,
  notes text,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

-- Create indexes
create index if not exists idx_sitter_availability_sitter_id on sitter_availability(sitter_id);
create index if not exists idx_sitter_availability_date on sitter_availability(date);
create index if not exists idx_sitter_availability_is_available on sitter_availability(is_available);

-- Enable RLS
alter table sitter_availability enable row level security;

-- RLS Policies
drop policy if exists "Sitters can view their availability" on sitter_availability;
drop policy if exists "Sitters can update their availability" on sitter_availability;
drop policy if exists "Pet parents can view sitter availability" on sitter_availability;
drop policy if exists "Admins can view all availability" on sitter_availability;

create policy "Sitters can view their availability" on sitter_availability for select using (
  sitter_id IN (select id from sitter_profiles where user_id = auth.uid())
);

create policy "Sitters can update their availability" on sitter_availability for update using (
  sitter_id IN (select id from sitter_profiles where user_id = auth.uid())
);

create policy "Sitters can create availability" on sitter_availability for insert with check (
  sitter_id IN (select id from sitter_profiles where user_id = auth.uid())
);

create policy "Pet parents can view sitter availability" on sitter_availability for select using (
  is_available = true
);

create policy "Admins can view all availability" on sitter_availability for select using (true);
