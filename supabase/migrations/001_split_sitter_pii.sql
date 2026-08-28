-- Create sitter_pii table for sensitive personal information
create table if not exists public.sitter_pii (
  id uuid default gen_random_uuid() primary key,
  sitter_id uuid not null references public.sitter_profiles(id) on delete cascade,
  aadhaar_number text,
  upi_id text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(sitter_id)
);

-- Remove these columns from sitter_profiles (backfill first if needed)
-- First, insert existing data into sitter_pii
insert into public.sitter_pii (sitter_id, aadhaar_number, upi_id)
select id, aadhaar_number, upi_id from public.sitter_profiles
where aadhaar_number is not null or upi_id is not null
on conflict (sitter_id) do nothing;

-- Then drop the columns from sitter_profiles
alter table public.sitter_profiles drop column if exists aadhaar_number;
alter table public.sitter_profiles drop column if exists upi_id;

-- Enable RLS on sitter_pii
alter table public.sitter_pii enable row level security;

-- RLS: Sitters can only see their own PII
create policy "Sitters can view own PII"
  on public.sitter_pii
  for select
  using (sitter_id = (select id from public.sitter_profiles where user_id = auth.uid() limit 1));

-- RLS: Sitters can only update their own PII
create policy "Sitters can update own PII"
  on public.sitter_pii
  for update
  using (sitter_id = (select id from public.sitter_profiles where user_id = auth.uid() limit 1))
  with check (sitter_id = (select id from public.sitter_profiles where user_id = auth.uid() limit 1));

-- RLS: Sitters can only insert their own PII
create policy "Sitters can insert own PII"
  on public.sitter_pii
  for insert
  with check (sitter_id = (select id from public.sitter_profiles where user_id = auth.uid() limit 1));

-- RLS: Admins can view all PII (if needed, adjust based on your admin logic)
-- create policy "Admins can view all PII"
--   on public.sitter_pii
--   for select
--   using (auth.jwt() ->> 'role' = 'admin');
