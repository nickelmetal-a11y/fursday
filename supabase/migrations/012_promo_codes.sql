-- Promotional codes / discount system
create table if not exists promo_codes (
  id uuid default gen_random_uuid() primary key,
  code text unique not null,
  discount_percent integer not null, -- e.g., 10, 20, 50
  discount_amount numeric(10,2), -- fixed amount instead of percent (optional)
  max_uses integer, -- null = unlimited
  times_used integer default 0,
  min_booking_amount numeric(10,2), -- minimum booking amount to use code
  max_discount_amount numeric(10,2), -- cap on discount amount
  valid_from timestamp not null,
  valid_until timestamp not null,
  status text default 'active', -- active, paused, expired
  description text,
  created_by uuid references users(id) on delete set null,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

create table if not exists promo_usage (
  id uuid default gen_random_uuid() primary key,
  promo_code_id uuid not null references promo_codes(id) on delete cascade,
  booking_id uuid not null references bookings(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  discount_amount numeric(10,2) not null,
  created_at timestamp default now()
);

-- Create indexes
create index if not exists idx_promo_codes_code on promo_codes(code);
create index if not exists idx_promo_codes_status on promo_codes(status);
create index if not exists idx_promo_codes_valid_until on promo_codes(valid_until);
create index if not exists idx_promo_usage_promo_code_id on promo_usage(promo_code_id);
create index if not exists idx_promo_usage_booking_id on promo_usage(booking_id);
create index if not exists idx_promo_usage_user_id on promo_usage(user_id);

-- Enable RLS
alter table promo_codes enable row level security;
alter table promo_usage enable row level security;

-- RLS Policies
drop policy if exists "Anyone can view active promo codes" on promo_codes;
drop policy if exists "Admins can manage promo codes" on promo_codes;
drop policy if exists "Users can view their promo usage" on promo_usage;
drop policy if exists "System can create promo usage" on promo_usage;

create policy "Anyone can view active promo codes" on promo_codes for select using (
  status = 'active' AND valid_from <= now() AND valid_until >= now()
);

create policy "Admins can manage promo codes" on promo_codes for all using (true);

create policy "Users can view their promo usage" on promo_usage for select using (
  user_id = auth.uid()
);

create policy "System can create promo usage" on promo_usage for insert with check (true);
