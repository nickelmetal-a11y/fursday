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

-- Note: Columns are dropped in sitter_profiles separately if they exist

-- Enable RLS on sitter_pii
alter table public.sitter_pii enable row level security;

-- Drop existing policies if they exist
drop policy if exists "Sitters can view own PII" on public.sitter_pii;
drop policy if exists "Sitters can update own PII" on public.sitter_pii;
drop policy if exists "Sitters can insert own PII" on public.sitter_pii;

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
